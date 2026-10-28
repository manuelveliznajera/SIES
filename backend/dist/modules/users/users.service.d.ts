import type { CreateUserInput, UpdateUserInput } from './users.validators';
export interface UserRecord {
    id: string;
    username: string;
    fullName: string;
    email: string;
    phone: string | null;
    role: 'ADMIN' | 'SUPERVISOR' | 'ENUMERATOR';
    isActive: boolean;
    createdAt: string;
}
export declare class UsersService {
    list(): Promise<UserRecord[]>;
    create(input: CreateUserInput): Promise<UserRecord>;
    update(userId: string, input: UpdateUserInput): Promise<UserRecord | null>;
    deactivate(userId: string): Promise<UserRecord | null>;
    activate(userId: string): Promise<UserRecord | null>;
    private ensureActiveAdminRemains;
}
export declare const usersService: UsersService;
//# sourceMappingURL=users.service.d.ts.map