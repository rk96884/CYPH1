const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONSENT_VERSION = "2026-08-20";
const json = (body, status, origin) => new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin", "Cache-Control": "no-store" } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://www.cyph1.co.uk";
    if (origin !== allowedOrigin) return json({ message: "Origin not allowed." }, 403, allowedOrigin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin", "Cache-Control": "no-store" } });
    if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, allowedOrigin);
    let payload;
    try { payload = await request.json(); } catch { return json({ message: "Invalid request." }, 400, allowedOrigin); }
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken : "";
    if (!payload.consent || !EMAIL_PATTERN.test(email) || email.length > 254) return json({ message: "Enter a valid email address and confirm your consent." }, 400, allowedOrigin);
    if (!turnstileToken) return json({ message: "Complete the verification check." }, 400, allowedOrigin);
    const verification = new FormData();
    verification.set("secret", env.TURNSTILE_SECRET_KEY); verification.set("response", turnstileToken);
    const remoteIp = request.headers.get("CF-Connecting-IP"); if (remoteIp) verification.set("remoteip", remoteIp);
    const turnstileResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: verification });
    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success || turnstileResult.hostname !== "www.cyph1.co.uk") return json({ message: "Verification failed. Please try again." }, 400, allowedOrigin);
    const brevoResponse = await fetch("https://api.brevo.com/v3/contacts/doubleOptinConfirmation", { method: "POST", headers: { "Content-Type": "application/json", "api-key": env.BREVO_API_KEY }, body: JSON.stringify({ email, attributes: { CONSENT_VERSION, CONSENT_SOURCE: "cyph1.co.uk early-access form", CONSENT_SUBMITTED_AT: new Date().toISOString() }, includeListIds: [Number(env.BREVO_LIST_ID || 3)], templateId: Number(env.BREVO_TEMPLATE_ID || 1), redirectionUrl: env.CONFIRM_REDIRECT_URL || "https://www.cyph1.co.uk/early-access/confirmed/" }) });
    if (!brevoResponse.ok) { console.error("Brevo request failed", brevoResponse.status); return json({ message: "We couldn’t submit your request. Please try again later." }, 502, allowedOrigin); }
    return json({ ok: true }, 201, allowedOrigin);
  },
};
