// Maps Better Auth error codes (from a client call, or the `error` query
// parameter a failed magic link / OAuth / reset redirect adds) to keys under
// `auth.errors` in messages/*.json. Better Auth's own messages are English
// only, so they are never shown directly.
export type AuthErrorKey =
  | "emailRequired"
  | "invalidCredentials"
  | "emailNotVerified"
  | "userExists"
  | "passwordTooShort"
  | "passwordTooLong"
  | "invalidLink"
  | "signUpClosed"
  | "rateLimited"
  | "generic";

export function authErrorKey(
  code: string | undefined,
  status?: number,
): AuthErrorKey {
  if (status === 429) return "rateLimited";
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "invalidCredentials";
    case "EMAIL_NOT_VERIFIED":
      return "emailNotVerified";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "userExists";
    case "PASSWORD_TOO_SHORT":
      return "passwordTooShort";
    case "PASSWORD_TOO_LONG":
      return "passwordTooLong";
    case "INVALID_TOKEN":
    case "invalid_token":
      return "invalidLink";
    case "EMAIL_PASSWORD_SIGN_UP_DISABLED":
    case "new_user_signup_disabled":
    case "signup_disabled":
      return "signUpClosed";
    default:
      return "generic";
  }
}
