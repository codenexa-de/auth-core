import bcrypt from "bcryptjs";
import type { HashProvider } from "../interfaces/providers.js";

export const createBcryptjsHashProvider = (args?: { rounds?: number }): HashProvider => {
    const rounds = args?.rounds ?? 12;
    return {
        hashPassword: async (plain) => bcrypt.hash(plain, rounds),
        verifyPassword: async (plain, hash) => bcrypt.compare(plain, hash),
    };
};

