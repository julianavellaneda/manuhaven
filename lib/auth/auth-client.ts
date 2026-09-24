import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

// Browser-side auth calls. Same origin as the app, so no baseURL is needed.
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
