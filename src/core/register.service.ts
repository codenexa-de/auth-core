import type { AuthDeps } from "./deps.js";
import { EmailAlreadyExistsError, InvalidInputError } from "./errors.js";
import { normalizeEmail } from "../utils/normalize.js";
import { createEmailVerificationService } from "./emailVerification.service.js";

export type RegisterInput = {
    email: string;
    password: string;
    name?: string;
    companyName?: string;
};

export const registerService = async (input: RegisterInput, deps: AuthDeps) => {
    const email = normalizeEmail(String(input.email ?? ""));
    const password = String(input.password ?? "");
    const name = input.name?.trim() || null;
    const companyName = input.companyName?.trim() || null;

    if (!email || !email.includes("@")) throw new InvalidInputError("Invalid input");
    if (!deps.config.passwordPolicy(password)) throw new InvalidInputError("Password policy failed");

    const existing = await deps.userRepo.findByEmail(email);
    if (existing) throw new EmailAlreadyExistsError();

    const passwordHash = await deps.hashProvider.hashPassword(password);
    const user = await deps.userRepo.create({
        email,
        passwordHash,
        name,
        companyName,
        status: "PENDING_VERIFICATION",
        failedLoginCount: 0,
        lockedUntil: null,
        emailVerifiedAt: null,
    });

    const emailVerification = createEmailVerificationService(deps);
    const token = await emailVerification.createToken(user.id);

    const emailPayload = deps.config.emails.verification({
        to: user.email,
        verifyUrl: token.verifyUrl,
        brandName: deps.config.brandName,
        supportEmail: deps.config.supportEmail,
    });
    await deps.emailProvider.send({
        to: user.email,
        subject: emailPayload.subject,
        text: emailPayload.text,
        html: emailPayload.html,
    });

    await deps.auditLogger?.logAudit({
        action: "auth.register",
        actorUserId: null,
        targetUserId: user.id,
        metadata: { email: user.email },
    });

    return { ok: true, user: { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null }, requiresEmailVerification: true };
};

