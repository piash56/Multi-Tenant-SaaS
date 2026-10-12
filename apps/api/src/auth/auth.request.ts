import type { Request } from "express";
import type { AuthenticatedPrincipal, TenantContext } from "./auth.types.js";

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedPrincipal;
  tenant?: TenantContext;
  id: string;
}
