"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentsService = void 0;
const pool_1 = require("../../database/pool");
const crypto_1 = require("crypto");
async function findEnumerator(client, alias) {
    const result = await client.query(`SELECT e.id FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.name = 'ENUMERATOR'
     JOIN enumerators e ON e.user_id = u.id
     WHERE LOWER(u.username) = LOWER($1) AND u.is_active = TRUE`, [alias]);
    return result.rows[0]?.id ?? null;
}
exports.assignmentsService = {
    async reassign(surveyId, communityId, name, alias, quota, assignedBy) {
        return (0, pool_1.withTransaction)(async (client) => {
            const survey = await client.query('SELECT status FROM surveys WHERE id = $1 FOR UPDATE', [surveyId]);
            if (!survey.rowCount)
                return { kind: 'survey_missing' };
            if (survey.rows[0].status === 'archived' || survey.rows[0].status === 'finished') {
                return { kind: 'survey_closed' };
            }
            const community = await client.query(`SELECT c.id, c.name FROM communities c
         JOIN survey_assignments a ON a.community_id = c.id
         WHERE a.survey_id = $1 AND c.id = $2 AND a.status IN ('pending', 'active', 'completed')
         LIMIT 1`, [surveyId, communityId]);
            if (!community.rowCount)
                return { kind: 'community_missing' };
            const enumeratorId = await findEnumerator(client, alias);
            if (!enumeratorId)
                return { kind: 'enumerator_missing' };
            const existing = await client.query(`SELECT id, status FROM survey_assignments
         WHERE survey_id = $1 AND community_id = $2 AND enumerator_id = $3`, [surveyId, communityId, enumeratorId]);
            if (existing.rows[0]?.status === 'completed')
                return { kind: 'assignment_completed' };
            await client.query(`UPDATE survey_assignments SET status = 'cancelled'
         WHERE survey_id = $1 AND community_id = $2 AND status IN ('pending', 'active')
           AND enumerator_id <> $3`, [surveyId, communityId, enumeratorId]);
            await client.query(`INSERT INTO survey_assignments (survey_id, community_id, community_name, enumerator_id, assigned_by, interview_goal, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::assignment_status)
         ON CONFLICT (survey_id, community_id, enumerator_id)
         DO UPDATE SET community_name = EXCLUDED.community_name,
                       interview_goal = EXCLUDED.interview_goal,
                       status = CASE WHEN survey_assignments.status = 'completed'
                         THEN 'completed'::assignment_status ELSE EXCLUDED.status END`, [surveyId, communityId, name, enumeratorId, assignedBy, quota,
                survey.rows[0].status === 'active' ? 'active' : 'pending']);
            return { kind: 'ok', community: name };
        });
    },
    async create(surveyId, name, alias, quota, assignedBy) {
        return (0, pool_1.withTransaction)(async (client) => {
            const survey = await client.query('SELECT status, municipality_id FROM surveys WHERE id = $1 FOR UPDATE', [surveyId]);
            if (!survey.rowCount)
                return { kind: 'survey_missing' };
            if (survey.rows[0].status === 'archived' || survey.rows[0].status === 'finished')
                return { kind: 'survey_closed' };
            const enumeratorId = await findEnumerator(client, alias);
            if (!enumeratorId)
                return { kind: 'enumerator_missing' };
            const duplicate = await client.query(`SELECT 1 FROM survey_assignments a JOIN communities c ON c.id = a.community_id
         WHERE a.survey_id = $1 AND LOWER(COALESCE(a.community_name, c.name)) = LOWER($2)
         AND a.status IN ('pending', 'active', 'completed') LIMIT 1`, [surveyId, name]);
            if (duplicate.rowCount)
                return { kind: 'duplicate_community' };
            const community = await client.query(`INSERT INTO communities (municipality_id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (municipality_id, name) DO UPDATE SET is_active = TRUE
         RETURNING id`, [survey.rows[0].municipality_id, name, `COM-${(0, crypto_1.randomUUID)().replaceAll('-', '').slice(0, 16)}`]);
            const status = survey.rows[0].status === 'active' ? 'active' : 'pending';
            const assignment = await client.query(`INSERT INTO survey_assignments (survey_id, community_id, community_name, enumerator_id, assigned_by, interview_goal, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7::assignment_status) RETURNING id`, [surveyId, community.rows[0].id, name, enumeratorId, assignedBy, quota, status]);
            return { kind: 'ok', id: community.rows[0].id, assignmentId: assignment.rows[0].id, assignedTo: alias, quota, name };
        });
    },
};
//# sourceMappingURL=assignments.service.js.map