import crypto from "crypto";
import type { TokenProvider } from "../interfaces/providers.js";

export const createNodeCryptoTokenProvider = (): TokenProvider => ({
    randomToken: (bytes) => crypto.randomBytes(bytes).toString("base64url"),
    randomHex: (bytes) => crypto.randomBytes(bytes).toString("hex"),
    hashToken: (token) => crypto.createHash("sha256").update(token).digest("hex"),
});

