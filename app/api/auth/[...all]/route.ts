import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/auth";

// Better Auth's endpoints: sign-in/up, sign-out, magic links, password reset,
// OAuth callbacks. The only unauthenticated routes besides /api/health.
export const { GET, POST } = toNextJsHandler((request) =>
  getAuth().handler(request),
);
