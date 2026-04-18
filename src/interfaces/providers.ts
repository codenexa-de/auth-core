export type SendEmailInput = {
    to: string;
    subject: string;
    text: string;
    html: string;
};

export interface EmailProvider {
    send(input: SendEmailInput): Promise<void>;
}

export interface HashProvider {
    hashPassword(plain: string): Promise<string>;
    verifyPassword(plain: string, hash: string): Promise<boolean>;
}

export interface TokenProvider {
    randomToken(bytes: number): string;
    randomHex(bytes: number): string;
    hashToken(token: string): string;
}

export interface Clock {
    now(): Date;
}

export interface AuditLogger {
    logAudit(input: { action: string; actorUserId?: string | null; targetUserId?: string | null; metadata?: any }): Promise<void>;
    logLoginAttempt(input: { email: string; userId: string | null; success: boolean; reason: string | null }): Promise<void>;
}

export interface CipherProvider {
    encrypt(plainText: string): string;
    decrypt(cipherText: string): string;
}

export interface TwoFactorProvider {
    generateSecret(input: { label: string; issuer: string }): { secretBase32: string; otpauthUrl: string };
    verifyCode(input: { secretBase32: string; code: string }): boolean;
}

export interface QrCodeProvider {
    toDataUrl(otpauthUrl: string): Promise<string>;
}
