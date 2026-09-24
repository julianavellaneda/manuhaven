import { PUBLIC_ENV_GLOBAL, serverPublicEnv } from "@/lib/public-env";

/**
 * Publishes the browser-visible configuration onto `window` before hydration,
 * so the client bundle does not have to be built against a specific
 * deployment. Render it once, high in the document.
 */
export function PublicEnvScript() {
  // `</script>` inside a JSON string would close this tag early; escaping `<`
  // is the standard defence, and the values are ours, not user input.
  const json = JSON.stringify(serverPublicEnv()).replace(/</g, "\\u003c");

  return (
    <script
      id="manuhaven-public-env"
      dangerouslySetInnerHTML={{
        __html: `window.${PUBLIC_ENV_GLOBAL}=${json};`,
      }}
    />
  );
}
