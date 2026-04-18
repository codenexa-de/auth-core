import type { AuthDeps } from "./deps.js";
import { UnauthorizedError } from "./errors.js";
import { createSessionService } from "./session.service.js";

export const getMeService = async (input: { sessionToken: string; ip?: string | null; userAgent?: string | null }, deps: AuthDeps) => {
    const sessionService = createSessionService(deps);
    const session = await sessionService.validateSession(input.sessionToken, { ip: input.ip ?? null, userAgent: input.userAgent ?? null });
    const user = await deps.userRepo.findById(session.userId);
    if (!user || !user.emailVerifiedAt || user.status !== "ACTIVE") throw new UnauthorizedError();
    return { user: { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null } };
};

