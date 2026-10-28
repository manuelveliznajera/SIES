"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.surveysService = exports.SurveysService = void 0;
const crypto_1 = require("crypto");
const pool_1 = require("../../database/pool");
const SURVEY_SELECT = `
  SELECT s.id, s.name, d.name AS department, m.name AS municipality,
         s.status, to_char(s.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(s.end_date, 'YYYY-MM-DD') AS end_date, s.current_version,
         COALESCE((s.privacy_config->>'targetSample')::integer, 0) AS target_sample,
         (SELECT COUNT(*)::integer FROM interviews i WHERE i.survey_id = s.id) AS collected_sample
  FROM surveys s
  JOIN municipalities m ON m.id = s.municipality_id
  JOIN departments d ON d.id = m.department_id`;
function frontendStatus(status) {
    if (status === 'finished')
        return 'completed';
    if (status === 'active')
        return 'active';
    return 'draft';
}
function databaseStatus(status) {
    return status === 'completed' ? 'finished' : status;
}
function frontendQuestionType(type) {
    if (type === 'multiple_choice')
        return 'multiple';
    if (type === 'short_text' || type === 'long_text')
        return 'text';
    if (type === 'integer' || type === 'decimal' || type === 'age' || type === 'date')
        return 'rating';
    return 'single';
}
function databaseQuestionType(type) {
    if (type === 'multiple')
        return 'multiple_choice';
    if (type === 'text')
        return 'short_text';
    if (type === 'rating')
        return 'integer';
    return 'single_choice';
}
function newCommunityCode() {
    return `COM-${(0, crypto_1.randomUUID)().replaceAll('-', '').slice(0, 16)}`;
}
class SurveysService {
    async list(userId, roles) {
        const isAdmin = roles.includes('ADMIN');
        const isEnumerator = roles.includes('ENUMERATOR');
        const surveyResult = await (0, pool_1.query)(`${SURVEY_SELECT}
       WHERE s.status <> 'archived'
         AND ($2::boolean OR (
           s.status = 'active'
           AND (NOT $3::boolean OR EXISTS (
             SELECT 1
             FROM survey_assignments viewer_assignment
             JOIN enumerators viewer_enumerator
               ON viewer_enumerator.id = viewer_assignment.enumerator_id
             WHERE viewer_assignment.survey_id = s.id
               AND viewer_enumerator.user_id = $1
               AND viewer_assignment.status IN ('pending', 'active')
           ))
         ))
       ORDER BY s.created_at DESC, s.name`, [userId, isAdmin, isEnumerator]);
        if (!surveyResult.rows.length)
            return [];
        const surveyIds = surveyResult.rows.map((survey) => survey.id);
        const [questionResult, communityResult] = await Promise.all([
            (0, pool_1.query)(`SELECT q.id, q.survey_id, q.question_text, q.question_type,
                q.is_required, q.sort_order,
                COALESCE(
                  json_agg(json_build_object(
                    'id', o.id, 'text', o.option_text, 'color', o.color,
                    'allowsOtherText', o.allows_other_text
                  ) ORDER BY o.sort_order) FILTER (WHERE o.id IS NOT NULL),
                  '[]'::json
                ) AS options
         FROM survey_questions q
         LEFT JOIN question_options o ON o.question_id = q.id AND o.is_active = TRUE
         WHERE q.survey_id = ANY($1::uuid[]) AND q.is_active = TRUE
           AND q.version_number = (
             SELECT current_version FROM surveys WHERE id = q.survey_id
           )
         GROUP BY q.id
         ORDER BY q.survey_id, q.sort_order`, [surveyIds]),
            (0, pool_1.query)(`SELECT a.survey_id, c.id, c.name, u.username AS assigned_to,
                a.interview_goal AS quota
         FROM survey_assignments a
         JOIN communities c ON c.id = a.community_id
         JOIN enumerators e ON e.id = a.enumerator_id
         JOIN users u ON u.id = e.user_id
         WHERE a.survey_id = ANY($1::uuid[])
           AND a.status IN ('pending', 'active')
         ORDER BY a.survey_id, c.name`, [surveyIds]),
        ]);
        return surveyResult.rows.map((survey) => {
            const communities = communityResult.rows
                .filter((community) => community.survey_id === survey.id)
                .map((community) => ({
                id: community.id,
                name: community.name,
                assignedTo: community.assigned_to,
                quota: community.quota,
            }));
            return {
                id: survey.id,
                code: `ENC-${survey.municipality.slice(0, 3).toUpperCase()}-${survey.id.slice(0, 6).toUpperCase()}`,
                title: survey.name,
                department: survey.department,
                municipality: survey.municipality,
                municipalities: [{ municipality: survey.municipality, quota: survey.target_sample }],
                communities,
                startDate: survey.start_date ?? '',
                endDate: survey.end_date ?? '',
                targetSample: survey.target_sample,
                status: frontendStatus(survey.status),
                questions: questionResult.rows
                    .filter((question) => question.survey_id === survey.id)
                    .map((question) => ({
                    id: question.id,
                    title: question.question_text,
                    type: frontendQuestionType(question.question_type),
                    isRequired: question.is_required,
                    options: question.options.map((option) => ({
                        id: option.id,
                        text: option.text,
                        color: option.color ?? '#05a6f0',
                        votes: 0,
                        allowsOtherText: option.allowsOtherText,
                    })),
                })),
                assignedEnumerators: Array.from(new Set(communities.map((community) => community.assignedTo))),
                collectedSample: survey.collected_sample,
            };
        });
    }
    async create(input, userId) {
        return (0, pool_1.withTransaction)(async (client) => {
            const municipalityId = await this.ensureMunicipality(client, input.department, input.municipality);
            const inserted = await client.query(`INSERT INTO surveys (
           created_by, municipality_id, name, status, start_date, end_date,
           privacy_config
         )
         VALUES (
           $1, $2, $3, $4::survey_status, $5, $6,
           jsonb_build_object(
             'show_respondent_name', false, 'require_gps', false, 'min_age', 18,
             'targetSample', $7::integer
           )
         )
         RETURNING id`, [userId, municipalityId, input.title, databaseStatus(input.status), input.startDate, input.endDate, input.targetSample]);
            const surveyId = inserted.rows[0].id;
            await this.saveVersion(client, surveyId, userId, 1, input);
            await this.saveAssignments(client, surveyId, userId, municipalityId, input);
            return this.getById(client, surveyId);
        });
    }
    async update(surveyId, input, userId) {
        return (0, pool_1.withTransaction)(async (client) => {
            const existing = await client.query(`SELECT current_version, status FROM surveys WHERE id = $1 FOR UPDATE`, [surveyId]);
            if (!existing.rowCount || existing.rows[0].status === 'archived')
                return null;
            const municipalityId = await this.ensureMunicipality(client, input.department, input.municipality);
            const version = existing.rows[0].current_version + 1;
            await client.query(`UPDATE surveys
         SET municipality_id = $1, name = $2, status = $3::survey_status,
             start_date = $4, end_date = $5, current_version = $6,
             privacy_config = privacy_config || jsonb_build_object('targetSample', $7::integer)
         WHERE id = $8`, [municipalityId, input.title, databaseStatus(input.status), input.startDate, input.endDate, version, input.targetSample, surveyId]);
            await client.query(`UPDATE survey_questions SET is_active = FALSE WHERE survey_id = $1 AND is_active = TRUE`, [surveyId]);
            await client.query(`UPDATE question_options SET is_active = FALSE
         WHERE question_id IN (SELECT id FROM survey_questions WHERE survey_id = $1)`, [surveyId]);
            await this.saveVersion(client, surveyId, userId, version, input);
            await this.saveAssignments(client, surveyId, userId, municipalityId, input);
            return this.getById(client, surveyId);
        });
    }
    async archive(surveyId) {
        return (0, pool_1.withTransaction)(async (client) => {
            const result = await client.query(`UPDATE surveys SET status = 'archived' WHERE id = $1 AND status <> 'archived'`, [surveyId]);
            if (!result.rowCount)
                return false;
            await client.query(`UPDATE survey_assignments SET status = 'cancelled'
         WHERE survey_id = $1 AND status IN ('pending', 'active')`, [surveyId]);
            return true;
        });
    }
    async ensureMunicipality(client, departmentName, municipalityName) {
        const department = await client.query(`INSERT INTO departments (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`, [departmentName]);
        const municipality = await client.query(`INSERT INTO municipalities (department_id, name) VALUES ($1, $2)
       ON CONFLICT (department_id, name) DO UPDATE SET is_active = TRUE
       RETURNING id`, [department.rows[0].id, municipalityName]);
        return municipality.rows[0].id;
    }
    async saveVersion(client, surveyId, userId, version, input) {
        const snapshot = input.questions.map((question) => ({
            title: question.title,
            type: question.type,
            isRequired: question.isRequired,
            options: question.options,
        }));
        await client.query(`INSERT INTO survey_versions (survey_id, version_number, snapshot, created_by, notes)
       VALUES ($1, $2, $3::jsonb, $4, $5)`, [surveyId, version, JSON.stringify(snapshot), userId, version === 1 ? 'Versión inicial' : 'Actualización desde el Constructor']);
        for (const [questionIndex, question] of input.questions.entries()) {
            const inserted = await client.query(`INSERT INTO survey_questions (
           survey_id, version_number, question_text, question_type, sort_order, is_required
         )
         VALUES ($1, $2, $3, $4::question_type, $5, $6)
         RETURNING id`, [surveyId, version, question.title, databaseQuestionType(question.type), questionIndex, question.isRequired]);
            for (const [optionIndex, option] of question.options.entries()) {
                await client.query(`INSERT INTO question_options (
             question_id, option_text, sort_order, allows_other_text, color
           )
           VALUES ($1, $2, $3, $4, $5)`, [inserted.rows[0].id, option.text, optionIndex, option.allowsOtherText ?? false, option.color ?? null]);
            }
        }
    }
    async saveAssignments(client, surveyId, userId, municipalityId, input) {
        const activeAssignments = await client.query(`SELECT community_id, enumerator_id FROM survey_assignments
       WHERE survey_id = $1 AND status IN ('pending', 'active')`, [surveyId]);
        const retainedAssignmentKeys = new Set();
        const assignmentStatus = input.status === 'active' ? 'active' : 'pending';
        for (const assignment of input.communities) {
            const communityResult = await client.query(`INSERT INTO communities (municipality_id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (municipality_id, name) DO UPDATE SET is_active = TRUE
         RETURNING id`, [municipalityId, assignment.name, newCommunityCode()]);
            const enumeratorResult = await client.query(`SELECT e.id
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.name = 'ENUMERATOR'
         LEFT JOIN enumerators e ON e.user_id = u.id
         WHERE LOWER(u.username) = LOWER($1) AND u.is_active = TRUE`, [assignment.assignedTo]);
            if (!enumeratorResult.rowCount) {
                throw new Error(`El encuestador @${assignment.assignedTo} no existe o no está activo.`);
            }
            let enumeratorId = enumeratorResult.rows[0].id;
            if (!enumeratorId) {
                const userResult = await client.query(`SELECT id, full_name, phone FROM users WHERE LOWER(username) = LOWER($1)`, [assignment.assignedTo]);
                const createdEnumerator = await client.query(`INSERT INTO enumerators (user_id, code, full_name, phone)
           VALUES ($1, $2, $3, $4)
           RETURNING id`, [userResult.rows[0].id, `ENC-${(0, crypto_1.randomUUID)().replaceAll('-', '').slice(0, 16)}`, userResult.rows[0].full_name, userResult.rows[0].phone]);
                enumeratorId = createdEnumerator.rows[0].id;
            }
            retainedAssignmentKeys.add(`${communityResult.rows[0].id}:${enumeratorId}`);
            await client.query(`INSERT INTO survey_assignments (
           survey_id, community_id, enumerator_id, assigned_by,
           interview_goal, status
         )
         VALUES ($1, $2, $3, $4, $5, $6::assignment_status)
         ON CONFLICT (survey_id, community_id, enumerator_id)
         DO UPDATE SET interview_goal = EXCLUDED.interview_goal,
                       status = CASE
                         WHEN survey_assignments.status = 'completed' THEN 'completed'::assignment_status
                         ELSE EXCLUDED.status
                       END`, [surveyId, communityResult.rows[0].id, enumeratorId, userId, assignment.quota, assignmentStatus]);
        }
        for (const existing of activeAssignments.rows) {
            if (!retainedAssignmentKeys.has(`${existing.community_id}:${existing.enumerator_id}`)) {
                await client.query(`UPDATE survey_assignments
           SET status = 'cancelled'
           WHERE survey_id = $1 AND community_id = $2 AND enumerator_id = $3`, [surveyId, existing.community_id, existing.enumerator_id]);
            }
        }
    }
    async getById(client, surveyId) {
        const result = await client.query(`${SURVEY_SELECT} WHERE s.id = $1`, [surveyId]);
        const survey = result.rows[0];
        const questions = await client.query(`SELECT q.id, q.survey_id, q.question_text, q.question_type,
              q.is_required, q.sort_order,
              COALESCE(
                json_agg(json_build_object(
                  'id', o.id, 'text', o.option_text, 'color', o.color,
                  'allowsOtherText', o.allows_other_text
                ) ORDER BY o.sort_order) FILTER (WHERE o.id IS NOT NULL),
                '[]'::json
              ) AS options
       FROM survey_questions q
       LEFT JOIN question_options o ON o.question_id = q.id AND o.is_active = TRUE
       WHERE q.survey_id = $1 AND q.is_active = TRUE AND q.version_number = $2
       GROUP BY q.id ORDER BY q.sort_order`, [surveyId, survey.current_version]);
        const communities = await client.query(`SELECT a.survey_id, c.id, c.name, u.username AS assigned_to, a.interview_goal AS quota
       FROM survey_assignments a
       JOIN communities c ON c.id = a.community_id
       JOIN enumerators e ON e.id = a.enumerator_id
       JOIN users u ON u.id = e.user_id
       WHERE a.survey_id = $1 AND a.status IN ('pending', 'active')
       ORDER BY c.name`, [surveyId]);
        const mappedCommunities = communities.rows.map((community) => ({
            id: community.id,
            name: community.name,
            assignedTo: community.assigned_to,
            quota: community.quota,
        }));
        return {
            id: survey.id,
            code: `ENC-${survey.municipality.slice(0, 3).toUpperCase()}-${survey.id.slice(0, 6).toUpperCase()}`,
            title: survey.name,
            department: survey.department,
            municipality: survey.municipality,
            municipalities: [{ municipality: survey.municipality, quota: survey.target_sample }],
            communities: mappedCommunities,
            startDate: survey.start_date ?? '',
            endDate: survey.end_date ?? '',
            targetSample: survey.target_sample,
            status: frontendStatus(survey.status),
            questions: questions.rows.map((question) => ({
                id: question.id,
                title: question.question_text,
                type: frontendQuestionType(question.question_type),
                isRequired: question.is_required,
                options: question.options.map((option) => ({
                    id: option.id,
                    text: option.text,
                    color: option.color ?? '#05a6f0',
                    votes: 0,
                    allowsOtherText: option.allowsOtherText,
                })),
            })),
            assignedEnumerators: Array.from(new Set(mappedCommunities.map((community) => community.assignedTo))),
            collectedSample: survey.collected_sample,
        };
    }
}
exports.SurveysService = SurveysService;
exports.surveysService = new SurveysService();
//# sourceMappingURL=surveys.service.js.map