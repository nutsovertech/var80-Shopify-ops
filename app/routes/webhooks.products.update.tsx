import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { relayGatewayEvent } from "../gateway.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  const eventId = request.headers.get("X-Shopify-Event-Id") || request.headers.get("X-Shopify-Webhook-Id");
  if (!eventId) return new Response("Missing event ID", { status: 400 });
  await relayGatewayEvent(shop, "products/update", eventId, payload);

  return new Response(null, { status: 200 });
};
