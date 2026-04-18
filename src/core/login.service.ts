import type { AuthDeps } from "./deps.js";
import { AccountDisabledError, AccountLockedError, EmailNotVerifiedError, InvalidCredentialsError, InvalidInputError } from "./errors.js";
import { normalizeEmail } from "../utils/normalize.js";
import { createSessionService } from "./session.service.js";

export type LoginInput = {
    email: string;
    password: string;
    ip?: string | null;
    userAgent?: string | null;
};

export type LoginResult =
    | { ok: true; requiresTwoFactor: true; challengeToken: string }
    | { ok: true; requiresTwoFactor?: false; sessionToken: string; user: { id: string; email: string; name: string | null; image: string | null } };

export const loginService = async (input: LoginInput, deps: AuthDeps): Promise<LoginResult> => {
    const email = normalizeEmail(String(input.email ?? ""));
    const password = String(input.password ?? "");
    if (!email || !email.includes("@") || !password) throw new InvalidInputError("Invalid credentials");

    const user = await deps.userRepo.findByEmail(email);
    if (!user?.passwordHash) {
        await deps.auditLogger?.logLoginAttempt({ email, userId: null, success: false, reason: "INVALID_CREDENTIALS" });
        throw new InvalidCredentialsError();
    }

    const now = deps.clock.now();
    if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
        await deps.auditLogger?.logLoginAttempt({ email, userId: user.id, success: false, reason: "LOCKED" });
        throw new AccountLockedError(user.lockedUntil);
    }

    if (user.status === "LOCKED") {
        await deps.userRepo.update(user.id, { status: "ACTIVE", lockedUntil: null, failedLoginCount: 0 });
        user.status = "ACTIVE";
        user.lockedUntil = null;
        user.failedLoginCount = 0;
    }

    if (!user.emailVerifiedAt) {
        await deps.auditLogger?.logLoginAttempt({ email, userId: user.id, success: false, reason: "NOT_VERIFIED" });
        throw new EmailNotVerifiedError();
    }

    if (user.status !== "ACTIVE") {
        await deps.auditLogger?.logLoginAttempt({ email, userId: user.id, success: false, reason: `STATUS_${user.status}` });
        throw new AccountDisabledError();
    }

    const ok = await deps.hashProvider.verifyPassword(password, user.passwordHash);
    if (!ok) {
        const failedCount = (user.failedLoginCount ?? 0) + 1;
        const shouldLock = failedCount >= deps.config.loginProtection.maxAttempts;
        const lockedUntil = shouldLock ? new Date(now.getTime() + deps.config.loginProtection.lockDurationMs) : null;
        await deps.userRepo.update(user.id, {
            failedLoginCount: failedCount,
            status: shouldLock ? "LOCKED" : user.status,
            lockedUntil,
        });
        await deps.auditLogger?.logLoginAttempt({ email, userId: user.id, success: false, reason: "INVALID_CREDENTIALS" });
        if (lockedUntil) throw new AccountLockedError(lockedUntil);
        throw new InvalidCredentialsError();
    }

    if (user.twoFactorEnabled) {
        if (!deps.twoFactorChallengeRepo || !deps.tokenProvider) throw new AccountDisabledError();
        const rawChallengeToken = deps.tokenProvider.randomToken(32);
        const tokenHash = deps.tokenProvider.hashToken(rawChallengeToken);
        const expiresAt = new Date(now.getTime() + 1000 * 60 * 10);
        await deps.twoFactorChallengeRepo.deleteByUserId(user.id);
        await deps.twoFactorChallengeRepo.create({ userId: user.id, tokenHash, expiresAt });
        return { ok: true, requiresTwoFactor: true, challengeToken: rawChallengeToken };
    }

    const sessionService = createSessionService(deps);
    const session = await sessionService.createSession({ userId: user.id, ip: input.ip ?? null, userAgent: input.userAgent ?? null });

    await deps.userRepo.update(user.id, {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
    });

    await deps.auditLogger?.logLoginAttempt({ email: user.email, userId: user.id, success: true, reason: null });
    return {
        ok: true,
        sessionToken: session.sessionToken,
        user: { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null },
    };
};

