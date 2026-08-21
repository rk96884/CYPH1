# CYPH/1 early-access Worker

This Worker validates Turnstile tokens and requests Brevo double opt-in emails. Email addresses are sent in a JSON request body and are never placed in a URL.

Encrypted secrets: `BREVO_API_KEY`, `TURNSTILE_SECRET_KEY`.

Variables: `ALLOWED_ORIGIN`, `BREVO_LIST_ID`, `BREVO_TEMPLATE_ID`, and `CONFIRM_REDIRECT_URL`. After deployment, configure the website build with `PUBLIC_SIGNUP_API_URL` and `PUBLIC_TURNSTILE_SITE_KEY`.
