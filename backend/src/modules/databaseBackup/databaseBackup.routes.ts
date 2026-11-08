import { Router } from 'express';
import express from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { downloadDatabaseBackup, downloadFullDatabaseBackup, resetDatabaseData, restoreDatabaseBackup } from './databaseBackup.controller';

export const databaseBackupRouter = Router();
databaseBackupRouter.use(authenticate);
databaseBackupRouter.get('/', authorize(['ADMIN']), downloadDatabaseBackup);
databaseBackupRouter.get('/full', authorize(['ADMIN']), downloadFullDatabaseBackup);
databaseBackupRouter.post('/reset', authorize(['ADMIN']), resetDatabaseData);
databaseBackupRouter.post('/restore', authorize(['ADMIN']), express.text({ type: 'application/sql', limit: '50mb' }), restoreDatabaseBackup);
