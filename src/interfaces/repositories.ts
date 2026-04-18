import type {
    AuthUser,
    EmailVerificationTokenRecord,
    PasswordResetTokenRecord,
    SessionRecord,
    TwoFactorBackupCodeRecord,
    TwoFactorLoginChallengeRecord,
} from "./types.js";

export type CreateUserInput = {
    email: string;
    passwordHash: string;
    name?: string | null;
    image?: string | null;
    companyName?: string | null;
    status: AuthUser["status"];
    emailVerifiedAt?: Date | null;
    failedLoginCount?: number;
    lockedUntil?: Date | null;
    twoFactorEnabled?: boolean;
};

export type UpdateUserInput = Partial<{
    email: string;
    passwordHash: string | null;
    name: string | null;
    image: string | null;
    companyName: string | null;
    status: AuthUser["status"];
    emailVerifiedAt: Date | null;
    failedLoginCount: number;
    lockedUntil: Date | null;
    lastLoginAt: Date | null;
    twoFactorEnabled: boolean;
    twoFactorSecretEnc: string | null;
    twoFactorPendingSecretEnc: string | null;
}>;

export interface UserRepository {
    findByEmail(email: string): Promise<AuthUser | null>;
    findById(id: string): Promise<AuthUser | null>;
    create(input: CreateUserInput): Promise<AuthUser>;
    update(id: string, input: UpdateUserInput): Promise<AuthUser>;
}

export type CreateSessionInput = {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    ip?: string | null;
    userAgent?: string | null;
};

export type UpdateSessionInput = Partial<{
    lastUsedAt: Date;
    ip: string | null;
    userAgent: string | null;
    reauthenticatedAt: Date | null;
}>;

export interface SessionRepository {
    create(input: CreateSessionInput): Promise<SessionRecord>;
    findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
    deleteByTokenHash(tokenHash: string): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
    updateById(sessionId: string, input: UpdateSessionInput): Promise<void>;
}

export type CreateEmailVerificationTokenInput = {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
};

export interface EmailVerificationRepository {
    create(input: CreateEmailVerificationTokenInput): Promise<EmailVerificationTokenRecord>;
    findByTokenHash(tokenHash: string): Promise<EmailVerificationTokenRecord | null>;
    deleteByTokenHash(tokenHash: string): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
}

export type CreatePasswordResetTokenInput = {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
};

export interface PasswordResetRepository {
    create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenRecord>;
    findByTokenHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
    markUsed(tokenHash: string, usedAt: Date): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
}

export type CreateTwoFactorLoginChallengeInput = {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
};

export interface TwoFactorLoginChallengeRepository {
    create(input: CreateTwoFactorLoginChallengeInput): Promise<TwoFactorLoginChallengeRecord>;
    findByTokenHash(tokenHash: string): Promise<TwoFactorLoginChallengeRecord | null>;
    deleteByTokenHash(tokenHash: string): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
}

export interface TwoFactorBackupCodeRepository {
    createMany(input: { userId: string; codeHashes: string[] }): Promise<void>;
    findUnusedByCodeHash(input: { userId: string; codeHash: string }): Promise<TwoFactorBackupCodeRecord | null>;
    markUsed(id: string, usedAt: Date): Promise<void>;
    deleteByUserId(userId: string): Promise<void>;
}
