import {accountEndpoint,authenticatedAccount} from "../lib/accounts";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if ((env as any).PUBLIC_DEMO === "true") {
      const url = new URL(request.url);
      if (url.pathname === "/api/auth") return accountEndpoint(env,request);
      if (url.pathname === "/api/maintenance") return Response.json({error:"Bộ xử lý nền chưa bật trên hosting này."},{status:403});
      const headers = new Headers(request.headers);
      for (const key of [...headers.keys()]) if (key.startsWith("oai-") || key.startsWith("x-suctre-")) headers.delete(key);
      if(url.pathname.startsWith('/api/')){
        const account=await authenticatedAccount(env,request);
        if(!account)return Response.json({error:'Vui lòng đăng nhập.'},{status:401});
        headers.set('oai-authenticated-user-id','club:suctre');
        headers.set('x-suctre-account',account.email);
        headers.set('x-suctre-role',account.role);
        headers.set('x-suctre-name',encodeURIComponent(account.name));
        if(url.pathname==='/api/photos'&&request.method==='POST'&&account.role!=='staff')return Response.json({error:'Chỉ phụ trách thiết bị được tải ảnh.'},{status:403});
      }
      return handler.fetch(new Request(request,{headers}),env,ctx);
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
