import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  operationPermissions,
  type OperationPermission,
  type OperationsPrincipal,
} from "../operations/service.js";

type Environment = Readonly<Record<string, string | undefined>>;
type AccessClaims = JWTPayload & Readonly<{ email?: unknown }>;
type TokenVerifier = (token: string) => Promise<Readonly<{ payload: AccessClaims }>>;

export type CloudflareAccessConfig = Readonly<{
  teamDomain: string;
  audience: string;
  grants: ReadonlyMap<string, readonly OperationPermission[]>;
}>;

export type CloudflareAccessAuthenticator = Readonly<{
  authenticate(request: Request): Promise<OperationsPrincipal | undefined>;
}>;

const isPermission = (value: unknown): value is OperationPermission =>
  typeof value === "string" && operationPermissions.includes(value as OperationPermission);

const normaliseTeamDomain = (value: string | undefined): string => {
  const candidate = value?.trim().replace(/\/+$/, "") ?? "";
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN must be a valid HTTPS team-domain URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !url.hostname.endsWith(".cloudflareaccess.com")
  ) {
    throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN must be an HTTPS *.cloudflareaccess.com origin.");
  }
  return url.origin;
};

const parseGrants = (value: string | undefined): ReadonlyMap<string, readonly OperationPermission[]> => {
  let record: unknown;
  try {
    record = JSON.parse(value?.trim() || "{}");
  } catch {
    throw new Error("OPERATIONS_ACCESS_GRANTS must be a valid JSON object.");
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("OPERATIONS_ACCESS_GRANTS must map operator email addresses to permission arrays.");
  }

  const grants = new Map<string, readonly OperationPermission[]>();
  for (const [identity, permissions] of Object.entries(record)) {
    const email = identity.trim().toLowerCase();
    if (!email || email.length > 254 || !email.includes("@") || !Array.isArray(permissions)) {
      throw new Error("OPERATIONS_ACCESS_GRANTS contains an invalid operator grant.");
    }
    if (
      permissions.length === 0 ||
      new Set(permissions).size !== permissions.length ||
      !permissions.every(isPermission)
    ) {
      throw new Error(`OPERATIONS_ACCESS_GRANTS contains invalid permissions for ${email}.`);
    }
    grants.set(email, Object.freeze([...permissions]));
  }
  return grants;
};

export const loadCloudflareAccessConfig = (environment: Environment): CloudflareAccessConfig => {
  const teamDomain = normaliseTeamDomain(environment.CLOUDFLARE_ACCESS_TEAM_DOMAIN);
  const audience = environment.CLOUDFLARE_ACCESS_AUDIENCE?.trim() ?? "";
  if (!audience || audience.length > 512) {
    throw new Error("CLOUDFLARE_ACCESS_AUDIENCE is required.");
  }
  return Object.freeze({
    teamDomain,
    audience,
    grants: parseGrants(environment.OPERATIONS_ACCESS_GRANTS),
  });
};

const remoteVerifier = (config: CloudflareAccessConfig): TokenVerifier => {
  const jwks = createRemoteJWKSet(new URL(`${config.teamDomain}/cdn-cgi/access/certs`));
  return (token) => jwtVerify(token, jwks, {
    algorithms: ["RS256"],
    issuer: config.teamDomain,
    audience: config.audience,
    requiredClaims: ["exp", "iat", "email"],
    clockTolerance: 5,
  });
};

export const createCloudflareAccessAuthenticator = (
  config: CloudflareAccessConfig,
  verify: TokenVerifier = remoteVerifier(config),
): CloudflareAccessAuthenticator => Object.freeze({
  async authenticate(request: Request): Promise<OperationsPrincipal | undefined> {
    const token = request.headers.get("cf-access-jwt-assertion")?.trim();
    if (!token) return undefined;
    try {
      const { payload } = await verify(token);
      if (typeof payload.email !== "string") return undefined;
      const identity = payload.email.trim().toLowerCase();
      const permissions = config.grants.get(identity);
      if (!permissions) return undefined;
      return Object.freeze({ id: identity, permissions });
    } catch {
      return undefined;
    }
  },
});
