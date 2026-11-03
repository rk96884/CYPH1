import { type OperationsService } from "../operations/service.js";
import { handleOperationsRequest } from "../operations/handler.js";
import { type CloudflareAccessAuthenticator } from "./cloudflare-access.js";
import type { ReturnService } from "../returns/service.js";

import type { FulfilmentService } from "../fulfilment/service.js";
import type { GrowthProspectReader } from "../growth/read-prospects.js";

export const createProtectedOperationsHandler = (
  service: OperationsService,
  access: CloudflareAccessAuthenticator,
  returns?: ReturnService,
  fulfilment?: FulfilmentService,
  growth?: GrowthProspectReader,
): ((request: Request) => Promise<Response>) => async (request) => {
  const principal = await access.authenticate(request);
  return handleOperationsRequest(request, service, principal, returns, fulfilment, growth);
};
