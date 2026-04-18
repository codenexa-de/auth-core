import type { AuthConfig } from "../config/config.js";
import type {
    EmailVerificationRepository,
    PasswordResetRepository,
    SessionRepository,
    TwoFactorBackupCodeRepository,
    TwoFactorLoginChallengeRepository,
    UserRepository,
} from "../interfaces/repositories.js";
import type { AuditLogger, CipherProvider, Clock, EmailProvider, HashProvider, QrCodeProvider, TokenProvider, TwoFactorProvider } from "../interfaces/providers.js";

export type AuthDeps = {
    config: AuthConfig;
    userRepo: UserRepository;
    sessionRepo: SessionRepository;
    emailVerificationRepo: EmailVerificationRepository;
    passwordResetRepo?: PasswordResetRepository;
    hashProvider: HashProvider;
    tokenProvider: TokenProvider;
    emailProvider: EmailProvider;
    clock: Clock;
    auditLogger?: AuditLogger;
    cipherProvider?: CipherProvider;
    twoFactorProvider?: TwoFactorProvider;
    qrCodeProvider?: QrCodeProvider;
    twoFactorChallengeRepo?: TwoFactorLoginChallengeRepository;
    twoFactorBackupCodeRepo?: TwoFactorBackupCodeRepository;
};
