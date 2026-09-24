import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { createProfile } from "@/lib/db/queries/users";
import { appOrigin } from "@/lib/seo";
import { sendAuthEmail } from "./emails";
import { authFeatures } from "./features";

function createAuth() {
  const features = authFeatures();
  const disableSignUp = !features.signUp;

  return betterAuth({
    baseURL: appOrigin(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    advanced: {
      // Every domain FK is a uuid column (see lib/db/schema.ts).
      database: { generateId: "uuid" },
    },
    rateLimit: {
      // On in every environment, and stored in Postgres so a restart does not
      // reset it. Better Auth's defaults tighten sign-in and reset paths.
      enabled: true,
      storage: "database",
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp,
      requireEmailVerification: features.requireEmailVerification,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }, request) => {
        await sendAuthEmail("resetPassword", user.email, url, request?.headers);
      },
    },
    emailVerification: {
      sendOnSignUp: features.requireEmailVerification,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }, request) => {
        await sendAuthEmail("verifyEmail", user.email, url, request?.headers);
      },
    },
    socialProviders: features.google
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            disableSignUp,
          },
        }
      : undefined,
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await createProfile(user);
          },
        },
      },
    },
    plugins: [
      magicLink({
        disableSignUp,
        sendMagicLink: async ({ email, url }, ctx) => {
          await sendAuthEmail("magicLink", email, url, ctx?.headers);
        },
      }),
      // Must stay last: lets server actions and route handlers set cookies.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

// Lazy for the same reason as getDb(): importing this module during
// `next build` must not need a database or secrets.
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
