type ShopifySession = {
  shop: string;
  accessToken?: string;
  scope?: string | null;
  expires?: Date | null;
  refreshToken?: string | null;
};

export type GatewaySnapshot = {
  store: { shop: string; name: string; active: boolean; writes: boolean; scopes: string; connection: string };
  client: { id: string; name: string; active: boolean };
  bots: Array<{ id: string; name: string; active: boolean; tools: string[]; events: string[]; writes: boolean; webhook: { url: string; configured: boolean } | null }>;
  deliveries: Array<{ id: string; bot_id: string; topic: string; event_id: string; status: string; attempts: number; created_at: string }>;
  settings: { product_writes_enabled: boolean };
};

function configuration() {
  const rawUrl = process.env.GATEWAY_INTERNAL_URL;
  const token = process.env.GATEWAY_INTERNAL_TOKEN;
  if (!rawUrl || !token || token.length < 32) throw new Error("Gateway internal connection is not configured");
  const url = new URL(rawUrl);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  const explicitlyPrivateHttp = process.env.GATEWAY_INTERNAL_ALLOW_HTTP === "true";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && (local || explicitlyPrivateHttp))) throw new Error("Gateway internal URL must use HTTPS outside localhost");
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error("Gateway internal URL must be an origin");
  return { origin: url.origin, token };
}

async function call<T>(shop: string, suffix = "", init: RequestInit = {}): Promise<T> {
  const { origin, token } = configuration();
  const response = await fetch(`${origin}/internal/stores/${encodeURIComponent(shop)}${suffix}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  const value = await response.json().catch(() => ({ error: "Invalid gateway response" })) as { error?: string };
  if (!response.ok) throw new Error(value.error || `Gateway request failed (${response.status})`);
  return value as T;
}

export function connectGatewayStore(session: ShopifySession, name = session.shop) {
  if (!session.accessToken) throw new Error("Shopify session has no access token; reauthorize the app");
  return call<GatewaySnapshot>(session.shop, "/connect", {
    method: "POST",
    body: JSON.stringify({
      name,
      access_token: session.accessToken,
      scope: session.scope ?? "",
      expires_at: session.expires?.getTime() ?? null,
      refresh_token: session.refreshToken ?? undefined,
    }),
  });
}

export function updateGatewayPolicy(shop: string, writes: boolean) {
  return call<GatewaySnapshot>(shop, "/policy", { method: "PATCH", body: JSON.stringify({ writes }) });
}

export function createGatewayBot(shop: string, input: { name: string; tools: string[]; events: string[]; writes: boolean; webhook?: { url: string; secret: string } }) {
  return call<{ id: string; token: string }>(shop, "/bots", { method: "POST", body: JSON.stringify(input) });
}

export function relayGatewayEvent(shop: string, topic: string, eventId: string, payload: unknown) {
  return call<{ received: boolean }>(shop, "/events", { method: "POST", body: JSON.stringify({ topic, event_id: eventId, payload }) });
}

export function relayGatewayCompliance(shop: string, topic: string, eventId: string, payload: unknown) {
  return call<{ received: boolean }>(shop, "/compliance", { method: "POST", body: JSON.stringify({ topic, event_id: eventId, payload }) });
}

export function revokeGatewayStore(shop: string) {
  return call<{ revoked: boolean }>(shop, "/uninstall", { method: "POST", body: "{}" });
}
