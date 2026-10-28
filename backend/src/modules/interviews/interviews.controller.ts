import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { interviewInputSchema } from './interviews.validators';
import { InterviewSubmissionError, interviewsService } from './interviews.service';

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
