import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    AuthUser,
    EmailVerificationRepository,
    EmailVerificationTokenRecord,
    SessionRecord,
    SessionRepository,
    UserRepository,
} from "../interfaces/index.js";

type Tables = {
    users: string;
    sessions: string;
    emailVerificationTokens: string;
};

const defaultTables: Tables = {
    users: "User",
    sessions: "Session",
    emailVerificationTokens: "EmailVerificationToken",
};

const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    const d = new Date(String(value));
    return Number.isFinite(d.getTime()) ? d : null;
};

const mapUser = (row: any): AuthUser => ({
    id: String(row.id),
    email: String(row.email),
    name: row.name ?? null,
    image: row.image ?? null,
    companyName: row.company_name ?? null,
    passwordHash: row.passwordHash ?? null,
    status: row.status,
    emailVerifiedAt: toDate(row.email_verified_at),
    failedLoginCount: row.failed_login_count ?? 0,
    lockedUntil: toDate(row.locked_until),
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    twoFactorSecretEnc: row.two_factor_secret_enc ?? null,
    twoFactorPendingSecretEnc: row.two_factor_pending_secret_enc ?? null,
});

const mapSession = (row: any): SessionRecord => ({
    id: String(row.id),
    tokenHash: String(row.token_hash),
    userId: String(row.userId),
    expiresAt: new Date(String(row.expires)),
    createdAt: toDate(row.created_at) ?? undefined,
    lastUsedAt: toDate(row.last_used_at) ?? undefined,
    ip: row.ip ?? null,
    userAgent: row.user_agent ?? null,
    reauthenticatedAt: toDate(row.reauthenticated_at),
});

const mapEmailToken = (row: any): EmailVerificationTokenRecord => ({
    id: String(row.id),
    userId: String(row.user_id),
    tokenHash: String(row.token_hash),
    expiresAt: new Date(String(row.expires_at)),
    createdAt: toDate(row.created_at) ?? undefined,
});

const must = <T>(result: { data: T | null; error: any }, message: string) => {
    if (result.error) throw new Error(`${message}: ${result.error.message}`);
    if (!result.data) throw new Error(`${message}: empty result`);
    return result.data;
};

export const createSupabaseUserRepository = (client: SupabaseClient, tables?: Partial<Tables>): UserRepository => {
    const t = { ...defaultTables, ...tables };
    return {
        async findByEmail(email) {
            const r = await client.from(t.users).select("*").eq("email", email).maybeSingle();
            if (r.error) throw new Error(`findByEmail failed: ${r.error.message}`);
            return r.data ? mapUser(r.data) : null;
        },
        async findById(id) {
            const r = await client.from(t.users).select("*").eq("id", id).maybeSingle();
            if (r.error) throw new Error(`findById failed: ${r.error.message}`);
            return r.data ? mapUser(r.data) : null;
        },
        async create(input) {
            const r = await client
                .from(t.users)
                .insert({
                    email: input.email,
                    passwordHash: input.passwordHash,
                    name: input.name ?? null,
                    image: input.image ?? null,
                    company_name: input.companyName ?? null,
                    status: input.status,
                    email_verified_at: input.emailVerifiedAt ?? null,
                    failed_login_count: input.failedLoginCount ?? 0,
                    locked_until: input.lockedUntil ?? null,
                    two_factor_enabled: input.twoFactorEnabled ?? false,
                })
                .select("*")
                .single();
            return mapUser(must(r, "create user failed"));
        },
        async update(id, input) {
            const payload: any = {};
            if (input.email !== undefined) payload.email = input.email;
            if (input.passwordHash !== undefined) payload.passwordHash = input.passwordHash;
            if (input.name !== undefined) payload.name = input.name;
            if (input.image !== undefined) payload.image = input.image;
            if (input.companyName !== undefined) payload.company_name = input.companyName;
            if (input.status !== undefined) payload.status = input.status;
            if (input.emailVerifiedAt !== undefined) payload.email_verified_at = input.emailVerifiedAt;
            if (input.failedLoginCount !== undefined) payload.failed_login_count = input.failedLoginCount;
            if (input.lockedUntil !== undefined) payload.locked_until = input.lockedUntil;
            if (input.lastLoginAt !== undefined) payload.last_login_at = input.lastLoginAt;
            if (input.twoFactorEnabled !== undefined) payload.two_factor_enabled = input.twoFactorEnabled;
            if (input.twoFactorSecretEnc !== undefined) payload.two_factor_secret_enc = input.twoFactorSecretEnc;
            if (input.twoFactorPendingSecretEnc !== undefined) payload.two_factor_pending_secret_enc = input.twoFactorPendingSecretEnc;

            const r = await client.from(t.users).update(payload).eq("id", id).select("*").single();
            return mapUser(must(r, "update user failed"));
        },
    };
};

export const createSupabaseSessionRepository = (client: SupabaseClient, tables?: Partial<Tables>): SessionRepository => {
    const t = { ...defaultTables, ...tables };
    return {
        async create(input) {
            const r = await client
                .from(t.sessions)
                .insert({
                    token_hash: input.tokenHash,
                    userId: input.userId,
                    expires: input.expiresAt.toISOString(),
                    ip: input.ip ?? null,
                    user_agent: input.userAgent ?? null,
                    last_used_at: new Date().toISOString(),
                })
                .select("*")
                .single();
            return mapSession(must(r, "create session failed"));
        },
        async findByTokenHash(tokenHash) {
            const r = await client.from(t.sessions).select("*").eq("token_hash", tokenHash).maybeSingle();
            if (r.error) throw new Error(`findByTokenHash failed: ${r.error.message}`);
            return r.data ? mapSession(r.data) : null;
        },
        async deleteByTokenHash(tokenHash) {
            const r = await client.from(t.sessions).delete().eq("token_hash", tokenHash);
            if (r.error) throw new Error(`deleteByTokenHash failed: ${r.error.message}`);
        },
        async deleteByUserId(userId) {
            const r = await client.from(t.sessions).delete().eq("userId", userId);
            if (r.error) throw new Error(`deleteByUserId failed: ${r.error.message}`);
        },
        async updateById(sessionId, input) {
            const payload: any = {};
            if (input.lastUsedAt !== undefined) payload.last_used_at = input.lastUsedAt.toISOString();
            if (input.ip !== undefined) payload.ip = input.ip;
            if (input.userAgent !== undefined) payload.user_agent = input.userAgent;
            if (input.reauthenticatedAt !== undefined) payload.reauthenticated_at = input.reauthenticatedAt?.toISOString() ?? null;
            const r = await client.from(t.sessions).update(payload).eq("id", sessionId);
            if (r.error) throw new Error(`updateById session failed: ${r.error.message}`);
        },
    };
};

export const createSupabaseEmailVerificationRepository = (
    client: SupabaseClient,
    tables?: Partial<Tables>
): EmailVerificationRepository => {
    const t = { ...defaultTables, ...tables };
    return {
        async create(input) {
            const r = await client
                .from(t.emailVerificationTokens)
                .insert({
                    user_id: input.userId,
                    token_hash: input.tokenHash,
                    expires_at: input.expiresAt.toISOString(),
                })
                .select("*")
                .single();
            return mapEmailToken(must(r, "create email verification token failed"));
        },
        async findByTokenHash(tokenHash) {
            const r = await client.from(t.emailVerificationTokens).select("*").eq("token_hash", tokenHash).maybeSingle();
            if (r.error) throw new Error(`findByTokenHash failed: ${r.error.message}`);
            return r.data ? mapEmailToken(r.data) : null;
        },
        async deleteByTokenHash(tokenHash) {
            const r = await client.from(t.emailVerificationTokens).delete().eq("token_hash", tokenHash);
            if (r.error) throw new Error(`deleteByTokenHash failed: ${r.error.message}`);
        },
        async deleteByUserId(userId) {
            const r = await client.from(t.emailVerificationTokens).delete().eq("user_id", userId);
            if (r.error) throw new Error(`deleteByUserId failed: ${r.error.message}`);
        },
    };
};

