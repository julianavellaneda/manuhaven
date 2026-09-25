import { headers } from "next/headers";
import { PUBLIC_ENV_GLOBAL, serverPublicEnv } from "@/lib/public-env";

/**
 * Publishes the browser-visible configuration onto `window` before hydration,
 * so the client bundle does not have to be built against a specific
 * deployment. Render it once, high in the document.
 */
export async function PublicEnvScript() {
  // proxy.ts sets the per-request CSP nonce; without it the inline script is
  // blocked by the page's Content-Security-Policy.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // `</script>` inside a JSON string would close this tag early; escaping `<`
  // is the standard defence, and the values are ours, not user input.
  const json = JSON.stringify(serverPublicEnv()).replace(/</g, "\\u003c");

  return (
    <script
      id="manuhaven-public-env"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: `window.${PUBLIC_ENV_GLOBAL}=${json};`,
      }}
    />
  );
}
