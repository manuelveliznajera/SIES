export declare const assignmentsService: {
    reassign(surveyId: string, communityId: string, name: string, alias: string, quota: number, assignedBy: string): Promise<{
        kind: "survey_missing";
        community?: undefined;
    } | {
        kind: "survey_closed";
        community?: undefined;
    } | {
        kind: "community_missing";
        community?: undefined;
    } | {
        kind: "enumerator_missing";
        community?: undefined;
    } | {
        kind: "assignment_completed";
        community?: undefined;
    } | {
        kind: "ok";
        community: string;
    }>;
    create(surveyId: string, name: string, alias: string, quota: number, assignedBy: string): Promise<{
        kind: "survey_missing";
        id?: undefined;
        assignmentId?: undefined;
        assignedTo?: undefined;
        quota?: undefined;
        name?: undefined;
    } | {
        kind: "survey_closed";
        id?: undefined;
        assignmentId?: undefined;
        assignedTo?: undefined;
        quota?: undefined;
        name?: undefined;
    } | {
        kind: "enumerator_missing";
        id?: undefined;
        assignmentId?: undefined;
        assignedTo?: undefined;
        quota?: undefined;
        name?: undefined;
    } | {
        kind: "duplicate_community";
        id?: undefined;
        assignmentId?: undefined;
        assignedTo?: undefined;
        quota?: undefined;
        name?: undefined;
    } | {
        kind: "ok";
        id: string;
        assignmentId: string;
        assignedTo: string;
        quota: number;
        name: string;
    }>;
};
//# sourceMappingURL=assignments.service.d.ts.map