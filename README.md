# @codenexa/auth-core

Framework-agnostic authentication core for Code Nexa projects.

## Features

- Session-based auth (token creation/validation handled by injected repositories)
- Email verification with hashed tokens + expiration
- Login protection (failed attempts + temporary lockout)
- Optional 2FA flow (challenge + TOTP + backup codes) via injected providers
- Typed errors (`AuthError`) with consistent `code` values

## Install (local workspace)

```bash
cd packages/auth-core
npm install
npm run build
```

## Public API

```ts
import { createAuth } from "@codenexa/auth-core";
```

`createAuth(config, deps)` returns:

- `register(input)`
- `login(input)`
- `login2fa(input)`
- `verifyEmail(input)`
- `getMe(input)`
- `logout(input)`
- `twoFactor.*` (status/setup/verify/disable/backup codes)

## Example Usage

```ts
import {
    createAuth,
    defaultPasswordPolicy,
    defaultEmailTemplates,
    createBcryptjsHashProvider,
    createNodeCryptoTokenProvider,
    systemClock,
} from "@codenexa/auth-core";

const auth = createAuth(
    {
        brandName: "Code Nexa",
        supportEmail: "info@codenexa.de",
        passwordPolicy: defaultPasswordPolicy,
        loginProtection: { maxAttempts: 8, lockDurationMs: 15 * 60 * 1000 },
        session: { durationMs: 30 * 24 * 60 * 60 * 1000, updateLastUsedAfterMs: 5 * 60 * 1000 },
        emailVerification: {
            tokenBytes: 32,
            expiresMs: 24 * 60 * 60 * 1000,
            buildVerifyUrl: (token) => `https://api.codenexa.de/auth/verify?token=${encodeURIComponent(token)}`,
        },
        emails: defaultEmailTemplates,
    },
    {
        userRepo,
        sessionRepo,
        emailVerificationRepo,
        emailProvider,
        hashProvider: createBcryptjsHashProvider({ rounds: 12 }),
        tokenProvider: createNodeCryptoTokenProvider(),
        clock: systemClock,
        auditLogger,
        cipherProvider,
        twoFactorProvider,
        qrCodeProvider,
        twoFactorChallengeRepo,
        twoFactorBackupCodeRepo,
    }
);

const result = await auth.login({ email: "a@b.com", password: "Secret1234" });
if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
    // return challengeToken to client
} else {
    // set HttpOnly cookie with result.sessionToken in your framework
}
```

## Errors

All core services throw typed errors from `src/core/errors.ts` and expose:

- `code` (e.g. `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`)
- `status` (suggested HTTP status)
- `details` (optional structured details)

## Tests

```bash
cd packages/auth-core
npm test
```

