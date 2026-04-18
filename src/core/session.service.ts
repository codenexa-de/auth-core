import type { AuthDeps } from "./deps.js";
import { UnauthorizedError } from "./errors.js";

export const createSessionService = (deps: Pick<AuthDeps, "config" | "sessionRepo" | "tokenProvider" | "clock">) => {
    const createSession = async (input: { userId: string; ip?: string | null; userAgent?: string | null }) => {
        const rawToken = deps.tokenProvider.randomToken(32);
        const tokenHash = deps.tokenProvider.hashToken(rawToken);
        const expiresAt = new Date(deps.clock.now().getTime() + deps.config.session.durationMs);

        await deps.sessionRepo.create({
            tokenHash,
            userId: input.userId,
            expiresAt,
            ip: input.ip ?? null,
            userAgent: input.userAgent ?? null,
        });

        return { sessionToken: rawToken, expiresAt };
    };

    const validateSession = async (sessionToken: string, input?: { ip?: string | null; userAgent?: string | null }) => {
        if (!sessionToken) throw new UnauthorizedError();
        const tokenHash = deps.tokenProvider.hashToken(sessionToken);
        const session = await deps.sessionRepo.findByTokenHash(tokenHash);
        if (!session) throw new UnauthorizedError();

        const now = deps.clock.now();
        if (session.expiresAt.getTime() < now.getTime()) {
            await deps.sessionRepo.deleteByTokenHash(tokenHash);
            throw new UnauthorizedError();
        }

        const lastUsedAt = session.lastUsedAt ?? session.createdAt ?? null;
        const shouldUpdateLastUsed =
            !lastUsedAt || now.getTime() - lastUsedAt.getTime() >= deps.config.session.updateLastUsedAfterMs;
        const shouldSetIp = !session.ip && Boolean(input?.ip);
        const shouldSetUserAgent = !session.userAgent && Boolean(input?.userAgent);
        if (shouldUpdateLastUsed || shouldSetIp || shouldSetUserAgent) {
            await deps.sessionRepo.updateById(session.id, {
                lastUsedAt: shouldUpdateLastUsed ? now : undefined,
                ip: shouldSetIp ? (input?.ip ?? null) : undefined,
                userAgent: shouldSetUserAgent ? (input?.userAgent ?? null) : undefined,
            });
        }

        return session;
    };

    const destroySession = async (sessionToken: string) => {
        const tokenHash = deps.tokenProvider.hashToken(sessionToken);
        await deps.sessionRepo.deleteByTokenHash(tokenHash);
    };

    const destroyAllSessions = async (userId: string) => {
        await deps.sessionRepo.deleteByUserId(userId);
    };

    return { createSession, validateSession, destroySession, destroyAllSessions };
};

