import { EventEmitter } from 'node:events';

export interface SurveyCreatedEvent {
  id: string;
  title: string;
  municipality: string;
  createdAt: string;
}

export interface InterviewCreatedEvent {
  id: string;
  folio: string;
  surveyId: string;
  createdAt: string;
}

const surveyEvents = new EventEmitter();

export function publishSurveyCreated(event: SurveyCreatedEvent): void {
  surveyEvents.emit('survey.created', event);
}

export function subscribeToSurveyCreated(listener: (event: SurveyCreatedEvent) => void): () => void {
  surveyEvents.on('survey.created', listener);
  return () => surveyEvents.off('survey.created', listener);
}

export function publishInterviewCreated(event: InterviewCreatedEvent): void {
  surveyEvents.emit('interview.created', event);
}

export function subscribeToInterviewCreated(listener: (event: InterviewCreatedEvent) => void): () => void {
  surveyEvents.on('interview.created', listener);
  return () => surveyEvents.off('interview.created', listener);
}
