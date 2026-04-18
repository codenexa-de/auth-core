export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED" | "DELETED";

export type AuthUser = {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    companyName?: string | null;
    passwordHash?: string | null;
    status: UserStatus;
    emailVerifiedAt?: Date | null;
    failedLoginCount?: number | null;
    lockedUntil?: Date | null;
    twoFactorEnabled?: boolean;
    twoFactorSecretEnc?: string | null;
    twoFactorPendingSecretEnc?: string | null;
};

export type SessionRecord = {
    id: string;
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    createdAt?: Date;
    lastUsedAt?: Date;
    ip?: string | null;
    userAgent?: string | null;
    reauthenticatedAt?: Date | null;
};

export type EmailVerificationTokenRecord = {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt?: Date;
};

export type PasswordResetTokenRecord = {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt?: Date | null;
    createdAt?: Date;
};

export type TwoFactorBackupCodeRecord = {
    id: string;
    userId: string;
    codeHash: string;
    usedAt?: Date | null;
    createdAt?: Date;
};

export type TwoFactorLoginChallengeRecord = {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt?: Date;
};
