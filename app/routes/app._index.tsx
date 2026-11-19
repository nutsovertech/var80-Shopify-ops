import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { connectGatewayStore } from "../gateway.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const response = await admin.graphql(`#graphql
    query StoreOpsDashboard {
      shop { name myshopifyDomain }
      products(first: 5, sortKey: UPDATED_AT, reverse: true) {
        nodes { id title status totalInventory }
      }
    }`);
  const json = await response.json();
  return {
    shop: json.data?.shop,
    products: json.data?.products.nodes ?? [],
    registry: await connectGatewayStore(session, json.data?.shop?.name ?? session.shop),
    grantedScopes: session.scope ?? "",
  };
};

export default function Dashboard() {
  const { shop, products, registry, grantedScopes } = useLoaderData<typeof loader>();
  const ready = registry.store.connection === "connected";
  return (
    <s-page heading="Var80 Store Ops">
      <s-button slot="primary-action" href="/app/settings" variant="primary">{ready ? "Manage access" : "Complete setup"}</s-button>
      {!ready && <s-banner heading="Finish connecting this store" tone="warning">Create a client record before issuing bot keys or granting tools.</s-banner>}
      <s-section heading={shop?.name ?? "Connected store"}>
        <s-grid gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap="base">
          <s-box padding="base" background="subdued" borderRadius="base"><s-text type="strong">Connection</s-text><s-paragraph>{ready ? "Registry active" : "Setup required"}</s-paragraph></s-box>
          <s-box padding="base" background="subdued" borderRadius="base"><s-text type="strong">Bots granted</s-text><s-paragraph>{String(registry.bots.length)}</s-paragraph></s-box>
          <s-box padding="base" background="subdued" borderRadius="base"><s-text type="strong">Write access</s-text><s-paragraph>{registry.store.writes && registry.settings.product_writes_enabled ? "Enabled" : "Locked"}</s-paragraph></s-box>
        </s-grid>
      </s-section>
      <s-section heading="Recently updated products">
        <s-table>
          <s-table-header-row><s-table-header listSlot="primary">Product</s-table-header><s-table-header listSlot="labeled">Status</s-table-header><s-table-header listSlot="labeled" format="numeric">Inventory</s-table-header></s-table-header-row>
          <s-table-body>{products.map((product: { id: string; title: string; status: string; totalInventory: number }) => <s-table-row key={product.id}><s-table-cell>{product.title}</s-table-cell><s-table-cell><s-badge tone={product.status === "ACTIVE" ? "success" : "info"}>{product.status}</s-badge></s-table-cell><s-table-cell>{String(product.totalInventory ?? 0)}</s-table-cell></s-table-row>)}</s-table-body>
        </s-table>
      </s-section>
      <s-section slot="aside" heading="Shopify authorization"><s-paragraph>{shop?.myshopifyDomain}</s-paragraph><s-paragraph>{grantedScopes || "No scopes reported"}</s-paragraph></s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (args) => boundary.headers(args);
