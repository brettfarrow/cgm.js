import { describe, test, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Dexcom } from "../src/cgm.js";
import { ServerErrorEnum } from "../src/errors.js";

describe("native fetch transport", () => {
  let server: http.Server;
  let baseUrl: string;
  let redirectedRequests: number;

  beforeAll(async () => {
    redirectedRequests = 0;
    server = http.createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(307, { Location: `${baseUrl}destination` });
        response.end();
      } else if (request.url === "/destination") {
        redirectedRequests++;
        response.end('"unexpected"');
      } else if (request.url === "/stalled-body") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.write("[");
      }
      // /stalled-headers deliberately never sends a response.
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}/`;
  });

  afterAll(async () => {
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    server.closeAllConnections();
    await closed;
  });

  function client(requestTimeout = 1000) {
    const dexcom = new Dexcom({
      username: "testuser",
      password: "testpass",
      requestTimeout,
    });
    dexcom._baseUrl = baseUrl;
    return dexcom;
  }

  test("does not forward a POST body to a redirect destination", async () => {
    await expect(client()._post("redirect", null, { password: "testpass" }))
      .rejects.toThrow(ServerErrorEnum.REDIRECT);
    expect(redirectedRequests).toBe(0);
  });

  test.each(["stalled-headers", "stalled-body"])("aborts %s", async (endpoint) => {
    await expect(client(100)._post(endpoint)).rejects.toThrow(ServerErrorEnum.TIMEOUT);
  });
});
