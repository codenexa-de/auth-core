import type { AuthDeps } from "./deps.js";
import { InvalidInputError } from "./errors.js";
import { createEmailVerificationService } from "./emailVerification.service.js";

export const verifyEmailService = async (input: { token: string }, deps: AuthDeps) => {
    const token = String(input.token ?? "").trim();
    if (!token) throw new InvalidInputError("Invalid input");

    const emailVerification = createEmailVerificationService(deps);
    const verified = await emailVerification.verifyToken(token);

    const now = deps.clock.now();
    await deps.userRepo.update(verified.record.userId, { emailVerifiedAt: now, status: "ACTIVE" });
    await deps.emailVerificationRepo.deleteByTokenHash(verified.tokenHash);
    await deps.auditLogger?.logAudit({
        action: "auth.email_verified",
        actorUserId: verified.record.userId,
        targetUserId: verified.record.userId,
    });

    return { ok: true };
};

