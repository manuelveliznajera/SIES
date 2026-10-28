import type { Request, Response, NextFunction } from 'express';
export declare function listUsers(_req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function createUser(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateUser(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function activateUser(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=users.controller.d.ts.map