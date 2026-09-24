import "server-only";

import { isEmailEnabled } from "@/lib/email/mailer";

/** Which sign-in methods this deployment offers. Read from env at runtime. */
export type AuthFeatures = {
  /** New accounts may be created (AUTH_ALLOW_SIGNUP, default true). */
  signUp: boolean;
  /** Magic links and password resets (needs SMTP outside development). */
  email: boolean;
  /** Google OAuth (needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET). */
  google: boolean;
  /** AUTH_REQUIRE_EMAIL_VERIFICATION, honoured only when email works. */
  requireEmailVerification: boolean;
};

export function authFeatures(): AuthFeatures {
  const email = isEmailEnabled();
  return {
    signUp: process.env.AUTH_ALLOW_SIGNUP !== "false",
    email,
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    requireEmailVerification:
      email && process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
  };
}
