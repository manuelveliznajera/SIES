import type { NextFunction, Request, Response } from 'express';
import { getClient } from '../../database/pool';
import type { PoolClient } from 'pg';
import { writeAuditEvent } from '../../services/observability';

interface BackupTable {
  oid: string;
  schema: string;
  name: string;
}

interface BackupColumn {
  table_schema: string;
  table_name: string;
  column_name: string;
  is_generated: string;
  is_identity: string;
}

interface BackupSequence {
  schema: string;
  name: string;
  table_schema: string;
  table_name: string;
}

const AUTH_PUBLIC_TABLES = new Set(['users', 'roles', 'user_roles', 'refresh_tokens', 'enumerators']);
const MIGRATION_PUBLIC_TABLES = new Set(['pgmigrations', 'schema_migrations']);
const PRESERVED_PUBLIC_TABLES = new Set([...AUTH_PUBLIC_TABLES, ...MIGRATION_PUBLIC_TABLES]);
const isMigrationTable = (table: Pick<BackupTable, 'schema' | 'name'>) => table.schema === 'public' && MIGRATION_PUBLIC_TABLES.has(table.name);
const shouldExcludeFromBackup = (table: Pick<BackupTable, 'schema' | 'name'>, includeUsers: boolean) =>
  isMigrationTable(table) || (!includeUsers && table.schema === 'public' && AUTH_PUBLIC_TABLES.has(table.name));

async function listApplicationTables(client: PoolClient): Promise<BackupTable[]> {
  const result = await client.query<BackupTable>(
    `SELECT c.oid::text AS oid, n.nspname AS schema, c.relname AS name
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind = 'r'
       AND n.nspname <> 'information_schema'
       AND n.nspname NOT LIKE 'pg_%'
     ORDER BY n.nspname, c.relname`
  );
  return result.rows;
}

async function writeResetAudit(client: PoolClient, req: Request, action: string, changes: Record<string, unknown>, userId: string | null = req.user!.userId): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, changes, ip_address, user_agent, origin, created_at)
     VALUES ($1, $2, 'database', $3::jsonb, $4, $5, $6, NOW())`,
    [
      userId,
      action,
      JSON.stringify(changes),
      req.ip?.slice(0, 45) ?? null,
      req.get('user-agent')?.slice(0, 500) ?? null,
      (req.get('origin') ?? req.get('referer') ?? '').slice(0, 500) || null,
    ]
  );
}

async function truncateApplicationData(client: PoolClient, includeUsers = false): Promise<string[]> {
  const tables = (await listApplicationTables(client)).filter((table) => !isMigrationTable(table) && (includeUsers || !(table.schema === 'public' && AUTH_PUBLIC_TABLES.has(table.name))));
  if (!tables.length) return [];
  const names = tables.map((table) => `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`).join(', ');
  await client.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  return tables.map((table) => `${table.schema}.${table.name}`);
}

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

function orderTables(tables: BackupTable[], dependencies: Array<{ child_oid: string; parent_oid: string }>): BackupTable[] {
  const byId = new Map(tables.map((table) => [table.oid, table]));
  const parents = new Map(tables.map((table) => [table.oid, new Set<string>()]));
  const children = new Map(tables.map((table) => [table.oid, new Set<string>()]));
  for (const dependency of dependencies) {
    if (!byId.has(dependency.child_oid) || !byId.has(dependency.parent_oid) || dependency.child_oid === dependency.parent_oid) continue;
    parents.get(dependency.child_oid)?.add(dependency.parent_oid);
    children.get(dependency.parent_oid)?.add(dependency.child_oid);
  }
  const ready = tables.filter((table) => parents.get(table.oid)?.size === 0).sort((a, b) => `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`));
  const ordered: BackupTable[] = [];
  while (ready.length) {
    const table = ready.shift()!;
    ordered.push(table);
    for (const childId of children.get(table.oid) ?? []) {
      parents.get(childId)?.delete(table.oid);
      if (parents.get(childId)?.size === 0) {
        const child = byId.get(childId);
        if (child && !ordered.includes(child) && !ready.includes(child)) ready.push(child);
      }
    }
  }
  const included = new Set(ordered.map((table) => table.oid));
  return [...ordered, ...tables.filter((table) => !included.has(table.oid)).sort((a, b) => `${a.schema}.${a.name}`.localeCompare(`${b.schema}.${b.name}`))];
}

async function writeChunk(res: Response, chunk: string): Promise<void> {
  if (res.write(chunk)) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      res.off('drain', onDrain);
      res.off('close', onClose);
      res.off('error', onError);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); reject(new Error('La descarga fue interrumpida por el cliente.')); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    res.once('drain', onDrain);
    res.once('close', onClose);
    res.once('error', onError);
  });
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (lineComment) {
      if (char === '\n') { lineComment = false; current += ' '; }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; current += ' '; }
      continue;
    }
    if (!singleQuoted && !doubleQuoted && char === '-' && next === '-') { lineComment = true; index += 1; continue; }
    if (!singleQuoted && !doubleQuoted && char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (singleQuoted) {
      current += char;
      if (char === "'" && next === "'") { current += next; index += 1; }
      else if (char === "'") singleQuoted = false;
      continue;
    }
    if (doubleQuoted) {
      current += char;
      if (char === '"' && next === '"') { current += next; index += 1; }
      else if (char === '"') doubleQuoted = false;
      continue;
    }
    if (char === "'") { singleQuoted = true; current += char; continue; }
    if (char === '"') { doubleQuoted = true; current += char; continue; }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (singleQuoted || doubleQuoted || blockComment) throw new Error('El archivo SQL tiene comillas o comentarios sin cerrar.');
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function decodeQuotedIdentifier(value: string): string | null {
  const match = /^"((?:[^"]|"")*)"$/.exec(value.trim());
  return match ? match[1].replaceAll('""', '"') : null;
}

function splitQuotedList(value: string): string[] {
  const items: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"' && quoted && value[index + 1] === '"') { index += 1; continue; }
    if (value[index] === '"') { quoted = !quoted; continue; }
    if (value[index] === ',' && !quoted) { items.push(value.slice(start, index).trim()); start = index + 1; }
  }
  items.push(value.slice(start).trim());
  return items;
}

function validateBackupValues(valueSql: string, expectedColumns: number): boolean {
  let index = 0;
  const skipWhitespace = () => { while (/\s/.test(valueSql[index] ?? '')) index += 1; };
  let tupleCount = 0;
  while (index < valueSql.length) {
    skipWhitespace();
    if (valueSql[index] !== '(') return false;
    index += 1;
    for (let column = 0; column < expectedColumns; column += 1) {
      skipWhitespace();
      if (valueSql[index] === "'") {
        index += 1;
        let closed = false;
        while (index < valueSql.length) {
          if (valueSql[index] === "'" && valueSql[index + 1] === "'") { index += 2; continue; }
          if (valueSql[index] === "'") { index += 1; closed = true; break; }
          index += 1;
        }
        if (!closed) return false;
      } else if (valueSql.slice(index, index + 4).toUpperCase() === 'NULL' && !/[A-Za-z0-9_]/.test(valueSql[index + 4] ?? '')) {
        index += 4;
      } else return false;
      skipWhitespace();
      if (column < expectedColumns - 1) {
        if (valueSql[index] !== ',') return false;
        index += 1;
      }
    }
    skipWhitespace();
    if (valueSql[index] !== ')') return false;
    index += 1;
    tupleCount += 1;
    skipWhitespace();
    if (index === valueSql.length) break;
    if (valueSql[index] !== ',') return false;
    index += 1;
  }
  return tupleCount > 0;
}

function parseBackupInsert(statement: string): { schema: string; table: string; columns: string[]; hasIdentityOverride: boolean } | null {
  const match = /^INSERT\s+INTO\s+("(?:[^"]|"")*")\s*\.\s*("(?:[^"]|"")*")\s*\(([\s\S]*?)\)(\s+OVERRIDING\s+SYSTEM\s+VALUE)?\s+VALUES\s+([\s\S]+)$/i.exec(statement);
  if (!match) return null;
  const schema = decodeQuotedIdentifier(match[1]);
  const table = decodeQuotedIdentifier(match[2]);
  const columns = splitQuotedList(match[3]).map(decodeQuotedIdentifier);
  if (!schema || !table || columns.some((column) => !column) || !validateBackupValues(match[5], columns.length)) return null;
  return { schema, table, columns: columns as string[], hasIdentityOverride: Boolean(match[4]) };
}

function parseBackupSequence(statement: string): { schema: string; name: string } | null {
  const match = /^SELECT\s+pg_catalog\.setval\('((?:''|[^'])*)'::regclass,\s*-?\d+,\s*(?:true|false)\s*\)$/i.exec(statement);
  if (!match) return null;
  const qualified = match[1].replaceAll("''", "'");
  const names = /^("(?:[^"]|"")*")\.("(?:[^"]|"")*")$/.exec(qualified);
  if (!names) return null;
  const schema = decodeQuotedIdentifier(names[1]);
  const name = decodeQuotedIdentifier(names[2]);
  return schema && name ? { schema, name } : null;
}

async function validateBackupFile(client: PoolClient, backupSql: string): Promise<{ statements: string[]; includeUsers: boolean }> {
  const includeUsers = backupSql.includes('-- SIES PostgreSQL full data-only backup; includes accounts and authentication tables');
  const operationalOnly = backupSql.includes('-- SIES PostgreSQL data-only backup; protected account tables are intentionally excluded');
  if (!includeUsers && !operationalOnly) {
    throw new Error('El archivo no fue generado por el módulo de respaldos de SIES.');
  }
  const statements = splitSqlStatements(backupSql);
  if (statements.length < 3 || statements[0].toUpperCase() !== 'BEGIN' || statements[1].toLowerCase() !== 'set standard_conforming_strings = on' || statements.at(-1)?.toUpperCase() !== 'COMMIT') {
    throw new Error('El respaldo SQL no tiene el formato esperado.');
  }
  const tables = (await listApplicationTables(client)).filter((table) => !shouldExcludeFromBackup(table, includeUsers));
  const tablesByName = new Map(tables.map((table) => [`${table.schema}.${table.name}`, table]));
  const schemas = [...new Set(tables.map((table) => table.schema))];
  const columns = await client.query<BackupColumn>(
    `SELECT table_schema, table_name, column_name, is_generated, is_identity
     FROM information_schema.columns
     WHERE table_schema = ANY($1::text[])
     ORDER BY table_schema, table_name, ordinal_position`,
    [schemas]
  );
  const columnsByTable = new Map<string, BackupColumn[]>();
  for (const column of columns.rows) {
    const key = `${column.table_schema}.${column.table_name}`;
    const current = columnsByTable.get(key) ?? [];
    current.push(column);
    columnsByTable.set(key, current);
  }
  const sequences = await client.query<BackupSequence>(
    `SELECT sequence_namespace.nspname AS schema, sequence.relname AS name,
            table_namespace.nspname AS table_schema, owned_table.relname AS table_name
     FROM pg_class sequence
     JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence.relnamespace
     JOIN pg_depend ownership ON ownership.objid = sequence.oid AND ownership.deptype IN ('a', 'i')
     JOIN pg_class owned_table ON owned_table.oid = ownership.refobjid
     JOIN pg_namespace table_namespace ON table_namespace.oid = owned_table.relnamespace
     WHERE sequence.relkind = 'S'
       AND sequence_namespace.nspname <> 'information_schema'
       AND sequence_namespace.nspname NOT LIKE 'pg_%'
       AND NOT (table_namespace.nspname = 'public' AND owned_table.relname = ANY($1::text[]))`,
    [includeUsers ? [...MIGRATION_PUBLIC_TABLES] : [...PRESERVED_PUBLIC_TABLES]]
  );
  const sequenceNames = new Set(sequences.rows.map((sequence) => `${sequence.schema}.${sequence.name}`));
  for (const statement of statements.slice(2, -1)) {
    const insert = parseBackupInsert(statement);
    if (insert) {
      const key = `${insert.schema}.${insert.table}`;
      const table = tablesByName.get(key);
      const tableColumns = columnsByTable.get(key) ?? [];
      const allowedColumns = new Set(tableColumns.filter((column) => column.is_generated === 'NEVER').map((column) => column.column_name));
      const hasIdentity = tableColumns.some((column) => column.is_identity === 'YES');
      if (!table || insert.columns.some((column) => !allowedColumns.has(column)) || new Set(insert.columns).size !== insert.columns.length || (insert.hasIdentityOverride && !hasIdentity)) {
        throw new Error(`El respaldo intenta escribir en una tabla o columna protegida: ${key}.`);
      }
      continue;
    }
    const sequence = parseBackupSequence(statement);
    if (!sequence || !sequenceNames.has(`${sequence.schema}.${sequence.name}`)) {
      throw new Error('El respaldo contiene una instrucción SQL no permitida o no reconocida.');
    }
  }
  return { statements, includeUsers };
}

export async function resetDatabaseData(req: Request, res: Response, next: NextFunction): Promise<void> {
  let client: PoolClient | null = null;
  let transactionStarted = false;
  try {
    client = await getClient();
    await client.query('BEGIN');
    transactionStarted = true;
    const clearedTables = await truncateApplicationData(client);
    await writeResetAudit(client, req, 'database.data_reset', { clearedTables: clearedTables.length, preservedTables: [...PRESERVED_PUBLIC_TABLES] });
    await client.query('COMMIT');
    transactionStarted = false;
    res.status(200).json({ success: true, clearedTableCount: clearedTables.length, preservedTables: ['users', 'roles', 'user_roles', 'refresh_tokens', 'enumerators'] });
  } catch (error) {
    if (transactionStarted && client) await client.query('ROLLBACK').catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
}

export async function restoreDatabaseBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (typeof req.body !== 'string' || req.body.length === 0) {
    res.status(400).json({ success: false, message: 'Selecciona un archivo SQL de respaldo.', code: 'BACKUP_FILE_REQUIRED' });
    return;
  }
  let client: PoolClient | null = null;
  let transactionStarted = false;
  try {
    client = await getClient();
    let statements: string[];
    let includeUsers = false;
    try {
      const backup = await validateBackupFile(client, req.body);
      statements = backup.statements;
      includeUsers = backup.includeUsers;
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'El archivo SQL no es un respaldo válido de SIES.',
        code: 'INVALID_BACKUP_FILE',
      });
      return;
    }
    await client.query('BEGIN');
    transactionStarted = true;
    const clearedTables = await truncateApplicationData(client, includeUsers);
    for (const statement of statements.slice(2, -1)) await client.query(statement);
    await writeResetAudit(
      client,
      req,
      includeUsers ? 'database.full_backup_restored' : 'database.backup_restored',
      { clearedTables: clearedTables.length, format: includeUsers ? 'sql-full-data' : 'sql-data-only', requestedByUserId: req.user!.userId },
      includeUsers ? null : req.user!.userId
    );
    await client.query('COMMIT');
    transactionStarted = false;
    res.status(200).json({ success: true, restoredStatementCount: statements.length - 3, clearedTableCount: clearedTables.length, includesUsers: includeUsers });
  } catch (error) {
    if (transactionStarted && client) await client.query('ROLLBACK').catch(() => undefined);
    next(error);
  } finally {
    client?.release();
  }
}

async function streamDatabaseBackup(req: Request, res: Response, next: NextFunction, includeUsers: boolean): Promise<void> {
  let client: PoolClient | null = null;
  let transactionStarted = false;
  try {
    await writeAuditEvent(req, {
      action: includeUsers ? 'database.full_backup_downloaded' : 'database.backup_downloaded',
      entityType: 'database',
      changes: { format: includeUsers ? 'sql-full-data' : 'sql-data-only' },
    });
    client = await getClient();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transactionStarted = true;

    const tables = (await listApplicationTables(client)).filter((table) => !shouldExcludeFromBackup(table, includeUsers));
    const schemas = [...new Set(tables.map((table) => table.schema))];
    const [columnResult, primaryKeyResult, foreignKeyResult] = await Promise.all([
      client.query<BackupColumn>(
        `SELECT table_schema, table_name, column_name, is_generated, is_identity
         FROM information_schema.columns
         WHERE table_schema = ANY($1::text[])
         ORDER BY table_schema, table_name, ordinal_position`,
        [schemas]
      ),
      client.query<{ table_oid: string; column_name: string; ordinal: number }>(
        `SELECT index.indrelid::text AS table_oid, attribute.attname AS column_name,
                key_column.ordinality::integer AS ordinal
         FROM pg_index index
         CROSS JOIN LATERAL unnest(index.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
         JOIN pg_attribute attribute ON attribute.attrelid = index.indrelid AND attribute.attnum = key_column.attnum
         WHERE index.indisprimary AND key_column.ordinality <= index.indnkeyatts
         ORDER BY index.indrelid, key_column.ordinality`
      ),
      client.query<{ child_oid: string; parent_oid: string }>(
        `SELECT conrelid::text AS child_oid, confrelid::text AS parent_oid
         FROM pg_constraint WHERE contype = 'f'`
      ),
    ]);
    const columnsByTable = new Map<string, BackupColumn[]>();
    for (const column of columnResult.rows) {
      const key = `${column.table_schema}.${column.table_name}`;
      const columns = columnsByTable.get(key) ?? [];
      columns.push(column);
      columnsByTable.set(key, columns);
    }
    const primaryKeys = new Map<string, string[]>();
    for (const keyColumn of primaryKeyResult.rows) {
      const columns = primaryKeys.get(keyColumn.table_oid) ?? [];
      columns.push(keyColumn.column_name);
      primaryKeys.set(keyColumn.table_oid, columns);
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sies-database-${includeUsers ? 'full-' : ''}backup-${new Date().toISOString().slice(0, 10)}.sql"`);
    res.setHeader('Cache-Control', 'no-store, private');
    const backupHeader = includeUsers
      ? '-- SIES PostgreSQL full data-only backup; includes accounts and authentication tables'
      : '-- SIES PostgreSQL data-only backup; protected account tables are intentionally excluded';
    const restoreNote = includeUsers
      ? '-- This restore replaces users and authentication records; sign in afterward with an account from this backup'
      : '-- This restore keeps users and authentication records in the target database';
    await writeChunk(res, `${backupHeader}\n-- Generated at ${new Date().toISOString()}\n${restoreNote}\n-- Restore into a database with the matching schema\n\nBEGIN;\nSET standard_conforming_strings = on;\n\n`);

    const orderedTables = orderTables(tables, foreignKeyResult.rows);
    let offset = 0;
    const batchSize = 100;
    for (const table of orderedTables) {
      const tableColumns = (columnsByTable.get(`${table.schema}.${table.name}`) ?? []).filter((column) => column.is_generated === 'NEVER');
      if (!tableColumns.length) continue;
      const columnNames = tableColumns.map((column) => column.column_name);
      const qualifiedName = `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`;
      const quotedColumns = columnNames.map(quoteIdentifier).join(', ');
      const orderColumns = (primaryKeys.get(table.oid) ?? []).map(quoteIdentifier);
      const orderSql = orderColumns.length ? ` ORDER BY ${orderColumns.join(', ')}` : '';
      const overridingSystemValue = tableColumns.some((column) => column.is_identity === 'YES') ? ' OVERRIDING SYSTEM VALUE' : '';
      offset = 0;
      for (;;) {
        const selectColumns = columnNames.map((column) => `${quoteIdentifier(column)}::text AS ${quoteIdentifier(column)}`).join(', ');
        const result = await client.query<Record<string, string | null>>(
          `SELECT ${selectColumns} FROM ${qualifiedName}${orderSql} LIMIT $1 OFFSET $2`,
          [batchSize, offset]
        );
        if (!result.rows.length) break;
        const valueRows = result.rows.map((row) => `(${columnNames.map((column) => {
          const value = row[column];
          return value === null ? 'NULL' : quoteLiteral(value);
        }).join(', ')})`);
        await writeChunk(res, `-- Data for ${table.schema}.${table.name}\nINSERT INTO ${qualifiedName} (${quotedColumns})${overridingSystemValue} VALUES\n${valueRows.join(',\n')};\n\n`);
        offset += result.rows.length;
        if (result.rows.length < batchSize) break;
      }
    }

    const sequenceResult = await client.query<BackupSequence>(
      `SELECT sequence_namespace.nspname AS schema, sequence.relname AS name,
              table_namespace.nspname AS table_schema, owned_table.relname AS table_name
       FROM pg_class sequence
       JOIN pg_namespace sequence_namespace ON sequence_namespace.oid = sequence.relnamespace
       JOIN pg_depend ownership ON ownership.objid = sequence.oid AND ownership.deptype IN ('a', 'i')
       JOIN pg_class owned_table ON owned_table.oid = ownership.refobjid
       JOIN pg_namespace table_namespace ON table_namespace.oid = owned_table.relnamespace
       WHERE sequence.relkind = 'S'
         AND sequence_namespace.nspname <> 'information_schema'
         AND sequence_namespace.nspname NOT LIKE 'pg_%'
         AND NOT (table_namespace.nspname = 'public' AND owned_table.relname = ANY($1::text[]))
       ORDER BY sequence_namespace.nspname, sequence.relname`,
      [includeUsers ? [...MIGRATION_PUBLIC_TABLES] : [...PRESERVED_PUBLIC_TABLES]]
    );
    for (const sequence of sequenceResult.rows) {
      const qualifiedSequence = `${quoteIdentifier(sequence.schema)}.${quoteIdentifier(sequence.name)}`;
      const state = await client.query<{ last_value: string; is_called: boolean }>(`SELECT last_value::text, is_called FROM ${qualifiedSequence}`);
      const regclass = `${quoteIdentifier(sequence.schema)}.${quoteIdentifier(sequence.name)}`;
      await writeChunk(res, `SELECT pg_catalog.setval(${quoteLiteral(regclass)}::regclass, ${state.rows[0].last_value}, ${state.rows[0].is_called ? 'true' : 'false'});\n`);
    }

    await client.query('COMMIT');
    transactionStarted = false;
    res.end('\nCOMMIT;\n');
  } catch (error) {
    if (transactionStarted && client) await client.query('ROLLBACK').catch(() => undefined);
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    next(error);
  } finally {
    client?.release();
  }
}

export async function downloadDatabaseBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
  await streamDatabaseBackup(req, res, next, false);
}

export async function downloadFullDatabaseBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
  await streamDatabaseBackup(req, res, next, true);
}
