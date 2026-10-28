import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/pool';
import type { InterviewInput } from './interviews.validators';

interface InterviewRow {
  id: string;
  device_uuid: string;
  folio: string | null;
  survey_id: string;
  survey_title: string;
  department: string;
  municipality: string;
  enumerator_alias: string;
  community: string;
  age_group: string;
  gender: string;
  latitude: string | number | null;
  longitude: string | number | null;
  accuracy: string | number | null;
  interviewed_at: Date;
  sync_status: string;
  answers: Array<{ questionId: string; questionTitle: string; answerText: string }>;
}

interface QuestionRow {
  id: string;
  question_text: string;
  question_type: string;
  version_number: number;
  is_required: boolean;
  option_id: string | null;
  option_text: string | null;
  allows_other_text: boolean;
  sort_order: number;
}

export class InterviewSubmissionError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = 'InterviewSubmissionError';
  }
}

function mapInterview(row: InterviewRow) {
  const folio = row.folio || row.device_uuid;
  const sequence = Number(folio.match(/-(\d+)$/)?.[1] ?? 0);
  return {
    id: folio,
    surveyId: row.survey_id,
    surveyTitle: row.survey_title,
    enumeratorAlias: row.enumerator_alias,
    surveyNumber: sequence,
    department: row.department,
    municipality: row.municipality,
    community: row.community,
    ageGroup: row.age_group,
    gender: row.gender,
    lat: Number(row.latitude ?? 0),
    lng: Number(row.longitude ?? 0),
    accuracy: Number(row.accuracy ?? 0),
    timestamp: row.interviewed_at.toISOString(),
    status: row.sync_status === 'synced' ? 'synced' as const : 'pending' as const,
    answers: row.answers,
  };
}

export class InterviewsService {
  async list(userId: string, roles: string[]) {
    const canViewAll = roles.includes('ADMIN') || roles.includes('SUPERVISOR');
    const result = await query<InterviewRow>(
      `SELECT i.id, i.device_uuid, i.device_info->>'folio' AS folio,
              i.survey_id, s.name AS survey_title, d.name AS department,
              m.name AS municipality, u.username AS enumerator_alias,
              c.name AS community,
              COALESCE(i.device_info->>'ageGroup', '') AS age_group,
              COALESCE(i.device_info->>'gender', '') AS gender,
              i.latitude, i.longitude, i.gps_accuracy_meters AS accuracy,
              i.interviewed_at_device AS interviewed_at, i.sync_status::text AS sync_status,
              COALESCE(
                json_agg(json_build_object(
                  'questionId', q.id,
                  'questionTitle', q.question_text,
                  'answerText', COALESCE(
                    selected.answer_text,
                    a.text_value,
                    CASE WHEN a.numeric_value IS NOT NULL THEN a.numeric_value::text || ' estrellas' END,
                    a.date_value::text,
                    'Sin respuesta'
                  )
                ) ORDER BY q.sort_order) FILTER (WHERE a.id IS NOT NULL),
                '[]'::json
              ) AS answers
       FROM interviews i
       JOIN surveys s ON s.id = i.survey_id
       JOIN municipalities m ON m.id = s.municipality_id
       JOIN departments d ON d.id = m.department_id
       JOIN enumerators e ON e.id = i.enumerator_id
       JOIN users u ON u.id = e.user_id
       JOIN communities c ON c.id = i.community_id
       LEFT JOIN answers a ON a.interview_id = i.id
       LEFT JOIN survey_questions q ON q.id = a.question_id
       LEFT JOIN LATERAL (
         SELECT string_agg(
                  o.option_text || CASE WHEN aos.other_text IS NOT NULL AND aos.other_text <> '' THEN ': ' || aos.other_text ELSE '' END,
                  ', ' ORDER BY o.sort_order
                ) AS answer_text
         FROM answer_option_selections aos
         JOIN question_options o ON o.id = aos.option_id
         WHERE aos.answer_id = a.id
       ) selected ON TRUE
       WHERE ($2::boolean OR e.user_id = $1)
       GROUP BY i.id, s.name, d.name, m.name, u.username, c.name
       ORDER BY i.interviewed_at_device DESC, i.created_at DESC`,
      [userId, canViewAll]
    );
    return result.rows.map(mapInterview);
  }

  async create(input: InterviewInput, userId: string, roles: string[]) {
    return withTransaction(async (client) => {
      const isAdmin = roles.includes('ADMIN');
      const assignmentResult = await client.query<{
        assignment_id: string;
        enumerator_id: string;
        community_id: string;
        survey_version_id: string;
        version_number: number;
      }>(
        `SELECT a.id AS assignment_id, a.enumerator_id, a.community_id,
                sv.id AS survey_version_id, s.current_version AS version_number
         FROM survey_assignments a
         JOIN surveys s ON s.id = a.survey_id AND s.status = 'active'
         JOIN survey_versions sv ON sv.survey_id = s.id AND sv.version_number = s.current_version
         JOIN enumerators e ON e.id = a.enumerator_id
         WHERE a.survey_id = $1 AND a.community_id = $2
           AND a.status IN ('pending', 'active')
           AND ($3::boolean OR e.user_id = $4)
         LIMIT 1`,
        [input.surveyId, input.communityId, isAdmin, userId]
      );
      if (!assignmentResult.rowCount) {
        throw new InterviewSubmissionError(
          'No tienes una asignación activa para esta comunidad y encuesta.',
          403,
          'ASSIGNMENT_NOT_AVAILABLE'
        );
      }
      const assignment = assignmentResult.rows[0];

      const questionResult = await client.query<QuestionRow>(
        `SELECT q.id, q.question_text, q.question_type::text AS question_type,
                q.version_number, q.is_required, q.sort_order,
                o.id AS option_id, o.option_text, o.allows_other_text
         FROM survey_questions q
         LEFT JOIN question_options o ON o.question_id = q.id AND o.is_active = TRUE
         WHERE q.survey_id = $1 AND q.version_number = $2 AND q.is_active = TRUE
         ORDER BY q.sort_order, o.sort_order`,
        [input.surveyId, assignment.version_number]
      );

      const questions = new Map<string, { question: QuestionRow; options: QuestionRow[] }>();
      for (const row of questionResult.rows) {
        const group = questions.get(row.id) ?? { question: row, options: [] };
        if (row.option_id) group.options.push(row);
        questions.set(row.id, group);
      }
      const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.answerText.trim()]));
      for (const answerQuestionId of answerMap.keys()) {
        if (!questions.has(answerQuestionId)) {
          throw new InterviewSubmissionError('Una respuesta pertenece a una pregunta que no está en esta versión de la encuesta.', 400, 'QUESTION_NOT_IN_SURVEY');
        }
      }
      for (const { question } of questions.values()) {
        const answer = answerMap.get(question.id);
        if (question.is_required && (!answer || answer === 'Sin respuesta')) {
          throw new InterviewSubmissionError(`La pregunta “${question.question_text}” requiere una respuesta.`, 400, 'REQUIRED_ANSWER_MISSING');
        }
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO interviews (
           device_uuid, survey_id, survey_version_id, assignment_id,
           enumerator_id, community_id, status, sync_status,
           interviewed_at_device, received_at_server,
           latitude, longitude, gps_accuracy_meters, gps_captured_at,
           gps_source, gps_status, device_info, survey_version_used
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, 'completed', 'synced',
           $7, NOW(), $8, $9, $10, NOW(), 'gps', 'ok', $11::jsonb, $12
         )
         ON CONFLICT (device_uuid) DO NOTHING
         RETURNING id`,
        [
          input.deviceUuid,
          input.surveyId,
          assignment.survey_version_id,
          assignment.assignment_id,
          assignment.enumerator_id,
          assignment.community_id,
          input.interviewedAt,
          input.latitude,
          input.longitude,
          input.accuracy,
          JSON.stringify({ folio: input.folio, ageGroup: input.ageGroup, gender: input.gender }),
          assignment.version_number,
        ]
      );

      if (!inserted.rowCount) {
        const existing = await client.query<{ id: string }>(`SELECT id FROM interviews WHERE device_uuid = $1`, [input.deviceUuid]);
        return { id: existing.rows[0].id, duplicate: true };
      }

      const interviewId = inserted.rows[0].id;
      for (const { question, options } of questions.values()) {
        const answerText = answerMap.get(question.id);
        if (!answerText || answerText === 'Sin respuesta') continue;

        if (question.question_type === 'short_text' || question.question_type === 'long_text') {
          await client.query(
            `INSERT INTO answers (interview_id, question_id, question_version, text_value)
             VALUES ($1, $2, $3, $4)`,
            [interviewId, question.id, question.version_number, answerText]
          );
          continue;
        }

        if (['integer', 'decimal', 'age'].includes(question.question_type)) {
          const numericAnswer = Number(answerText.match(/-?\d+(?:\.\d+)?/)?.[0]);
          if (!Number.isFinite(numericAnswer)) {
            throw new InterviewSubmissionError(`La respuesta de “${question.question_text}” debe ser numérica.`, 400, 'INVALID_NUMERIC_ANSWER');
          }
          await client.query(
            `INSERT INTO answers (interview_id, question_id, question_version, numeric_value)
             VALUES ($1, $2, $3, $4)`,
            [interviewId, question.id, question.version_number, numericAnswer]
          );
          continue;
        }

        const selectedOption = options.find((option) =>
          answerText === option.option_text ||
          (option.allows_other_text && answerText.startsWith(`${option.option_text}:`))
        );
        if (!selectedOption?.option_id) {
          await client.query(
            `INSERT INTO answers (interview_id, question_id, question_version, text_value)
             VALUES ($1, $2, $3, $4)`,
            [interviewId, question.id, question.version_number, answerText]
          );
          continue;
        }

        const answerRow = await client.query<{ id: string }>(
          `INSERT INTO answers (interview_id, question_id, question_version)
           VALUES ($1, $2, $3) RETURNING id`,
          [interviewId, question.id, question.version_number]
        );
        const otherText = selectedOption.allows_other_text && answerText.includes(':')
          ? answerText.slice(answerText.indexOf(':') + 1).trim()
          : null;
        await client.query(
          `INSERT INTO answer_option_selections (answer_id, option_id, other_text)
           VALUES ($1, $2, $3)`,
          [answerRow.rows[0].id, selectedOption.option_id, otherText]
        );
      }

      return { id: interviewId, duplicate: false };
    });
  }
}

export const interviewsService = new InterviewsService();
