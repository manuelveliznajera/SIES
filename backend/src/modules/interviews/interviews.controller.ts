import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { correctInterviewCommunitySchema, interviewIdSchema, interviewInputSchema } from './interviews.validators';
import { InterviewSubmissionError, interviewsService } from './interviews.service';
import { publishInterviewCreated } from '../surveys/surveys.events';
import { writeAuditEvent } from '../../services/observability';

export async function listInterviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const interviews = await interviewsService.list(req.user!.userId, req.user!.roles);
    res.status(200).json({ success: true, interviews });
  } catch (error) {
    next(error);
  }
}

export async function createInterview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = interviewInputSchema.parse(req.body);
    const interview = await interviewsService.create(input, req.user!.userId, req.user!.roles);
    if (!interview.duplicate) {
      await writeAuditEvent(req, {
        action: 'interview.created',
        entityType: 'interview',
        entityId: interview.id,
        changes: {
          folio: interview.folio,
          surveyId: input.surveyId,
          communityId: input.communityId,
          startedAt: input.startedAt ?? input.interviewedAt,
          finishedAt: input.interviewedAt,
          durationSeconds: Math.max(0, Math.round((new Date(input.interviewedAt).getTime() - new Date(input.startedAt ?? input.interviewedAt).getTime()) / 1000)),
        },
      });
      publishInterviewCreated({
        id: interview.id,
        folio: interview.folio,
        surveyId: input.surveyId,
        createdAt: input.interviewedAt,
      });
    }
    res.status(201).json({ success: true, interview });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: 'Los datos de la entrevista son inválidos.',
        code: 'VALIDATION_ERROR',
        errors: error.errors.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      });
      return;
    }
    if (error instanceof InterviewSubmissionError) {
      res.status(error.status).json({ success: false, message: error.message, code: error.code });
      return;
    }
    next(error);
  }
}

export async function deleteInterview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const interviewId = interviewIdSchema.parse(req.params.interviewId);
    const deleted = await interviewsService.deleteOne(interviewId);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'No se encontró la encuesta registrada.', code: 'INTERVIEW_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'interview.deleted',
      entityType: 'interview',
      entityId: deleted.id,
      changes: { surveyId: deleted.survey_id, folio: deleted.folio },
    });
    res.status(200).json({ success: true, deleted: true });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: 'El identificador de encuesta no es válido.', code: 'VALIDATION_ERROR' });
      return;
    }
    next(error);
  }
}

export async function correctInterviewCommunity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const interviewId = interviewIdSchema.parse(req.params.interviewId);
    const { communityId } = correctInterviewCommunitySchema.parse(req.body);
    const correction = await interviewsService.correctCommunity(interviewId, communityId);
    if (!correction) {
      res.status(404).json({ success: false, message: 'No se encontró la encuesta registrada.', code: 'INTERVIEW_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'interview.community_corrected',
      entityType: 'interview',
      entityId: interviewId,
      changes: { folio: correction.folio, surveyId: correction.surveyId, oldCommunity: correction.oldCommunity, newCommunity: correction.community },
    });
    res.status(200).json({ success: true, correction });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: 'El identificador o la comunidad no son válidos.', code: 'VALIDATION_ERROR' });
      return;
    }
    if (error instanceof InterviewSubmissionError) {
      res.status(error.status).json({ success: false, message: error.message, code: error.code });
      return;
    }
    next(error);
  }
}

export async function clearSurveyInterviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const surveyId = interviewIdSchema.parse(req.params.surveyId);
    const result = await interviewsService.clearSurvey(surveyId);
    if (!result) {
      res.status(404).json({ success: false, message: 'No se encontró el estudio.', code: 'SURVEY_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'survey.interviews_cleared',
      entityType: 'survey',
      entityId: surveyId,
      changes: { deletedCount: result.deletedCount },
    });
    res.status(200).json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: 'El identificador del estudio no es válido.', code: 'VALIDATION_ERROR' });
      return;
    }
    next(error);
  }
}
