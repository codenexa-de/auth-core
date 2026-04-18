import test from "node:test";
import assert from "node:assert/strict";

import {
    AccountLockedError,
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    TokenExpiredError,
    TokenInvalidError,
    createAuth,
} from "../dist/index.js";

const createClock = (startMs) => {
    let nowMs = startMs;
    return {
        clock: { now: () => new Date(nowMs) },
        set: (ms) => {
            nowMs = ms;
        },
        add: (ms) => {
            nowMs += ms;
        },
        get: () => nowMs,
    };
};

const createTokenProvider = () => {
    let i = 0;
    return {
        randomToken: () => {
            i += 1;
            return `tok_${i}`;
        },
        randomHex: () => {
            i += 1;
            return `deadbeef${String(i).padStart(2, "0")}`;
        },
        hashToken: (t) => `h(${t})`,
    };
};

const createHashProvider = (correctPassword) => ({
    hashPassword: async (plain) => `hash:${plain}`,
    verifyPassword: async (plain, hash) => hash === `hash:${plain}` && plain === correctPassword,
});

const createEmailProvider = () => {
    const sent = [];
    return {
        provider: {
            send: async (input) => {
                sent.push(input);
            },
        },
        sent,
    };
};

const createUserRepo = () => {
    const users = new Map();
    let id = 0;
    const findByEmail = async (email) => {
        for (const u of users.values()) if (u.email === email) return { ...u };
        return null;
    };
    return {
        users,
        repo: {
            findByEmail,
            findById: async (userId) => {
                const u = users.get(userId);
                return u ? { ...u } : null;
            },
            create: async (input) => {
                id += 1;
                const user = {
                    id: String(id),
                    email: input.email,
                    name: input.name ?? null,
                    image: input.image ?? null,
                    companyName: input.companyName ?? null,
                    passwordHash: input.passwordHash,
                    status: input.status,
                    emailVerifiedAt: input.emailVerifiedAt ?? null,
                    failedLoginCount: input.failedLoginCount ?? 0,
                    lockedUntil: input.lockedUntil ?? null,
                    twoFactorEnabled: input.twoFactorEnabled ?? false,
                    twoFactorSecretEnc: null,
                    twoFactorPendingSecretEnc: null,
                };
                users.set(user.id, user);
                return { ...user };
            },
            update: async (userId, input) => {
                const u = users.get(userId);
                if (!u) throw new Error("missing user");
                const updated = { ...u, ...input };
                users.set(userId, updated);
                return { ...updated };
            },
        },
    };
};

const createEmailVerificationRepo = () => {
    const byHash = new Map();
    let id = 0;
    return {
        byHash,
        repo: {
            create: async (input) => {
                id += 1;
                const rec = { id: String(id), ...input };
                byHash.set(input.tokenHash, rec);
                return rec;
            },
            findByTokenHash: async (tokenHash) => byHash.get(tokenHash) ?? null,
            deleteByTokenHash: async (tokenHash) => {
                byHash.delete(tokenHash);
            },
            deleteByUserId: async (userId) => {
                for (const [k, v] of byHash.entries()) if (v.userId === userId) byHash.delete(k);
            },
        },
    };
};

const createSessionRepo = () => {
    const byHash = new Map();
    let id = 0;
    return {
        byHash,
        repo: {
            create: async (input) => {
                id += 1;
                const rec = {
                    id: String(id),
                    tokenHash: input.tokenHash,
                    userId: input.userId,
                    expiresAt: input.expiresAt,
                    createdAt: new Date(),
                    lastUsedAt: new Date(),
                    ip: input.ip ?? null,
                    userAgent: input.userAgent ?? null,
                };
                byHash.set(input.tokenHash, rec);
                return rec;
            },
            findByTokenHash: async (tokenHash) => byHash.get(tokenHash) ?? null,
            deleteByTokenHash: async (tokenHash) => {
                byHash.delete(tokenHash);
            },
            deleteByUserId: async (userId) => {
                for (const [k, v] of byHash.entries()) if (v.userId === userId) byHash.delete(k);
            },
            updateById: async (sessionId, input) => {
                for (const [k, v] of byHash.entries()) {
                    if (v.id === sessionId) {
                        byHash.set(k, { ...v, ...input });
                        return;
                    }
                }
            },
        },
    };
};

const create2faChallengeRepo = () => {
    const byHash = new Map();
    let id = 0;
    return {
        byHash,
        repo: {
            create: async (input) => {
                id += 1;
                const rec = { id: String(id), ...input };
                byHash.set(input.tokenHash, rec);
                return rec;
            },
            findByTokenHash: async (tokenHash) => byHash.get(tokenHash) ?? null,
            deleteByTokenHash: async (tokenHash) => {
                byHash.delete(tokenHash);
            },
            deleteByUserId: async (userId) => {
                for (const [k, v] of byHash.entries()) if (v.userId === userId) byHash.delete(k);
            },
        },
    };
};

const create2faBackupRepo = () => {
    const byUser = new Map();
    let id = 0;
    return {
        byUser,
        repo: {
            createMany: async ({ userId, codeHashes }) => {
                const list = codeHashes.map((h) => {
                    id += 1;
                    return { id: String(id), userId, codeHash: h, usedAt: null };
                });
                byUser.set(userId, list);
            },
            findUnusedByCodeHash: async ({ userId, codeHash }) => {
                const list = byUser.get(userId) ?? [];
                return list.find((x) => x.codeHash === codeHash && !x.usedAt) ?? null;
            },
            markUsed: async (recordId, usedAt) => {
                for (const [userId, list] of byUser.entries()) {
                    const idx = list.findIndex((x) => x.id === recordId);
                    if (idx !== -1) {
                        list[idx] = { ...list[idx], usedAt };
                        byUser.set(userId, list);
                        return;
                    }
                }
            },
            deleteByUserId: async (userId) => {
                byUser.delete(userId);
            },
        },
    };
};

const createAuthInstance = ({ nowMs, correctPassword }) => {
    const clock = createClock(nowMs);
    const tokenProvider = createTokenProvider();
    const userRepo = createUserRepo();
    const sessionRepo = createSessionRepo();
    const emailVerificationRepo = createEmailVerificationRepo();
    const email = createEmailProvider();
    const twoFactorChallengeRepo = create2faChallengeRepo();
    const twoFactorBackupCodeRepo = create2faBackupRepo();

    const auth = createAuth(
        {
            brandName: "Code Nexa",
            supportEmail: "info@codenexa.de",
            passwordPolicy: () => true,
            loginProtection: { maxAttempts: 3, lockDurationMs: 15 * 60 * 1000 },
            session: { durationMs: 30 * 24 * 60 * 60 * 1000, updateLastUsedAfterMs: 5 * 60 * 1000 },
            emailVerification: {
                tokenBytes: 16,
                expiresMs: 24 * 60 * 60 * 1000,
                buildVerifyUrl: (token) => `https://api.example.com/auth/verify?token=${encodeURIComponent(token)}`,
            },
            emails: {
                verification: ({ verifyUrl, brandName }) => ({
                    subject: `${brandName} – Verify`,
                    text: verifyUrl,
                    html: `<a href="${verifyUrl}">${verifyUrl}</a>`,
                }),
            },
        },
        {
            userRepo: userRepo.repo,
            sessionRepo: sessionRepo.repo,
            emailVerificationRepo: emailVerificationRepo.repo,
            hashProvider: createHashProvider(correctPassword),
            tokenProvider,
            emailProvider: email.provider,
            clock: clock.clock,
            cipherProvider: { encrypt: (v) => `enc:${v}`, decrypt: (v) => v.replace(/^enc:/, "") },
            twoFactorProvider: {
                generateSecret: () => ({ secretBase32: "SECRET", otpauthUrl: "otpauth://test" }),
                verifyCode: ({ secretBase32, code }) => secretBase32 === "SECRET" && code === "123456",
            },
            qrCodeProvider: { toDataUrl: async () => "data:image/png;base64,AA==" },
            twoFactorChallengeRepo: twoFactorChallengeRepo.repo,
            twoFactorBackupCodeRepo: twoFactorBackupCodeRepo.repo,
            auditLogger: { logAudit: async () => {}, logLoginAttempt: async () => {} },
        }
    );

    return { auth, clock, tokenProvider, userRepo, sessionRepo, emailVerificationRepo, email, twoFactorChallengeRepo, twoFactorBackupCodeRepo };
};

test("register -> creates user + verification token + sends email", async () => {
    const { auth, email } = createAuthInstance({ nowMs: Date.UTC(2026, 0, 1), correctPassword: "Passw0rdA" });
    const res = await auth.register({ email: "Test@Example.com", password: "Passw0rdA", name: "A" });
    assert.equal(res.ok, true);
    assert.equal(res.requiresEmailVerification, true);
    assert.equal(email.sent.length, 1);
    const url = email.sent[0].text;
    assert.ok(url.includes("token="));
});

test("register duplicate email -> EmailAlreadyExistsError", async () => {
    const { auth } = createAuthInstance({ nowMs: Date.UTC(2026, 0, 1), correctPassword: "Passw0rdA" });
    await auth.register({ email: "x@y.com", password: "Passw0rdA" });
    await assert.rejects(() => auth.register({ email: "x@y.com", password: "Passw0rdA" }), EmailAlreadyExistsError);
});

test("verifyEmail -> invalid/expired token handling", async () => {
    const { auth, email, emailVerificationRepo, clock, tokenProvider, userRepo } = createAuthInstance({
        nowMs: Date.UTC(2026, 0, 1),
        correctPassword: "Passw0rdA",
    });
    await auth.register({ email: "x@y.com", password: "Passw0rdA" });
    const verifyUrl = email.sent[0].text;
    const token = new URL(verifyUrl).searchParams.get("token");
    assert.ok(token);

    await assert.rejects(() => auth.verifyEmail({ token: "bad" }), TokenInvalidError);

    const tokenHash = tokenProvider.hashToken(token);
    const rec = await emailVerificationRepo.repo.findByTokenHash(tokenHash);
    assert.ok(rec);
    clock.add(25 * 60 * 60 * 1000);
    await assert.rejects(() => auth.verifyEmail({ token }), TokenExpiredError);

    const u = await userRepo.repo.findByEmail("x@y.com");
    assert.equal(u.status, "PENDING_VERIFICATION");
});

test("verifyEmail -> success updates user + deletes token", async () => {
    const { auth, email, emailVerificationRepo, tokenProvider, userRepo } = createAuthInstance({
        nowMs: Date.UTC(2026, 0, 1),
        correctPassword: "Passw0rdA",
    });
    await auth.register({ email: "ok@y.com", password: "Passw0rdA" });
    const verifyUrl = email.sent[0].text;
    const token = new URL(verifyUrl).searchParams.get("token");
    assert.ok(token);

    const tokenHash = tokenProvider.hashToken(token);
    assert.ok(await emailVerificationRepo.repo.findByTokenHash(tokenHash));
    const res = await auth.verifyEmail({ token });
    assert.equal(res.ok, true);
    assert.equal(await emailVerificationRepo.repo.findByTokenHash(tokenHash), null);

    const u = await userRepo.repo.findByEmail("ok@y.com");
    assert.equal(u.status, "ACTIVE");
    assert.ok(u.emailVerifiedAt instanceof Date);
});

test("login lockout -> locks after max attempts, unlocks after time", async () => {
    const { auth, userRepo, clock } = createAuthInstance({ nowMs: Date.UTC(2026, 0, 1), correctPassword: "Passw0rdA" });
    const user = await userRepo.repo.create({
        email: "a@b.com",
        passwordHash: "hash:Passw0rdA",
        status: "ACTIVE",
        emailVerifiedAt: new Date(clock.get()),
        failedLoginCount: 0,
        lockedUntil: null,
    });

    await assert.rejects(() => auth.login({ email: user.email, password: "wrong" }), InvalidCredentialsError);
    await assert.rejects(() => auth.login({ email: user.email, password: "wrong" }), InvalidCredentialsError);
    try {
        await auth.login({ email: user.email, password: "wrong" });
        assert.fail("expected lockout");
    } catch (e) {
        assert.equal(e?.code, "ACCOUNT_LOCKED");
    }

    await assert.rejects(() => auth.login({ email: user.email, password: "Passw0rdA" }), AccountLockedError);
    clock.add(16 * 60 * 1000);
    const ok = await auth.login({ email: user.email, password: "Passw0rdA" });
    assert.equal(ok.ok, true);
    assert.equal(ok.requiresTwoFactor ?? false, false);
});

test("getMe -> rejects expired session and deletes it", async () => {
    const { auth, userRepo, clock, sessionRepo } = createAuthInstance({ nowMs: Date.UTC(2026, 0, 1), correctPassword: "Passw0rdA" });
    const user = await userRepo.repo.create({
        email: "me@b.com",
        passwordHash: "hash:Passw0rdA",
        status: "ACTIVE",
        emailVerifiedAt: new Date(clock.get()),
        failedLoginCount: 0,
        lockedUntil: null,
    });

    const login = await auth.login({ email: user.email, password: "Passw0rdA" });
    assert.equal(login.ok, true);
    assert.ok(login.sessionToken);
    assert.equal(sessionRepo.byHash.size, 1);

    clock.add(31 * 24 * 60 * 60 * 1000);
    await assert.rejects(() => auth.getMe({ sessionToken: login.sessionToken }), (e) => e?.code === "UNAUTHORIZED");
    assert.equal(sessionRepo.byHash.size, 0);
});

test("2FA login flow -> challenge then verify", async () => {
    const { auth, userRepo, clock, twoFactorChallengeRepo } = createAuthInstance({
        nowMs: Date.UTC(2026, 0, 1),
        correctPassword: "Passw0rdA",
    });
    const user = await userRepo.repo.create({
        email: "2fa@b.com",
        passwordHash: "hash:Passw0rdA",
        status: "ACTIVE",
        emailVerifiedAt: new Date(clock.get()),
        failedLoginCount: 0,
        lockedUntil: null,
        twoFactorEnabled: true,
    });
    await userRepo.repo.update(user.id, { twoFactorSecretEnc: "enc:SECRET", twoFactorEnabled: true });

    const first = await auth.login({ email: user.email, password: "Passw0rdA" });
    assert.equal(first.ok, true);
    assert.equal(first.requiresTwoFactor, true);
    assert.ok(first.challengeToken);
    assert.equal(twoFactorChallengeRepo.byHash.size, 1);

    const done = await auth.login2fa({ challengeToken: first.challengeToken, code: "123456" });
    assert.equal(done.ok, true);
    assert.ok(done.sessionToken);
    assert.equal(twoFactorChallengeRepo.byHash.size, 0);
});

test("2FA login -> backup code works when TOTP fails", async () => {
    const { auth, userRepo, clock, twoFactorBackupCodeRepo } = createAuthInstance({
        nowMs: Date.UTC(2026, 0, 1),
        correctPassword: "Passw0rdA",
    });
    const user = await userRepo.repo.create({
        email: "2fa2@b.com",
        passwordHash: "hash:Passw0rdA",
        status: "ACTIVE",
        emailVerifiedAt: new Date(clock.get()),
        failedLoginCount: 0,
        lockedUntil: null,
        twoFactorEnabled: true,
    });
    await userRepo.repo.update(user.id, { twoFactorSecretEnc: "enc:SECRET", twoFactorEnabled: true });

    const first = await auth.login({ email: user.email, password: "Passw0rdA" });
    assert.equal(first.ok, true);
    assert.equal(first.requiresTwoFactor, true);

    const backupCode = "ABCDEF12";
    await twoFactorBackupCodeRepo.repo.createMany({ userId: user.id, codeHashes: [`h(${backupCode})`] });
    const done = await auth.login2fa({ challengeToken: first.challengeToken, code: "abcdef12" });
    assert.equal(done.ok, true);

    const list = twoFactorBackupCodeRepo.byUser.get(user.id) ?? [];
    const used = list.find((x) => x.codeHash === `h(${backupCode})`);
    assert.ok(used);
    assert.ok(used.usedAt instanceof Date);
});
