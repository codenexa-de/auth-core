import type { AuthConfig } from "../config/config.js";
import type { AuthDeps } from "./deps.js";
import { getMeService } from "./getMe.service.js";
import { loginService } from "./login.service.js";
import { logoutService } from "./logout.service.js";
import { registerService } from "./register.service.js";
import { verifyEmailService } from "./verifyEmail.service.js";
import {
    disableTwoFactorService,
    getTwoFactorStatusService,
    loginTwoFactorService,
    regenerateTwoFactorBackupCodesService,
    startTwoFactorSetupService,
    verifyTwoFactorSetupService,
} from "./twofactor.service.js";

export type CreateAuthDeps = Omit<AuthDeps, "config">;

export const createAuth = (config: AuthConfig, deps: CreateAuthDeps) => {
    const boundDeps: AuthDeps = { ...deps, config };

    return {
        register: (input: Parameters<typeof registerService>[0]) => registerService(input, boundDeps),
        login: (input: Parameters<typeof loginService>[0]) => loginService(input, boundDeps),
        login2fa: (input: Parameters<typeof loginTwoFactorService>[0]) => loginTwoFactorService(input, boundDeps),
        verifyEmail: (input: Parameters<typeof verifyEmailService>[0]) => verifyEmailService(input, boundDeps),
        getMe: (input: Parameters<typeof getMeService>[0]) => getMeService(input, boundDeps),
        logout: (input: Parameters<typeof logoutService>[0]) => logoutService(input, boundDeps),
        twoFactor: {
            status: (input: Parameters<typeof getTwoFactorStatusService>[0]) => getTwoFactorStatusService(input, boundDeps),
            setupStart: (input: Parameters<typeof startTwoFactorSetupService>[0]) => startTwoFactorSetupService(input, boundDeps),
            setupVerify: (input: Parameters<typeof verifyTwoFactorSetupService>[0]) => verifyTwoFactorSetupService(input, boundDeps),
            disable: (input: Parameters<typeof disableTwoFactorService>[0]) => disableTwoFactorService(input, boundDeps),
            backupCodesRegenerate: (input: Parameters<typeof regenerateTwoFactorBackupCodesService>[0]) =>
                regenerateTwoFactorBackupCodesService(input, boundDeps),
        },
    };
};

