import type { AuthDeps } from "./deps.js";
import { AccountDisabledError, InvalidCredentialsError, InvalidInputError, UnauthorizedError } from "./errors.js";
import { createSessionService } from "./session.service.js";

const normalizeTwoFactorCode = (code: string) => code.trim().replace(/\s+/g, "").toUpperCase();

const requireTwoFactorDeps = (deps: AuthDeps) => {
    if (!deps.twoFactorProvider || !deps.cipherProvider || !deps.twoFactorChallengeRepo || !deps.twoFactorBackupCodeRepo) {
        throw new AccountDisabledError();
    }
    return {
        twoFactorProvider: deps.twoFactorProvider,
        cipherProvider: deps.cipherProvider,
        challengeRepo: deps.twoFactorChallengeRepo,
        backupRepo: deps.twoFactorBackupCodeRepo,
    };
};

const generateBackupCodes = (deps: AuthDeps) =>
    Array.from({ length: 10 }, () => deps.tokenProvider.randomHex(4).toUpperCase());

export const startTwoFactorSetupService = async (input: { userId: string; email: string }, deps: AuthDeps) => {
    const { twoFactorProvider, cipherProvider } = requireTwoFactorDeps(deps);
    const secret = twoFactorProvider.generateSecret({ label: `${deps.config.brandName} (${input.email})`, issuer: deps.config.brandName });
    const secretEnc = cipherProvider.encrypt(secret.secretBase32);
    await deps.userRepo.update(input.userId, { twoFactorPendingSecretEnc: secretEnc });
    const qrDataUrl = deps.qrCodeProvider ? await deps.qrCodeProvider.toDataUrl(secret.otpauthUrl) : null;
    await deps.auditLogger?.logAudit({ action: "auth.2fa_setup_started", actorUserId: input.userId, targetUserId: input.userId });
    return { otpauthUrl: secret.otpauthUrl, qrDataUrl };
};

export const verifyTwoFactorSetupService = async (input: { userId: string; code: string }, deps: AuthDeps) => {
    const { twoFactorProvider, cipherProvider, backupRepo } = requireTwoFactorDeps(deps);
    const user = await deps.userRepo.findById(input.userId);
    if (!user?.twoFactorPendingSecretEnc) throw new InvalidInputError("Invalid input");
    const secretBase32 = cipherProvider.decrypt(user.twoFactorPendingSecretEnc);
    const ok = twoFactorProvider.verifyCode({ secretBase32, code: normalizeTwoFactorCode(input.code) });
    if (!ok) throw new InvalidInputError("Invalid input");

    const backupCodes = generateBackupCodes(deps);
    const codeHashes = backupCodes.map((c) => deps.tokenProvider.hashToken(c));
    await backupRepo.deleteByUserId(user.id);
    await backupRepo.createMany({ userId: user.id, codeHashes });

    await deps.userRepo.update(user.id, {
        twoFactorEnabled: true,
        twoFactorSecretEnc: cipherProvider.encrypt(secretBase32),
        twoFactorPendingSecretEnc: null,
    });

    await deps.auditLogger?.logAudit({ action: "auth.2fa_enabled", actorUserId: user.id, targetUserId: user.id });
    return { ok: true, backupCodes };
};

export const disableTwoFactorService = async (input: { userId: string; password: string; code: string }, deps: AuthDeps) => {
    const { twoFactorProvider, cipherProvider, backupRepo, challengeRepo } = requireTwoFactorDeps(deps);
    const user = await deps.userRepo.findById(input.userId);
    if (!user?.passwordHash || !user.twoFactorEnabled || !user.twoFactorSecretEnc) throw new InvalidInputError("Invalid input");

    const passwordOk = await deps.hashProvider.verifyPassword(input.password, user.passwordHash);
    if (!passwordOk) throw new InvalidCredentialsError();

    const secretBase32 = cipherProvider.decrypt(user.twoFactorSecretEnc);
    const codeOk = twoFactorProvider.verifyCode({ secretBase32, code: normalizeTwoFactorCode(input.code) });
    if (!codeOk) throw new InvalidCredentialsError();

    await backupRepo.deleteByUserId(user.id);
    await challengeRepo.deleteByUserId(user.id);
    await deps.userRepo.update(user.id, { twoFactorEnabled: false, twoFactorSecretEnc: null, twoFactorPendingSecretEnc: null });
    await deps.auditLogger?.logAudit({ action: "auth.2fa_disabled", actorUserId: user.id, targetUserId: user.id });
    return { ok: true };
};

export const regenerateTwoFactorBackupCodesService = async (input: { userId: string; code: string }, deps: AuthDeps) => {
    const { twoFactorProvider, cipherProvider, backupRepo } = requireTwoFactorDeps(deps);
    const user = await deps.userRepo.findById(input.userId);
    if (!user?.twoFactorEnabled || !user.twoFactorSecretEnc) throw new InvalidInputError("Invalid input");

    const secretBase32 = cipherProvider.decrypt(user.twoFactorSecretEnc);
    const codeOk = twoFactorProvider.verifyCode({ secretBase32, code: normalizeTwoFactorCode(input.code) });
    if (!codeOk) throw new InvalidCredentialsError();

    const backupCodes = generateBackupCodes(deps);
    const codeHashes = backupCodes.map((c) => deps.tokenProvider.hashToken(c));
    await backupRepo.deleteByUserId(user.id);
    await backupRepo.createMany({ userId: user.id, codeHashes });
    await deps.auditLogger?.logAudit({ action: "auth.2fa_backup_codes_regenerated", actorUserId: user.id, targetUserId: user.id });
    return { ok: true, backupCodes };
};

export const loginTwoFactorService = async (
    input: { challengeToken: string; code: string; ip?: string | null; userAgent?: string | null },
    deps: AuthDeps
) => {
    const { twoFactorProvider, cipherProvider, challengeRepo, backupRepo } = requireTwoFactorDeps(deps);
    const rawToken = String(input.challengeToken ?? "").trim();
    const code = normalizeTwoFactorCode(String(input.code ?? ""));
    if (!rawToken || !code) throw new InvalidCredentialsError();

    const tokenHash = deps.tokenProvider.hashToken(rawToken);
    const challenge = await challengeRepo.findByTokenHash(tokenHash);
    if (!challenge) throw new InvalidCredentialsError();

    const now = deps.clock.now();
    if (challenge.expiresAt.getTime() < now.getTime()) {
        await challengeRepo.deleteByTokenHash(tokenHash);
        throw new InvalidCredentialsError();
    }

    const user = await deps.userRepo.findById(challenge.userId);
    if (!user || !user.emailVerifiedAt || user.status !== "ACTIVE" || !user.twoFactorEnabled || !user.twoFactorSecretEnc) {
        await challengeRepo.deleteByTokenHash(tokenHash);
        throw new InvalidCredentialsError();
    }

    const secretBase32 = cipherProvider.decrypt(user.twoFactorSecretEnc);
    const totpOk = twoFactorProvider.verifyCode({ secretBase32, code });
    if (!totpOk) {
        const codeHash = deps.tokenProvider.hashToken(code);
        const backup = await backupRepo.findUnusedByCodeHash({ userId: user.id, codeHash });
        if (!backup) throw new InvalidCredentialsError();
        await backupRepo.markUsed(backup.id, now);
    }

    await challengeRepo.deleteByUserId(user.id);

    const sessionService = createSessionService(deps);
    const session = await sessionService.createSession({ userId: user.id, ip: input.ip ?? null, userAgent: input.userAgent ?? null });
    await deps.userRepo.update(user.id, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now });
    await deps.auditLogger?.logAudit({ action: "auth.2fa_login", actorUserId: user.id, targetUserId: user.id });
    return {
        ok: true,
        sessionToken: session.sessionToken,
        user: { id: user.id, email: user.email, name: user.name ?? null, image: user.image ?? null },
    };
};

export const getTwoFactorStatusService = async (input: { userId: string }, deps: AuthDeps) => {
    const user = await deps.userRepo.findById(input.userId);
    if (!user) throw new UnauthorizedError();
    return { enabled: Boolean(user.twoFactorEnabled) };
};

