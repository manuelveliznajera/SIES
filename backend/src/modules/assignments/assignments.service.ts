import { withTransaction } from '../../database/pool';
import { randomUUID } from 'crypto';

async function findEnumerator(client: import('pg').PoolClient, alias: string): Promise<string | null> {
  const result = await client.query<{ id: string }>(
    `SELECT e.id FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.name = 'ENUMERATOR'
     JOIN enumerators e ON e.user_id = u.id
     WHERE LOWER(u.username) = LOWER($1) AND u.is_active = TRUE`, [alias]
  );
  return result.rows[0]?.id ?? null;
}

export const assignmentsService = {
  async listSurveyAssignments(surveyId: string) {
    return withTransaction(async (client) => {
      const survey = await client.query<{ id: string }>('SELECT id FROM surveys WHERE id = $1', [surveyId]);
      if (!survey.rowCount) return { kind: 'survey_missing' as const };

      const result = await client.query<{
        assignment_id: string;
        community_id: string;
        community: string;
        assigned_to: string;
        quota: number;
        status: string;
        completed_interviews: number;
      }>(
        `SELECT a.id AS assignment_id, c.id AS community_id,
                COALESCE(NULLIF(a.community_name, ''), c.name) AS community,
                u.username AS assigned_to, a.interview_goal AS quota,
                a.status::text AS status,
                COUNT(i.id) FILTER (WHERE i.status = 'completed')::integer AS completed_interviews
         FROM survey_assignments a
         JOIN communities c ON c.id = a.community_id
         JOIN enumerators e ON e.id = a.enumerator_id
         JOIN users u ON u.id = e.user_id
         LEFT JOIN interviews i ON i.assignment_id = a.id
         WHERE a.survey_id = $1
         GROUP BY a.id, c.id, c.name, u.username
         ORDER BY LOWER(COALESCE(NULLIF(a.community_name, ''), c.name)),
                  CASE a.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
                  u.username`,
        [surveyId]
      );

      const assignments = result.rows.map((row) => ({
        assignmentId: row.assignment_id,
        communityId: row.community_id,
        community: row.community,
        assignedTo: row.assigned_to,
        quota: row.quota,
        status: row.status,
        completedInterviews: row.completed_interviews,
      }));
      const totalAssignedQuota = assignments.reduce(
        (total, assignment) => total + (['pending', 'active', 'completed'].includes(assignment.status) ? assignment.quota : 0),
        0
      );
      return { kind: 'ok' as const, assignments, totalAssignedQuota };
    });
  },

  async removeCommunityFromSurvey(surveyId: string, communityId: string) {
    return withTransaction(async (client) => {
      const survey = await client.query<{ id: string }>('SELECT id FROM surveys WHERE id = $1 FOR UPDATE', [surveyId]);
      if (!survey.rowCount) return { kind: 'survey_missing' as const };

      const assignments = await client.query<{ id: string }>(
        `SELECT id FROM survey_assignments
         WHERE survey_id = $1 AND community_id = $2
           AND status IN ('pending', 'active', 'completed')
         ORDER BY id
         FOR UPDATE`,
        [surveyId, communityId]
      );
      if (!assignments.rowCount) return { kind: 'assignment_missing' as const };

      const assignmentIds = assignments.rows.map((assignment) => assignment.id);
      await client.query(
        `UPDATE survey_assignments SET status = 'cancelled'
         WHERE id = ANY($1::uuid[])`,
        [assignmentIds]
      );
      return { kind: 'ok' as const, cancelledAssignmentCount: assignmentIds.length };
    });
  },

  async updateQuota(surveyId: string, communityId: string, quota: number) {
    return withTransaction(async (client) => {
      const survey = await client.query<{ status: string }>('SELECT status FROM surveys WHERE id = $1 FOR UPDATE', [surveyId]);
      if (!survey.rowCount) return { kind: 'survey_missing' as const };
      if (survey.rows[0].status === 'archived') return { kind: 'survey_closed' as const };

      const assignment = await client.query<{ id: string; status: string }>(
        `SELECT id, status
         FROM survey_assignments
         WHERE survey_id = $1 AND community_id = $2
           AND status IN ('pending', 'active', 'completed')
         ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [surveyId, communityId]
      );
      if (!assignment.rowCount) return { kind: 'community_missing' as const };

      const completed = await client.query<{ count: number }>(
        'SELECT COUNT(*)::integer AS count FROM interviews WHERE assignment_id = $1',
        [assignment.rows[0].id]
      );
      const shouldReactivate = assignment.rows[0].status === 'completed'
        && survey.rows[0].status === 'active'
        && quota > Number(completed.rows[0]?.count ?? 0);
      const status = shouldReactivate ? 'active' : assignment.rows[0].status;
      await client.query(
        'UPDATE survey_assignments SET interview_goal = $2, status = $3::assignment_status WHERE id = $1',
        [assignment.rows[0].id, quota, status]
      );
      return { kind: 'ok' as const, quota, status };
    });
  },

  async reassign(surveyId: string, communityId: string, name: string, alias: string, quota: number, assignedBy: string) {
    return withTransaction(async (client) => {
      const survey = await client.query<{ status: string }>('SELECT status FROM surveys WHERE id = $1 FOR UPDATE', [surveyId]);
      if (!survey.rowCount) return { kind: 'survey_missing' as const };
      if (survey.rows[0].status === 'archived' || survey.rows[0].status === 'finished') {
        return { kind: 'survey_closed' as const };
      }

      const community = await client.query<{ id: string; name: string }>(
        `SELECT c.id, c.name FROM communities c
         JOIN survey_assignments a ON a.community_id = c.id
         WHERE a.survey_id = $1 AND c.id = $2 AND a.status IN ('pending', 'active', 'completed')
         LIMIT 1`, [surveyId, communityId]
      );
      if (!community.rowCount) return { kind: 'community_missing' as const };

      const enumeratorId = await findEnumerator(client, alias);
      if (!enumeratorId) return { kind: 'enumerator_missing' as const };

      const existing = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM survey_assignments
         WHERE survey_id = $1 AND community_id = $2 AND enumerator_id = $3`,
        [surveyId, communityId, enumeratorId]
      );
      if (existing.rows[0]?.status === 'completed') return { kind: 'assignment_completed' as const };

      await client.query(
        `UPDATE survey_assignments SET status = 'cancelled'
         WHERE survey_id = $1 AND community_id = $2 AND status IN ('pending', 'active')
           AND enumerator_id <> $3`, [surveyId, communityId, enumeratorId]
      );
      await client.query(
        `INSERT INTO survey_assignments (survey_id, community_id, community_name, enumerator_id, assigned_by, interview_goal, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::assignment_status)
         ON CONFLICT (survey_id, community_id, enumerator_id)
         DO UPDATE SET community_name = EXCLUDED.community_name,
                       interview_goal = EXCLUDED.interview_goal,
                       status = CASE WHEN survey_assignments.status = 'completed'
                         THEN 'completed'::assignment_status ELSE EXCLUDED.status END`,
        [surveyId, communityId, name, enumeratorId, assignedBy, quota,
          survey.rows[0].status === 'active' ? 'active' : 'pending']
      );

      return { kind: 'ok' as const, community: name };
    });
  },

  async create(surveyId: string, name: string, alias: string, quota: number, assignedBy: string) {
    return withTransaction(async (client) => {
      const survey = await client.query<{ status: string; municipality_id: string }>(
        'SELECT status, municipality_id FROM surveys WHERE id = $1 FOR UPDATE', [surveyId]
      );
      if (!survey.rowCount) return { kind: 'survey_missing' as const };
      if (survey.rows[0].status === 'archived' || survey.rows[0].status === 'finished') return { kind: 'survey_closed' as const };
      const enumeratorId = await findEnumerator(client, alias);
      if (!enumeratorId) return { kind: 'enumerator_missing' as const };

      const duplicate = await client.query(
        `SELECT 1 FROM survey_assignments a JOIN communities c ON c.id = a.community_id
         WHERE a.survey_id = $1 AND LOWER(COALESCE(a.community_name, c.name)) = LOWER($2)
         AND a.status IN ('pending', 'active', 'completed') LIMIT 1`, [surveyId, name]
      );
      if (duplicate.rowCount) return { kind: 'duplicate_community' as const };

      const community = await client.query<{ id: string }>(
        `INSERT INTO communities (municipality_id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (municipality_id, name) DO UPDATE SET is_active = TRUE
         RETURNING id`, [survey.rows[0].municipality_id, name, `COM-${randomUUID().replaceAll('-', '').slice(0, 16)}`]
      );
      const status = survey.rows[0].status === 'active' ? 'active' : 'pending';
      const assignment = await client.query<{ id: string }>(
        `INSERT INTO survey_assignments (survey_id, community_id, community_name, enumerator_id, assigned_by, interview_goal, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::assignment_status)
         ON CONFLICT (survey_id, community_id, enumerator_id)
         DO UPDATE SET community_name = EXCLUDED.community_name,
                       assigned_by = EXCLUDED.assigned_by,
                       interview_goal = EXCLUDED.interview_goal,
                       status = EXCLUDED.status
         RETURNING id`,
        [surveyId, community.rows[0].id, name, enumeratorId, assignedBy, quota, status]
      );
      return { kind: 'ok' as const, id: community.rows[0].id, assignmentId: assignment.rows[0].id, assignedTo: alias, quota, name };
    });
  },
};
