import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "./index";

describe("ApiClient", () => {
  it("validates a liveness response", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: "ok", service: "api", timestamp: new Date().toISOString() }),
        ),
      );
    const client = new ApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
    await expect(client.getLiveness()).resolves.toMatchObject({ status: "ok", service: "api" });
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/health/live", expect.any(Object));
  });
});
