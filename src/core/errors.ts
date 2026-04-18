export type AuthErrorCode =
    | "INVALID_INPUT"
    | "EMAIL_ALREADY_EXISTS"
    | "INVALID_CREDENTIALS"
    | "EMAIL_NOT_VERIFIED"
    | "ACCOUNT_DISABLED"
    | "ACCOUNT_LOCKED"
    | "UNAUTHORIZED"
    | "TOKEN_INVALID"
    | "TOKEN_EXPIRED";

export class AuthError extends Error {
    public readonly code: AuthErrorCode;
    public readonly status?: number;
    public readonly details?: Record<string, any>;

    constructor(code: AuthErrorCode, message: string, args?: { status?: number; details?: Record<string, any> }) {
        super(message);
        this.code = code;
        this.status = args?.status;
        this.details = args?.details;
    }
}

export class InvalidInputError extends AuthError {
    constructor(message = "Invalid input", details?: Record<string, any>) {
        super("INVALID_INPUT", message, { status: 400, details });
    }
}

export class EmailAlreadyExistsError extends AuthError {
    constructor(message = "Email already exists") {
        super("EMAIL_ALREADY_EXISTS", message, { status: 409 });
    }
}

export class InvalidCredentialsError extends AuthError {
    constructor(message = "Invalid credentials") {
        super("INVALID_CREDENTIALS", message, { status: 401 });
    }
}

export class EmailNotVerifiedError extends AuthError {
    constructor(message = "Email not verified") {
        super("EMAIL_NOT_VERIFIED", message, { status: 403 });
    }
}

export class AccountDisabledError extends AuthError {
    constructor(message = "Account disabled") {
        super("ACCOUNT_DISABLED", message, { status: 403 });
    }
}

export class AccountLockedError extends AuthError {
    public readonly lockedUntil: Date;
    constructor(lockedUntil: Date, message = "Account locked") {
        super("ACCOUNT_LOCKED", message, { status: 423, details: { lockedUntil: lockedUntil.toISOString() } });
        this.lockedUntil = lockedUntil;
    }
}

export class UnauthorizedError extends AuthError {
    constructor(message = "Unauthorized") {
        super("UNAUTHORIZED", message, { status: 401 });
    }
}

export class TokenInvalidError extends AuthError {
    constructor(message = "Invalid token") {
        super("TOKEN_INVALID", message, { status: 400 });
    }
}

export class TokenExpiredError extends AuthError {
    constructor(message = "Token expired") {
        super("TOKEN_EXPIRED", message, { status: 400 });
    }
}

export const isAuthError = (error: unknown): error is AuthError =>
    typeof error === "object" && error !== null && "code" in error && typeof (error as any).code === "string";

