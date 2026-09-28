const enabled = (value: string | undefined): boolean => value === "true";

export const privateOperationsPresentation = (): Readonly<{ slug: string; apiUrl: string }> | undefined => {
  const explicitEnabled = enabled(import.meta.env.PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED);
  const slug = import.meta.env.PUBLIC_COMMERCE_OPERATIONS_SLUG?.trim();
  const api = import.meta.env.PUBLIC_COMMERCE_OPERATIONS_API_URL?.trim();

  // A configured slug + API URL is sufficient to generate the private static
  // operations route. This avoids silently dropping the route when a hosting
  // provider does not expose the boolean build flag to Astro as expected.
  // With no operations configuration at all (for example ordinary local/CI
  // builds), the route remains disabled.
  if (!explicitEnabled && !slug && !api) return undefined;

  // Never allow a partially configured operations presentation. If any signal
  // enables/configures it, require both values and fail the build loudly.
  if (!slug || !api) {
    throw new Error(
      "Operations UI is configured but PUBLIC_COMMERCE_OPERATIONS_SLUG or PUBLIC_COMMERCE_OPERATIONS_API_URL is missing.",
    );
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Private operations slug must contain only lowercase letters, numbers and hyphens.");
  }

  const url = new URL(api);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Private operations API must use HTTPS outside local development.");
  }

  return Object.freeze({ slug, apiUrl: url.href.replace(/\/$/, "") });
};
