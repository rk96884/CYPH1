import { assertServerSecretBoundary } from "../config.js";
type Environment = Readonly<Record<string, string | undefined>>;
const flag = (value: string | undefined, name: string) => {
  if (value !== undefined && value !== "true" && value !== "false") throw new Error(`Invalid ${name}.`);
  return value === "true";
};
export const emailAddress = (value: string | undefined, name: string): string => {
  if (!value || value.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) || /[\r\n]/.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
};
export const loadCommunicationConfig = (env: Environment) => {
  assertServerSecretBoundary(env);
  const enabled = flag(env.COMMUNICATIONS_ENABLED, "COMMUNICATIONS_ENABLED");
  const provider = env.COMMUNICATION_PROVIDER ?? "disabled";
  if (!["disabled", "manual-test", "brevo"].includes(provider)) throw new Error("Invalid COMMUNICATION_PROVIDER.");
  if (env.NODE_ENV === "production" && provider === "manual-test") throw new Error("Production cannot use manual-test communications.");
  if (provider === "manual-test" && !["test", "development"].includes(env.NODE_ENV ?? "")) throw new Error("manual-test requires explicit test/development environment.");
  if (enabled && provider === "disabled") throw new Error("Enabled communications require a provider.");
  const liveApproved = flag(env.COMMUNICATIONS_LIVE_SEND_ENABLED, "COMMUNICATIONS_LIVE_SEND_ENABLED");
  if (enabled && provider === "brevo" && (!liveApproved || env.NODE_ENV !== "production")) throw new Error("Brevo requires explicit production live-send approval.");
  if (!enabled || provider !== "brevo") return { enabled, provider, brevo: undefined };
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey || apiKey.length > 512 || /\s/.test(apiKey)) throw new Error("BREVO_API_KEY is required and must be valid.");
  const fromName = env.TRANSACTIONAL_FROM_NAME?.trim();
  if (!fromName || fromName.length > 100 || /[\u0000-\u001f\u007f]/.test(fromName)) throw new Error("Invalid TRANSACTIONAL_FROM_NAME.");
  return { enabled, provider, brevo: { apiKey, fromName,
    fromAddress: emailAddress(env.TRANSACTIONAL_FROM_ADDRESS, "TRANSACTIONAL_FROM_ADDRESS"),
    replyTo: emailAddress(env.TRANSACTIONAL_REPLY_TO_ADDRESS, "TRANSACTIONAL_REPLY_TO_ADDRESS") } };
};
