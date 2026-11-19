import { randomBytes } from "node:crypto";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { connectGatewayStore, createGatewayBot, updateGatewayPolicy } from "../gateway.server";

const allowedTools = ["shop_info", "products_list", "orders_list", "inventory_list", "product_update"];
const allowedEvents = ["orders/create", "orders/updated", "products/update", "inventory_levels/update"];
const list = (value: FormDataEntryValue | null, allowed: string[]) => [...new Set(String(value || "").split(",").map(x => x.trim()).filter(x => allowed.includes(x)))];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { registry: await connectGatewayStore(session), shop: session.shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await connectGatewayStore(session);
  const form = await request.formData(), intent = String(form.get("intent") ?? "");
  if (intent === "policy") {
    await updateGatewayPolicy(session.shop, form.get("writesEnabled") === "on");
    return { message: "Store policy updated" };
  }
  if (intent === "bot") {
    const tools = list(form.get("botTools"), allowedTools), events = list(form.get("botEvents"), allowedEvents);
    if (!tools.length) return { error: "Select at least one valid tool." };
    const webhookUrl = String(form.get("webhookUrl") || "").trim();
    const webhookSecret = webhookUrl ? randomBytes(32).toString("base64url") : undefined;
    const bot = await createGatewayBot(session.shop, {
      name: String(form.get("botName") || "Store bot"), tools, events,
      writes: form.get("botWritesEnabled") === "on",
      ...(webhookUrl && webhookSecret ? { webhook: { url: webhookUrl, secret: webhookSecret } } : {}),
    });
    return { message: "Bot created and granted to this store", revealedSecret: bot.token, webhookSecret };
  }
  return { error: "Unknown operation." };
};

export default function Settings() {
  const { registry } = useLoaderData<typeof loader>(), result = useActionData<typeof action>();
  return <s-page heading="Access and keys">
    {result?.error && <s-banner heading="Could not save" tone="critical">{result.error}</s-banner>}
    {result?.message && <s-banner heading={result.message} tone="success">
      {result.revealedSecret ? `Copy the bot key now; it will not be shown again: ${result.revealedSecret}${result.webhookSecret ? ` — Receiver HMAC secret: ${result.webhookSecret}` : ""}` : "Changes apply immediately."}
    </s-banner>}
    <s-section heading="Write controls"><Form method="post" data-save-bar><input type="hidden" name="intent" value="policy" /><s-stack direction="block" gap="base">
      <s-paragraph>Global product writes are {registry.settings.product_writes_enabled ? "enabled on the server" : "locked on the server"}. Both global and store controls must be enabled before a bot can write.</s-paragraph>
      <s-switch label="Allow product writes for this store" name="writesEnabled" defaultChecked={registry.store.writes}></s-switch><s-button type="submit" variant="primary">Save policy</s-button>
    </s-stack></Form></s-section>
    <s-section heading="Issue bot key"><Form method="post"><input type="hidden" name="intent" value="bot" /><s-stack direction="block" gap="base">
      <s-text-field label="Bot name" name="botName" required></s-text-field>
      <s-text-area label="Allowed tools (comma separated)" name="botTools" value="shop_info,products_list" rows={3}></s-text-area>
      <s-text-area label="Webhook events (comma separated)" name="botEvents" value="products/update" rows={3}></s-text-area>
      <s-url-field label="Optional HTTPS webhook receiver" name="webhookUrl"></s-url-field>
      <s-switch label="Allow product writes for this bot grant" name="botWritesEnabled"></s-switch><s-button type="submit">Create and grant</s-button>
    </s-stack></Form></s-section>
    <s-section heading="Bots with access"><s-unordered-list>{registry.bots.map(bot => <s-list-item key={bot.id}>{bot.name} — {bot.tools.join(", ")} — {bot.active ? "active" : "paused"}</s-list-item>)}</s-unordered-list></s-section>
    <s-section heading="Recent deliveries"><s-unordered-list>{registry.deliveries.map(item => <s-list-item key={item.id}>{item.topic} — {item.status} — attempts {String(item.attempts)}</s-list-item>)}</s-unordered-list></s-section>
  </s-page>;
}

export const headers: HeadersFunction = args => boundary.headers(args);
