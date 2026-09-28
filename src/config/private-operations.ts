const enabled = (value: string | undefined): boolean => value === "true";

export const privateOperationsPresentation = (): Readonly<{ slug: string; apiUrl: string }> | undefined => {
  if (!enabled(import.meta.env.PUBLIC_COMMERCE_OPERATIONS_UI_ENABLED)) return undefined;

  const slug = import.meta.env.PUBLIC_COMMERCE_OPERATIONS_SLUG?.trim();
  const api = import.meta.env.PUBLIC_COMMERCE_OPERATIONS_API_URL?.trim();

  // Fail the static build rather than silently omitting the operations route
  // when the UI has explicitly been enabled with incomplete configuration.
  if (!slug || !api) {
    throw new Error(
      "Operations UI is enabled but PUBLIC_COMMERCE_OPERATIONS_SLUG or PUBLIC_COMMERCE_OPERATIONS_API_URL is missing.",
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
