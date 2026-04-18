export type PasswordPolicy = (password: string) => boolean;

export type AuthConfig = {
    brandName: string;
    supportEmail?: string;
    passwordPolicy: PasswordPolicy;
    loginProtection: {
        maxAttempts: number;
        lockDurationMs: number;
    };
    session: {
        durationMs: number;
        updateLastUsedAfterMs: number;
    };
    emailVerification: {
        tokenBytes: number;
        expiresMs: number;
        buildVerifyUrl: (token: string) => string;
    };
    emails: {
        verification: (input: { to: string; verifyUrl: string; brandName: string; supportEmail?: string }) => {
            subject: string;
            text: string;
            html: string;
        };
        passwordReset?: (input: { to: string; resetUrl: string; brandName: string; supportEmail?: string }) => {
            subject: string;
            text: string;
            html: string;
        };
        passwordChanged?: (input: { to: string; brandName: string; supportEmail?: string }) => {
            subject: string;
            text: string;
            html: string;
        };
    };
};

export const defaultPasswordPolicy: PasswordPolicy = (password) => {
    if (password.length < 10) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
};

export const defaultEmailTemplates: AuthConfig["emails"] = {
    verification: ({ verifyUrl, brandName }) => ({
        subject: `${brandName} – E-Mail-Adresse bestätigen`,
        text: `Bitte bestätigen Sie Ihre E-Mail-Adresse: ${verifyUrl}\n`,
        html: `<p>Bitte bestätigen Sie Ihre E-Mail-Adresse:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    }),
};
