"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishSurveyCreated = publishSurveyCreated;
exports.subscribeToSurveyCreated = subscribeToSurveyCreated;
exports.publishInterviewCreated = publishInterviewCreated;
exports.subscribeToInterviewCreated = subscribeToInterviewCreated;
const node_events_1 = require("node:events");
const surveyEvents = new node_events_1.EventEmitter();
function publishSurveyCreated(event) {
    surveyEvents.emit('survey.created', event);
}
function subscribeToSurveyCreated(listener) {
    surveyEvents.on('survey.created', listener);
    return () => surveyEvents.off('survey.created', listener);
}
function publishInterviewCreated(event) {
    surveyEvents.emit('interview.created', event);
}
function subscribeToInterviewCreated(listener) {
    surveyEvents.on('interview.created', listener);
    return () => surveyEvents.off('interview.created', listener);
}
//# sourceMappingURL=surveys.events.js.map