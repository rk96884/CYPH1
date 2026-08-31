import { type OperationsService } from "../operations/service.js";
import { handleOperationsRequest } from "../operations/handler.js";
import { type CloudflareAccessAuthenticator } from "./cloudflare-access.js";

export const createProtectedOperationsHandler = (
  service: OperationsService,
  access: CloudflareAccessAuthenticator,
): ((request: Request) => Promise<Response>) => async (request) => {
  const principal = await access.authenticate(request);
  return handleOperationsRequest(request, service, principal);
};
