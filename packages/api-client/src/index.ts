import { apiPaths, serviceDefaults } from "@saas/config";
import type { ReadinessHealth, ServiceHealth } from "@saas/shared-types";
import { healthSchema, readinessSchema } from "@saas/validation";

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export class ApiClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: ApiClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? serviceDefaults.apiUrl).replace(/\/$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async getLiveness(): Promise<ServiceHealth> {
    return healthSchema.parse(await this.#request(apiPaths.live));
  }

  async getReadiness(): Promise<ReadinessHealth> {
    return readinessSchema.parse(await this.#request(apiPaths.ready));
  }

  async #request(path: string): Promise<unknown> {
    const response = await this.#fetch(`${this.#baseUrl}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
    return response.json() as Promise<unknown>;
  }
}
