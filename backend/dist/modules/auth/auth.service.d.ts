interface LoginResult {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    user?: {
        id: string;
        username: string;
        fullName: string;
        roles: string[];
        enumeratorId: string | null;
    };
    message?: string;
    code?: string;
}
/**
 * Servicio de autenticación.
 * Gestiona login, tokens JWT y refresh tokens.
 */
export declare class AuthService {
    /**
     * Intenta autenticar a un usuario con username/email y contraseña.
     * Verifica las credenciales y genera tokens para una sesión válida.
     */
    login(identifier: string, password: string): Promise<LoginResult>;
    /**
     * Renueva el access token usando un refresh token válido.
     */
    refreshAccessToken(refreshToken: string): Promise<LoginResult>;
    /**
     * Revoca todos los refresh tokens del usuario (logout).
     */
    logout(userId: string): Promise<void>;
    /**
     * Hashea una contraseña con bcrypt.
     */
    hashPassword(password: string): Promise<string>;
    private generateTokens;
    private hashToken;
    /** Simula el tiempo de un bcrypt.compare para prevenir timing attacks */
    private simulateHashCheck;
    private parseDuration;
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=auth.service.d.ts.map