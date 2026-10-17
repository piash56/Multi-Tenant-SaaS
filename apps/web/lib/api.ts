import { ApiClient } from "@saas/api-client";

export const api = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api",
});
