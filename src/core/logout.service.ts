import type { AuthDeps } from "./deps.js";
import { createSessionService } from "./session.service.js";

export const logoutService = async (input: { sessionToken: string; userId?: string }, deps: AuthDeps) => {
    const sessionService = createSessionService(deps);
    await sessionService.destroySession(input.sessionToken);
    if (input.userId) {
        await deps.auditLogger?.logAudit({ action: "auth.logout", actorUserId: input.userId, targetUserId: input.userId });
    }
    return { ok: true };
};

