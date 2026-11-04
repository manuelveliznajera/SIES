import type { NextFunction, Request, Response } from 'express';
export declare function streamSurveyEvents(_req: Request, res: Response): void;
export declare function listSurveys(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function createSurvey(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function archiveSurvey(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function restoreSurvey(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=surveys.controller.d.ts.map