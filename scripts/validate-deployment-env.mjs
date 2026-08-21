const requiredPublicVariables = [
  "PUBLIC_SIGNUP_API_URL",
  "PUBLIC_TURNSTILE_SITE_KEY",
];

const failures = [];

for (const name of requiredPublicVariables) {
  const value = process.env[name]?.trim();

  if (!value) {
    failures.push(`${name} is missing`);
    continue;
  }

  if (name.endsWith("_URL")) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") failures.push(`${name} must use HTTPS`);
    } catch {
      failures.push(`${name} must be a valid absolute URL`);
    }
  }
}

if (failures.length) {
  console.error("Deployment configuration is invalid:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Deployment configuration is valid.");

