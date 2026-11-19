import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { relayGatewayCompliance } from "../gateway.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  const eventId = request.headers.get("X-Shopify-Event-Id") || request.headers.get("X-Shopify-Webhook-Id");
  if (!eventId) return new Response("Missing event ID", { status: 400 });
  await relayGatewayCompliance(shop, "customers/data_request", eventId, payload);
  return new Response();
};
