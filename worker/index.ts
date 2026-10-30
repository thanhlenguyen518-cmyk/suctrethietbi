import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if ((env as any).PUBLIC_DEMO === "true") {
      // Isolate demo data by browser; never accept visitor-supplied identity headers.
      const url = new URL(request.url);
      if (url.pathname === "/api/maintenance") return new Response("Disabled in public demo", {status: 403});
      const existing = request.headers.get("cookie")?.match(/(?:^|;\s*)suctre_demo=([a-f0-9-]{36})(?:;|$)/)?.[1];
      const id = existing || crypto.randomUUID();
      const headers = new Headers(request.headers);
      for (const key of [...headers.keys()]) if (key.startsWith("oai-")) headers.delete(key);
      headers.set("oai-authenticated-user-id", "demo:" + id);
      headers.set("oai-authenticated-user-email", "demo@example.invalid");
      const response = await handler.fetch(new Request(request, {headers}), env, ctx);
      const result = new Response(response.body, response);
      if (!existing) result.headers.append("Set-Cookie", `suctre_demo=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
      return result;
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
