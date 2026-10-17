import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./index";

const authBody = {
  user: {
    id: "7f8bb459-feb8-493f-b18a-261df75f8047",
    email: "user@example.test",
    displayName: "Test User",
    platformRole: "USER",
    memberships: [],
  },
};

describe("ApiClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the browser global as the receiver for the default fetch", async () => {
    const fetchMock = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(
        new Response(
          JSON.stringify({ status: "ok", service: "api", timestamp: new Date().toISOString() }),
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "http://api.test" });

    await expect(client.getLiveness()).resolves.toMatchObject({ status: "ok", service: "api" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

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

  it("logs in with browser credentials without persisting tokens", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(authBody), { status: 200 }));
    const client = new ApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.login("user@example.test", "Correct-Horse-42!")).resolves.toEqual(authBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/auth/login",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
    expect(JSON.stringify(await fetchMock.mock.calls[0]?.[1])).not.toContain("localStorage");
  });

  it("uses typed admin routes and supports PATCH and DELETE mutations", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ organization: { id: "org", name: "Acme", status: "ACTIVE" } }),
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
    await client.setPlatformOrganizationStatus("org", "ACTIVE");
    await client.removeTeamMember("org", "team", "member");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "PATCH", credentials: "include" }),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("reports safe typed login failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid email or password" }), { status: 401 }),
      );
    const client = new ApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
    await expect(client.login("user@example.test", "Wrong-password-42!")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Invalid email or password",
    } satisfies Partial<ApiError>);
  });

  it("refreshes once and retries current-user loading after an expired access cookie", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Authentication required" }), { status: 401 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "refreshed" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(authBody), { status: 200 }));
    const client = new ApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.getCurrentUser()).resolves.toEqual(authBody);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://api.test/auth/me",
      "http://api.test/auth/refresh",
      "http://api.test/auth/me",
    ]);
  });

  it("stops after one failed refresh", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Authentication required" }), { status: 401 }),
      );
    const client = new ApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces network failures without retry loops", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Network unavailable"));
    const client = new ApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
    await expect(client.getCurrentUser()).rejects.toThrow("Network unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the browser CSRF cookie on credentialed mutations", async () => {
    vi.stubGlobal("document", { cookie: "saas_csrf=browser-token" });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
    await client.logout();

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("X-CSRF-Token")).toBe("browser-token");
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("include");
  });
});
