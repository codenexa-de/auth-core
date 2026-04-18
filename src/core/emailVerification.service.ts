import type { AuthDeps } from "./deps.js";
import { TokenExpiredError, TokenInvalidError } from "./errors.js";

export const createEmailVerificationService = (deps: Pick<AuthDeps, "config" | "emailVerificationRepo" | "tokenProvider" | "clock">) => {
    const createToken = async (userId: string) => {
        const rawToken = deps.tokenProvider.randomToken(deps.config.emailVerification.tokenBytes);
        const tokenHash = deps.tokenProvider.hashToken(rawToken);
        const expiresAt = new Date(deps.clock.now().getTime() + deps.config.emailVerification.expiresMs);
        await deps.emailVerificationRepo.deleteByUserId(userId);
        await deps.emailVerificationRepo.create({ userId, tokenHash, expiresAt });
        return { token: rawToken, tokenHash, expiresAt, verifyUrl: deps.config.emailVerification.buildVerifyUrl(rawToken) };
    };

    const verifyToken = async (rawToken: string) => {
        const tokenHash = deps.tokenProvider.hashToken(rawToken);
        const record = await deps.emailVerificationRepo.findByTokenHash(tokenHash);
        if (!record) throw new TokenInvalidError();
        if (record.expiresAt.getTime() < deps.clock.now().getTime()) {
            await deps.emailVerificationRepo.deleteByTokenHash(tokenHash);
            throw new TokenExpiredError();
        }
        return { record, tokenHash };
    };

    return { createToken, verifyToken };
};

