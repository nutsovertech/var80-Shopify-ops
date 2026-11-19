Section 1. Policy

Group 1.1 Build and operate within Shopify's platform

1.1.1 Use session tokens for authentication
**Description:** Your embedded app must function properly without relying on third-party cookies or local storage, including when accessed in incognito mode on Chrome.
**Verification guidance:** Check that the app uses Shopify session tokens for authentication rather than relying on third-party cookies or local storage. Look for @shopify/app-bridge-react or @shopify/app-bridge-react-router usage with authenticatedFetch, session token exchange logic, or that the app-bridge.js cdn has been added as a script tag. Verify there are no direct cookie-based auth flows or localStorage-based session management that would fail when third-party cookies are blocked.

1.1.2 Use Shopify checkout
**Description:** Shopify can't guarantee the safety or security of an order that's been placed through an offsite or third party checkout. Apps that bypass checkout or payment processing, or register any transactions through the Shopify API in connection with such activity, are prohibited.
**Verification guidance:** Search the codebase for external checkout URLs, redirect logic pointing to non-Shopify payment or checkout pages, and any code that processes payments or creates orders outside of Shopify's checkout flow.

1.1.3 Direct merchants to the Shopify Theme Store
**Description:** Your app must not allow merchants to download themes. Themes can only be installed via the Shopify Theme Store.
**Verification guidance:** Check if the app contains logic to install, download, or push theme files to a merchant's store. Look for Themes API calls that create or upload themes rather than simply modifying existing theme assets.

1.1.4 Use only factual information
**Description:** Your app and app listing should only include factual information. Apps that falsify data to deceive merchants or buyers, such as fake reviews or false purchase notifications, violate our [Partner Program Agreement](https://www.shopify.ca/partners/terms) and our [Acceptable Use Policy](https://www.shopify.com/legal/aup).
**Verification guidance:** Look for code that generates fake or random sales data, fabricated reviews, or simulated order/traffic statistics for storefront display. Verify that any storefront components (e.g., sales popups, recent-purchase notifications) pull from real store data via Shopify APIs.

1.1.6 Build single-merchant storefronts. Marketplaces should be sales channels
**Description:** Apps that allow merchants to turn their stores into classifieds-style marketplaces cannot be distributed through the Shopify App Store. If you are a marketplace platform aiming to connect to Shopify in order to list products on your marketplace, consider submitting as a [sales channel](https://shopify.dev/docs/apps/selling-strategies/channels).
**Verification guidance:** Check if the app provides multi-seller or marketplace functionality such as seller registration, per-seller dashboards, per-seller order management, or payment splitting among multiple sellers. A single merchant sourcing products from vendors is acceptable; multiple independent sellers operating within one store is not.

1.1.7 Always build Payment Gateway apps using the Payments API and after obtaining authorization
**Description:** Payment Gateway apps must be authorized through an [application process.](https://shopify.dev/apps/payments/getting-started#overview) They must be built using the [Payments API](https://shopify.dev/docs/api/admin-rest/2023-10/resources/payment).
**Verification guidance:** Search for payment processing logic, payment gateway integrations, references to external payment provider API keys, or checkout/cart modifications that add payment methods without the app having read/write_payment_gateway scopes in the TOML file. Only apps submitted through Shopify's payments extension process should handle payment processing.

1.1.8 Build apps for Shopify POS only, not third-party systems
**Description:** Shopify is not currently accepting apps that connect to a POS system outside of Shopify. This applies to all apps that connect to a POS system outside of Shopify.
**Verification guidance:** Check if the app references or integrates with a third-party POS system (e.g., Square, Clover, Lightspeed) for data syncing between Shopify and that POS. Integrations exclusively with Shopify POS or POS connections that are part of an ERP integration are acceptable.

1.1.9 Obtain explicit buyer consent before adding charges
**Description:** Apps can't automatically add or pre-select optional charges to a buyer's cart that increase the total checkout price. Apps can only add optional charges to carts or at checkout after displaying the additional cost in a manner that is clear to the buyer, and upon obtaining explicit buyer consent.
**Verification guidance:** Look for code that adds fees, surcharges, or additional line items at the cart or checkout level. Any fee added must be implemented via a checkout UI extension and require explicit buyer consent before being applied.

1.1.10 Maintain the cheapest shipping option as default
**Description:** Apps can’t alter or re-order shipping options in a manner that increases the default shipping price. The cheapest shipping option must always be selected by default. This restriction doesn’t apply to non-shipping delivery methods, such as in-store pickup, local delivery, and pickup points.
**Verification guidance:** If the app reorders or customizes shipping options at checkout, verify that the cheapest shipping option is set as the default, pre-selected, and first option presented to the buyer.

1.1.13 Duplicate only authorized product information
**Description:** Your app should only duplicate product information that the merchant has the proper permission to use: their own products, officially licensed or dropshipped products. Marketing claims like "import from any store in the world" or "copy the product information from any website", whether using your app or a Chrome extension, are not acceptable.
**Verification guidance:** Review any in-app messaging for language that promotes copying or migrating products the merchant does not own. The app should frame its functionality as migrating or duplicating products the merchant owns or has rights to resell. This does not apply for product sourcing (dropshipping/Print on Demand).

1.1.14 Don't connect merchants to external agencies and developers
**Description:** Apps that connect merchants to agencies and freelancers cannot be distributed through the Shopify App Store.
**Verification guidance:** Check if the app connects merchants with external freelance developers or agencies for hire. Connecting merchants to the app partner's own internal support team or developers is acceptable; acting as a marketplace for third-party development services is not.

1.1.15 Process refunds only through the original payment processor
**Description:** Your app must not offer methods for processing refunds outside of the original payment processor. If your app issues store credits during a refund, it must use either [refundCreate](https://shopify.dev/docs/api/admin-graphql/latest/mutations/refundCreate) or [returnProcess](https://shopify.dev/docs/api/admin-graphql/latest/mutations/returnProcess) to do so.
**Verification guidance:** Search for refund processing logic and verify refunds are issued to the original payment method. Flag any code that refunds to gift cards or cashback wallets. Offering discount codes or gift cards as a separate incentive (not as a refund) is acceptable. Give the user a heads-up that refunding can only be done to the original payment method or store credit using refundCreate or returnProcess and should not offer any other refunds.

1.1.16 Don't provide capital lending
**Description:** Apps that provide capital funding (including but not limited to loans, cash advances, and purchase of receivables) cannot be distributed through the Shopify App Store. These types of services are difficult to monitor on an ongoing basis, and in a manner that makes sure merchants are protected from unsound lending practices.
**Verification guidance:** Look for functionality that offers, promotes, or facilitates financing, capital loans, cash advances, or any form of lending money to merchants.

Group 1.2 Bill through the Shopify Billing API or Shopify App Pricing

1.2.1 Use Shopify App Pricing or the Shopify Billing API
**Description:** Apps that use off-platform billing cannot be distributed through the Shopify App store. Your app must use [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing) or the [Shopify Billing API](https://shopify.dev/docs/apps/billing) for any app charges.
**Verification guidance:** Check for Shopify Billing API usage (e.g., appSubscriptionCreate, appPurchaseOneTimeCreate mutations) or Managed Pricing configuration. Flag any external billing integrations, third-party payment forms for app charges. If no billing logic is found at all, inform the developer that this is fine if the app is truly free, but if any charges are made to the merchant—even through a separate platform or website outside the Shopify app—they must implement Shopify Billing. Charging merchants externally while listing the Shopify app as free is not allowed.

1.2.2 Implement Shopify App Pricing or the Shopify Billing API correctly
**Description:** If your app has any charges, it must correctly implement [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing) or the [Shopify Billing API](https://shopify.dev/docs/apps/billing) to ensure that it can accept, decline and [request approval for charges again on reinstall](https://shopify.dev/docs/apps/billing/subscriptions).
**Verification guidance:** Verify the app uses Shopify App Pricing or the Billing API with proper charge approval and decline handling. Check that the app gracefully handles a merchant declining a charge and that merchants can resubscribe to a plan after reinstalling the app without errors.

1.2.3 Allow pricing plan changes
**Description:** Your app must allow merchants to upgrade and downgrade their pricing plan without having to contact your support team or having to reinstall the app. This includes ensuring that the charges are successfully processed in the application charge history page in the merchant admin.
**Verification guidance:** If the app offers multiple pricing plans, verify that plan switching is handled in-app via the Billing API or Managed Pricing without requiring the merchant to reinstall or contact the developer. Automatic usage-based plan changes are acceptable.

Section 2. Functionality

Group 2.2 Use Shopify's APIs and platform tools

2.2.1 Use Shopify APIs
**Description:** Your app must be configured to use [Shopify's API](https://shopify.dev/docs/admin-api) to ensure it best serves merchants. Apps that don't use or need any Shopify APIs are not permitted.
**Verification guidance:** Search the codebase for any Shopify API client initialization, OAuth flows, session token usage, or Admin API calls. If the app has no Shopify API integration and operates standalone without the need of Shopify API to function, verify it does not prompt users to install a custom app or provide a Shopify API key/secret configuration.

2.2.3 Use the latest version of Shopify App Bridge
**Description:** As of March 13th, 2024, all apps must use [the latest Shopify App Bridge](https://shopify.dev/docs/api/app-bridge-library#getting-started) by adding the `app-bridge.js` script tag before any other script tags. We recommend adding it to the <head> of each document of your app or as the first script element.
**Verification guidance:** Check package.json for @shopify/app-bridge-react or @shopify/app-bridge-react-router dependencies. Search for any CDN imports of App Bridge scripts in the <head>. Flag the app if it is using @shopify/app-bridge, as this is not up to date.

2.2.4 Use the GraphQL Admin API
**Description:** As of April 1, 2025 all new public apps must be built exclusively with the [GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql/latest). As of October 1, 2024 the [REST Admin API](https://shopify.dev/docs/api/admin-rest) is considered a legacy API and should no longer be used. For details and migration steps, visit the [migration guide](https://shopify.dev/docs/apps/build/graphql/migrate).
**Verification guidance:** Search the codebase for Shopify Admin API calls and verify that the app uses GraphQL queries and mutations rather than REST Admin API endpoints. Look for requests to paths such as /admin/api/*/*.json, usage of REST resources or legacy REST clients, and any code that performs admin actions through REST instead of GraphQL. Do not flag REST usage for Theme or Asset API related functionality. Fail if the app relies on REST Admin API for general Shopify admin functionality outside of those exceptions.

2.2.6 Don't display promotions or advertisements in admin extensions
**Description:** Don't use [admin UI blocks, admin actions](https://shopify.dev/docs/apps/design-guidelines/app-structure#admin-ui-extensions), or [admin links](https://shopify.dev/docs/apps/build/admin/admin-links/add-admin-links) to promote your app, promote related apps, or request reviews.
**Verification guidance:** Search for admin UI extension configurations (admin.block.toml, admin.action.toml, admin.link.toml or equivalent extension targets) and inspect their rendered content for promotional language, review request prompts, or cross-promotion of related apps.

2.2.7 Only launch Max modal with merchant interaction
**Description:** Max modal (formerly known as full screen mode) must not launch without a merchant interaction. [Max modal](https://shopify.dev/docs/apps/design-guidelines/app-structure#behavior) can't be launched from the app navigation menu.
**Verification guidance:** Search the codebase for usage of Max modal APIs such as fullscreen mode or ResourcePicker with fullscreen. Verify that any Max modal is triggered only by explicit user interaction (e.g., button click) and is not opened automatically on page load or from navigation sidebar link handlers.

Group 2.3 Provide seamless and secure installation

2.3.1 Initiate installation from a Shopify-owned surface
**Description:** Apps must be installed and initiated only on Shopify services. Your app must not request the manual entry of a myshopify.com URL or a shop's domain during the installation or configuration flow.
**Verification guidance:** Search the codebase for input fields, forms, or URL parameters that accept or reference ".myshopify.com" domains or the first identifying part of the myshopify url (xxx.myshopify.com). Check for any UI prompting the user to manually enter their shop URL. The app should rely on OAuth or session tokens for shop identification instead.

2.3.2 Authenticate immediately after install
**Description:** Your app must immediately authenticate using OAuth before any other steps occur. Merchants should not be able to interact with the user interface (UI) before OAuth.
**Verification guidance:** Trace the app installation flow starting from the install entry point. Verify the app redirects to Shopify's OAuth authorization URL (e.g., /admin/oauth/authorize) with the correct client_id and scopes matching the app's own credentials, not a different application's.

2.3.3 Redirect to the app UI after installation
**Description:** Your app must redirect merchants to the user interface (UI) after they accept permissions access on the OAuth handshake page.
**Verification guidance:** Follow the OAuth callback handler and verify that after receiving the authorization code and completing token exchange, the app redirects the user to the app's main UI route e.g., the embedded app URL within Shopify Admin if embedded or the external page if not embedded. It should not lead to a dead end or the app index page in Shopify Admin.

2.3.4 Require OAuth authentication immediately after reinstall
**Description:** Help merchants easily return to workflows in your app if they choose to reinstall it. Your app must immediately authenticate using [OAuth](https://shopify.dev/docs/apps/auth/oauth) before any other steps occur, even if the merchant has previously installed and then uninstalled your app.
**Verification guidance:** Review the OAuth callback and session/token storage logic to confirm the app handles the case where a shop record already exists. Verify it updates existing tokens rather than failing on duplicate entries, and that no install-once flags or one-time setup flows would block a reinstall.

Section 3. Security

Group 3.1 Protect merchant and buyer data through secure data practices

3.1.1 Use a valid TLS/SSL certificate
**Description:** All data exchanged between a client (such as a merchant's web browser) and your app server should be encrypted using Transport Layer Security (TLS) to ensure that any data transmitted can only be read by your application server. Websites secured by a TLS certificate will display HTTPS and the small padlock icon in the browser address bar. Your app must have a valid [TLS/SSL certificate](https://shopify.dev/docs/apps/store/security/tls-certificates) without any errors.
**Verification guidance:** Check the app's server configuration for TLS/SSL setup. Verify the app serves over HTTPS by inspecting server entry points, environment variables for SSL certificates, and any redirect-to-HTTPS middleware. For non-embedded apps, confirm there is no HTTP-only fallback.

Group 3.2 Request only necessary access scopes

3.2.1 Request read_all_orders access scope only if it provides necessary app functionality
**Description:** If your app is accessing the `read_all_orders` scope, it must demonstrate the need for this scope.
**Verification guidance:** Search for Shopify API calls that fetch orders and check if the app uses read_all_orders scope or queries orders beyond the default 60-day window. Verify the app has functionality such as analytics, reporting, or loyalty features that genuinely require historical order data.

3.2.2 Request write_payment_mandate scope only if it provides necessary app functionality
**Description:** If your app is accessing the `write_payment_mandate` scope, it must demonstrate the need for this scope.
**Verification guidance:** Search the codebase for usage of deferred payment or purchase option APIs (e.g., SellingPlanGroup creation with deferred payment strategies, pre-order or try-before-you-buy policies). Confirm the app implements a selling flow where customers can defer full payment.

3.2.3 Request write_checkout_extensions_apis scope only if it provides necessary app functionality
**Description:** If your app is accessing the `write_checkout_extensions_apis` scope, it must demonstrate the need for this scope.
**Verification guidance:** Search for checkout extension targets or post-purchase extension points (e.g., purchase.thank-you, purchase.checkout, post_purchase). Verify the app provides additional functionality to customers after checkout such as surveys, upsell offers, donations, or similar features.

3.2.4 Request read_advanced_dom_pixel_events scope only if it provides necessary app functionality
**Description:** If your app is accessing the `read_advanced_dom_pixel_events` scope, it must demonstrate the need for this scope. You must use this scope to either implement a heatmap or session recording functionality on checkout pages.
**Verification guidance:** Search for references to read_advanced_dom_pixel_events scope and web pixel or checkout pixel implementations. Verify the app processes DOM-level pixel events and provides checkout heatmap visualization or session recording/replay features in its UI.

3.2.5 Request read_checkout_extensions_chat scope only when required
**Description:** If your app is accessing the `read_checkout_extensions_chat` scope, it must demonstrate the need for this scope.
**Verification guidance:** Search for Chat UI component usage in checkout or thank-you page extensions. Verify the chat widget connects to a human or AI support agent, is scoped to customer support interactions, and does not proactively recommend products before a buyer initiates a help request.

Section 5. Category-specific

Group 5.1 Online store
*Applies if: the codebase contains a `shopify.extension.toml` file with `type = "theme"`*

5.1.1 Use theme app extensions
**Description:** If your app modifies the merchant's theme, you need to use [theme app extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions). You or merchants should not make any code changes to the theme.
**Verification guidance:** Search the codebase for direct theme modifications, such as Theme or Asset API calls, ScriptTag usage, or code that injects into theme files. Also look for code, UI text, or documentation that asks merchants to manually add code to their theme. Verify the app uses theme app extensions or app blocks instead. Warn the user that Theme or Asset API usage requires an approved exemption.

5.1.3 Include detailed onboarding instructions for theme app extensions
**Description:** Your app must have [detailed setup instructions](https://shopify.dev/docs/apps/online-store/theme-app-extensions/ux-guidelines#onboarding-for-app-embed-blocks) on how to install your app embeds and app blocks. We strongly recommend providing a [deep link](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration#deep-linking) to help merchants install and preview your app in their theme.
**Verification guidance:** Look for in-app setup instructions, onboarding flows, or documentation components that guide merchants through enabling app blocks or extensions. Check for deep link generation to the theme editor (e.g., URLs containing /admin/themes/current/editor with app block parameters). Fail if neither setup instructions nor deep links are present in the app's UI code.

5.1.5 Send collected data back to the merchant
**Description:** Return customer data collected through a Shopify hosted service to the merchant's Shopify admin. Specifically, this applies to data collected through the Online Store and Point of Sale sales channels. All data collected must be accessible to merchants and comply with the [Shopify API License and Terms of Use](https://www.shopify.com/legal/api-terms) under section 2.3.17.
**Verification guidance:** Search for code that stores or displays collected customer data. Verify that customer data is either written back to Shopify Admin (via Customer or Metafield APIs) or displayed in an in-app dashboard component. Fail if customer data is collected but only stored externally with no visibility in the Admin or app UI.

Group 5.2 Payment
*Applies if: a `shopify.extension.toml` file declares `type = "payment"` and a `shopify.app.toml` file includes the `write_payment_gateway` scope.*

5.2.4 Use correct payment API scopes
**Description:** Payments apps aren't permitted to use any [Shopify APIs](https://shopify.dev/docs/api) other than the Payments Apps API and [mandatory webhooks](https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks).
**Verification guidance:** Inspect the app's scope declarations in shopify.app.toml and OAuth configuration. For payment apps, only write_payment_gateways and write_payment_sessions are allowed. For payment apps with checkout UI extensions, write_checkout_extension_payments and write_checkout_extension_redeemables are allowed. Fail if any additional scopes (e.g., read_products, read_orders, read_customers) are requested, or if Checkout API, Admin API, or Subscriptions API usage is detected.

5.2.5 Build payment apps as standalone, not embedded
**Description:** Payment apps are not allowed to be embedded into the Shopify Admin. [Manage your embedded app configuration via TOML files.](https://shopify.dev/docs/apps/tools/cli/configuration) Once this is done, please ensure that it is possible to still setup the payments app and be redirected to the correct section in the Shopify Admin after the setup has been completed.
**Verification guidance:** Check if the TOML file has 'embedded=true'. If it does, this needs to be changed to 'false'.

5.2.6 Allow buyers to cancel/abandon payment with the payment gateway
**Description:** Modify your app to allow buyers to cancel or abandon the payment and be redirected back to Shopify’s checkout.
**Verification guidance:** Search the payment gateway integration code for a cancel or abort mechanism during the payment flow. Look for cancel buttons, abort handlers, or API endpoints that allow stopping a payment in progress. Fail if no cancellation path exists in the payment UI or backend handlers.

5.2.7 Redirect merchants back to the Shopify admin using the proper URL
**Description:** Payment gateways must redirect merchants after they have completed all onboarding actions back to the Shopify admin using the following URL: [https://{shop}.myshopify.com/services/payments_partners/gateways/${api_key}/settings](https://{shop}.myshopify.com/services/payments_partners/gateways/$%7Bapi_key%7D/settings)
**Verification guidance:** After the payment gateway onboarding flow completes, check that the code redirects the merchant back to the Shopify Admin (e.g., via a redirect to the Admin URL or a clearly labeled "next step" or "return to Shopify" button). Fail if the merchant is left on the gateway's own pages with no path back to Admin.

5.2.10 Display only Shopify-approved payment methods
**Description:** Update your app to display only Shopify [approved payment methods](https://shopify.dev/docs/apps/payments#supported-payment-methods) to the buyer. Your payment app must not process payment methods that include, but aren't limited to, Apple Pay, Google Pay, Shop Pay, PayPal, and Alipay. Shopify has a direct connection with providers that improves performance and checkout conversion for merchants.
**Verification guidance:** Inspect the payment extension code and configuration for any payment method names, icons, or branding that are not part of Shopify's approved payment methods. Flag any payment methods displayed that appear unofficial or unapproved.

5.2.11 Offer a test mode
**Description:** Your payment app must have a test mode available so that merchants can charge, refund, and process test transactions.
**Verification guidance:** Check the payment extension configuration for test_mode_available. Search the payment, refund, capture, and void session handlers for logic that supports test transactions, such as handling the test field in Shopify’s payment session requests. Warn the user if the app does not appear to support a merchant-enabled test mode in Shopify admin.

5.2.12 Don't upsell any product or features in the payment flow
**Description:** Do not include any product or feature upsells in your payment flow. All redirects must be limited to content intended for payment processing only.
**Verification guidance:** Check the payment extension, checkout UI extension, and any redirect pages for marketing content, promotional banners, upsell offers, or cross-sell components. The payment flow must strictly handle payment acceptance only. Fail if any non-payment promotional content is found.

5.2.13 Appropriately name payment apps
**Description:** Ensure your app name reflects your payment gateway’s legal business name. Exclude marketing text or special characters and spacing. These distractions do not give your app any advantages. If a name appears to have been created with the purpose of gaining a higher listing on an alphabetized list, your app will be rejected.
**Verification guidance:** Check the payment extension configuration for merchant_label and buyer_label. Verify that the payment method name reflects the payment gateway’s legal business name and does not include marketing text, special characters, or unnecessary spacing. Fail if the configured payment name appears promotional or inconsistent with the legal business name.

Group 5.3 Payment facilitator
*Opt-in: only evaluate if the user explicitly asks.*

5.3.3 Must be free for merchants
**Description:** Apps that integrate with an existing payment gateway must be provided to merchants at no extra cost.
**Verification guidance:** Search for any pricing logic, billing API calls (e.g., appSubscriptionCreate, appPurchaseOneTimeCreate), paywall components, or upgrade prompts in the codebase. Verify there are no paid tiers, usage charges, or in-app purchase flows. Fail if any monetization mechanisms are found.

Group 5.4 Purchase option
*Applies if: a `shopify.app.toml` file includes `read/write_customer_payment_methods` and `read/write_own_subscription_contracts` (Subscriptions API) or `read/write_payment_mandate` (deferred payment options) scopes.*

5.4.2 Use correct subscription API scopes
**Description:** Only API scopes that are required for your app to function are permitted. If your app requests the `write_customer_payment_methods` or the `write_own_subscription_contracts` scopes you may need to provide evidence that they're truly necessary for your app to function.
**Verification guidance:** Verify the app uses Shopify's Subscription APIs (e.g., sellingPlanGroupCreate, sellingPlanGroupAddProducts) to offer products as subscriptions, pre-orders, or try-before-you-buy options and that they have the right scopes in the TOML file. Check that the app does not query subscription data created by other apps (e.g., filtering selling plan groups by ownership). Mark likely passing if subscription scopes are not approved.

5.4.3 Don't use incorrect API scopes for purchase option apps
**Description:** Ensure that your app is using the correct API scopes to reflect functionality. Apps that do not use the Selling Plan and subscription contract APIs properly, are not permitted on the App Store. For additional context, refer to [Purchase option access scopes](https://shopify.dev/docs/apps/selling-strategies/purchase-options#access-scopes).
**Verification guidance:** Check the app’s declared access scopes against the purchase option type it implements. Subscription apps should use scopes such as write_products, read_all_orders, read_customer_payment_methods, read_own_subscription_contracts, write_own_subscription_contracts, read_purchase_options, and write_purchase_options. Deferred purchase option apps should use scopes such as write_products, read_all_orders, read_customer_payment_methods, read_purchase_options, write_purchase_options, read_payment_mandate, and write_payment_mandate. Fail if the app requests scopes that do not match its purchase option functionality.

5.4.5 Allow buyers to modify subscription payment methods
**Description:** You must provide buyers with the option to modify their payment method associated with their subscription(s).
**Verification guidance:** Search for UI components or API calls that allow customers to update their payment method on an existing subscription (e.g., customerPaymentMethodSendUpdateEmail mutation, payment method update forms in the customer portal). Fail if no payment method modification flow exists.

5.4.6 Enable merchants to create and manage selling plans from the product page and choose products for subscriptions
**Description:** Implement the product extension to allow merchants to [create and manage selling plans](https://shopify.dev/docs/apps/selling-strategies/purchase-options/app-extensions#how-a-product-subscription-app-extension-looks-in-shopify) from the Shopify's admin product page. Merchants need to be able to choose which products they want as subscriptions.
**Verification guidance:** Check that the app includes a product subscription app extension that renders on the Shopify Admin product page. Verify that merchants can create, add, edit, and remove selling plans from that product page context, and can assign them to the relevant product or variants. Fail if selling plans can only be created or managed outside the Shopify Admin product page.

5.4.7 Include access to your subscription portal through Shopify's customer portal
**Description:** Include access to your app's subscription portal through the Shopify Customer portal. A single login must be used by buyers to access subscriptions and their order history.
**Verification guidance:** Check for a customer portal component or page that is accessible via the customer account section. Verify there is a link to the subscription management portal that customers can access using their original login credentials without requiring separate authentication.

5.4.8 Enable buyers to cancel their purchase option, or clearly communicate cancellation conditions
**Description:** The purchase option app must include an in-product mechanism to allow a buyer to cancel or discontinue their purchase option, for example, a pre-order management portal or a cancel link in an email.
**Verification guidance:** Check that the app provides a customer-facing portal or secure customer flow where buyers can cancel or discontinue the purchase option without merchant intervention. Verify that subscriptions can be canceled and that pre-orders can be canceled or modified. Fail if buyers have no usable in-product cancellation flow.

5.4.9 Navigate buyers to the customer portal
**Description:** Apps that offer subscriptions must include navigation to a customer portal, both on the [order status page](https://help.shopify.com/en/manual/orders/status-tracking) and through a post-purchase email to a merchant's customers so that they're able to manage their subscription.
**Verification guidance:** Check the order status page extensions or thank-you page code for a link to the customer portal. Also search for post-purchase email notification logic (e.g., email templates, notification API calls, or webhook handlers that trigger customer emails after a subscription purchase). Fail if either is missing.

5.4.10 Display purchase options and charge timing clearly
**Description:** Purchase option apps must clearly show buyers the price of the purchase option and when they will be charged. We recommend that this is done through a standalone app extension, as described in the [subscription UX guidelines](https://shopify.dev/docs/themes/pricing-payments/subscriptions/subscription-ux-guidelines#inline-pricing) and [deferred purchase option UX guidelines](https://shopify.dev/docs/themes/pricing-payments/preorder-tbyb/preorder-tbyb-ux-guidelines#product-forms).
**Verification guidance:** Inspect the storefront-facing components (theme app extensions, app blocks, or Liquid snippets) for a widget that displays the subscription price and billing frequency or next charge date. Fail if the purchase option price and charge schedule are not clearly shown on the product or cart page.

5.4.12 Link subscriptions directly to the linked Customers in Shopify Admin
**Description:** Apps that offer subscriptions must include a direct link to [orders](https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create#order-page-in-the-shopify-admin) and [customers](https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create#customers-page-in-the-shopify-admin) in the Shopify admin from the purchase option.
**Verification guidance:** Search the app's customer management section for links that navigate to the Shopify Admin Customers section (e.g., URLs matching /admin/customers/{id}). Verify the links are functional and correctly constructed. Fail if no such links exist.

5.4.13 Show buyers all of their purchased subscriptions in the Customer portal clearly
**Description:** Display all of the buyers' purchased subscriptions through the customer portal. Details must include the associated products, delivery frequency, price, and order schedule. See [this document](https://shopify.dev/docs/apps/selling-strategies/purchase-options/customer-portal) for additional details.
**Verification guidance:** Check that the app writes subscription order data to the customer portal via Shopify APIs (e.g., subscription contract creation, order metafields). Verify that subscription order details appear in the customer account portal. Fail if subscription information is not populated in the customer-facing portal.

5.4.14 Update multi-currency pricing and discount codes correctly on the product page
**Description:** Update your app to support multi-currency functionality properly, so that pricing and discounts correctly show on the product page. Product pricing shouldn't be hard-coded as part of plan names or descriptions.
**Verification guidance:** Check the storefront purchase option components and pricing logic to verify that subscription prices and discounts update automatically when the store currency changes. Verify that pricing is derived from Shopify data rather than hard-coded into selling plan names or descriptions. Fail if subscription pricing or discounts remain fixed to one currency, display the wrong currency, or rely on hard-coded pricing text.

5.4.15 Link subscriptions directly to the linked Orders in Shopify Admin
**Description:** Apps that offer subscriptions must include a direct link to [orders](https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create#order-page-in-the-shopify-admin) and [customers](https://shopify.dev/docs/apps/selling-strategies/subscriptions/contracts/create#customers-page-in-the-shopify-admin) in the Shopify admin from the purchase option.
**Verification guidance:** Check the app’s purchase option management UI for links to the related Shopify order in the Shopify Admin. Verify that merchants can navigate directly to the linked order from the purchase option or subscription record. Fail if the app does not provide a direct link to the related Shopify order.

5.4.16 Display selling plan name in the Cart page
**Description:** Update your app to display the [selling plan name](https://shopify.dev/docs/api/liquid/objects/selling_plan#selling_plan-name) in the [cart page](https://shopify.dev/docs/themes/pricing-payments/purchase-options/subscription-ux-guidelines#cart-page). This name is used to identify the product's purchase option and its details.
**Verification guidance:** Check the cart page or cart notification for subscription line items and verify that the app displays selling_plan.name for the selected selling plan. Fail if subscription products in the cart do not clearly show their selling plan name.

5.4.17 Communicate pre-order delays with pre-stated shipment times to buyers
**Description:** Ensure your app emails a merchant's customers when the merchant updates the [shipment date](https://shopify.dev/docs/apps/selling-strategies/purchase-options/deferred#delivery-policy) to a later date.
**Verification guidance:** Search for logic that updates the customer-facing estimated shipping date for pre-orders when the merchant changes it. Check for webhook handlers or polling mechanisms that sync shipping date changes to the storefront and customer notifications. Fail if shipping date updates are not propagated to the customer.

5.4.18 Clearly indicate details for prepaid items, including unit price, length of subscription, and price per delivery
**Description:** Correct your app's widget feature to clearly show the unit cost for prepaid items and allow merchants to indicate additional shipping costs.
**Verification guidance:** Check the theme app extension on the product page for prepaid subscription details. Verify that buyers can clearly see the unit price, the length of the prepaid subscription, and the price per delivery before purchasing. Fail if the app does not clearly display these details or relies only on the selling plan name or description to communicate them.

5.4.19 Enable variant-level product selection for buyers
**Description:** Your app must have the ability to [select products at the variant level](https://shopify.dev/apps/subscriptions/app-extensions/create#create-a-new-selling-plan-group) within the Shopify Admin product section.
**Verification guidance:** Check the purchase options extension or selling plan management flow and verify that merchants can assign purchase options at the product variant level, not only at the product level. Look for variant-level selection on the product or product variant page, or code that associates selling plans to specific variants. Fail if the app only supports product-level assignment

Group 5.5 Product sourcing
*Opt-in: only evaluate if the user explicitly asks.*

5.5.1 Enable merchants to request fulfillment
**Description:** Use the `fulfillmentOrderSubmitFulfillmentRequest` mutation to allow merchants to request fulfillment from the dropshipping app when an order is created. Refer to [this document](https://shopify.dev/docs/api/admin-graphql/latest/mutations/fulfillmentOrderSubmitFulfillmentRequest?example=Sends+a+fulfillment+request) for additional details.
**Verification guidance:** Check that the app has setup and utilizes the 'fulfillmentOrderSubmitFulfillmentRequest' mutation.

5.5.2 Include details of cost of goods sold
**Description:** Add the cost of products to the Cost field of the merchant's product page to comply with our product sourcing requirements.
**Verification guidance:** Search the codebase for product sync or product creation/update logic and verify that the Cost Per Item field (cost or cost_per_item) is mapped and populated when products are synced from the dropshipping supplier to Shopify.

5.5.5 Verify payment before marking orders as fulfilled
**Description:** Stop your app from automatically marking orders in a pending payment state as fulfilled to comply with our product sourcing requirements. This protects you from financial risk in case you receive a sudden influx of fraudulent orders.
**Verification guidance:** Review order fulfillment logic and verify that orders with a payment status of pending or unpaid are not automatically marked as fulfilled. Check for conditionals gating fulfillment requests on payment completion.

Group 5.6 Checkout customization
*Applies if: a `shopify.extension.toml` file declares `type = "ui-extension"` with clear references to checkout targets (e.g. `target = purchase.checkout.block.render`, or files like `/src/Checkout.*`).*

5.6.2 Give merchants full control over promotional content
**Description:** Don't use checkout extensions to promote your app, promote related apps, or request reviews.
**Verification guidance:** Inspect checkout UI extension source files for any external links, ads, or promotional content unrelated to the merchant's store. Verify that any such content is merchant-configurable (e.g., via settings in the extension TOML or app UI) and does not appear pre-conversion on the checkout page. Payment apps using checkout extensibility are exempt from external redirect restrictions as long as they do not self-promote.

5.6.3 Don't display self-promotion or advertisements in checkout extensions
**Description:** Don't use checkout extensions to promote your app, promote related apps, or request reviews.
**Verification guidance:** Search checkout extension code and checkout editor integrations for any self-promotional content such as app branding, links to related apps, or review solicitation prompts. Flag any instances found.

5.6.5 Get explicit customer consent prior to making any changes that affect the order total in any way
**Description:** Apps can’t automatically add or pre-select optional charges to a buyer’s cart that increase the total checkout price. Apps can only add optional charges to carts or at checkout after displaying the additional cost in a manner that is clear to the buyer, and upon obtaining explicit buyer consent.
**Verification guidance:** Review checkout extension code for any logic that adds, removes, or changes the price of products in the customer's order. Verify that each such modification prompts the customer for explicit consent before applying the change.

5.6.6 Don't add countdown timers to the checkout
**Description:** Checkout UI Extension apps must not add countdown timers to the checkout.
**Verification guidance:** Search checkout extension source files for countdown timers, time-based urgency displays, or any UI patterns that create a false sense of urgency (e.g., "Only X minutes left", animated timers, deadline messaging). Flag any instances found.

5.6.7 Use Chat UI components for customer service
**Description:** Apps that implement Chat UI components on checkout pages must use them to provide customer service via real-time chat as their core feature.
**Verification guidance:** Check the app's scopes or TOML config for read_checkout_extensions_chat. If present, verify that the chat extension's first interaction is support-oriented, that buyers can ask questions to a human or AI agent, and that no product recommendations are shown before the buyer explicitly requests help.

5.6.9 Don't request payment information in checkout UI extension
**Description:** The extension must not request that customers input payment information using a checkout UI extension
**Verification guidance:** Inspect checkout extension code for any UI fields, forms, or prompts that request customer payment information (e.g., credit card numbers, payment details). The extension must not collect payment data directly.

Group 5.7 Sales channel
*Applies if: a `shopify.extension.toml` file declares `type = "channel_config"`.*

5.7.2 Build with Polaris components and style guide
**Description:** Use the required [Polaris components](https://polaris.shopify.com/getting-started) and style guide to build your sales channel. Review how to [build a sales channel](https://shopify.dev/docs/apps/selling-strategies/channels/getting-started).
**Verification guidance:** Review the app's UI components and imports for usage of Shopify Polaris components (e.g., imports from @shopify/polaris). Flag if the app renders its own custom UI elements for standard patterns (cards, buttons, forms, layouts) instead of using Polaris equivalents.

5.7.4 Provide details in the publishing section
**Description:** Show the [current number](https://shopify.dev/tutorials/build-a-sales-channel-onboarding-and-account-connection-flow#front-end) of published products in the publishing section, and provide links to the Shopify bulk editor to view and manage those products.
**Verification guidance:** Check the Sales Channel's publishing section code for display of published product counts and for links or buttons directing merchants to the Shopify bulk editor. Flag if either is missing.

5.7.5 Provide the marketplace link in the channel interface
**Description:** Once products are uploaded to the marketplace, make sure merchants know how to navigate to the marketplace where their products are hosted. This can be in the form of a button or information in the instructions.
**Verification guidance:** Verify the app's UI includes a button, link, or URL that directs merchants to the external marketplace where their products are listed or hosted. If this does not exist, warn the user to add this.

5.7.6 Communicate commission
**Description:** Accurately communicate commissions to merchants to comply with our requirements.
**Verification guidance:** Check the app’s UI for disclosure of any commission fee or commission structure charged to merchants. Verify that the commission information is surfaced clearly in the app, such as in settings, onboarding, or the publishing flow. Remind the user that the same commission information must also be disclosed in the app listing.

5.7.7 Open terms and conditions in a new window
**Description:** Include a terms and conditions section with links that open to a new window in your sales channel to comply with our requirements.
**Verification guidance:** Verify that terms and conditions are accessible to merchants at any point in the app, not only during initial setup or onboarding. Check for a persistent link or page in the app's navigation or settings.

5.7.8 Use banners for approval or rejection of products
**Description:** Communicate approval or rejection for use of your sales channel to merchants using the [banner component](https://polaris.shopify.com/components/feedback-indicators/banner).
**Verification guidance:** Check that the Sales Channel uses a Polaris Banner component to communicate account approval or rejection status to merchants. Flag if approval/rejection is communicated through other means or not at all.

5.7.9 Use Polaris cards in the publishing section
**Description:** Create a publishing section using a card and the annotated layout shown.
**Verification guidance:** Verify the Sales Channel includes a publishing section that uses a Polaris Card component within an AnnotatedLayout (or Layout.AnnotatedSection). Flag if the publishing section uses a different layout pattern.

5.7.10 Redirect to the account section after install
**Description:** After install, redirect merchants to the [account section](https://shopify.dev/tutorials/build-a-sales-channel-onboarding-and-account-connection-flow#account-connection) using the account connection component.
**Verification guidance:** Check the post-install flow and verify that merchants are redirected to the account connection section after installing the Sales Channel. Flag if they land on a different page.

5.7.11 Provide error feedback in the publishing section
**Description:** Report [publishing errors](https://shopify.dev/tutorials/build-a-sales-channel-onboarding-and-account-connection-flow#step-3-manage-errors) for products in the publishing section to comply with our requirements.
**Verification guidance:** Verify the Sales Channel's publishing section displays feedback or error messages when products fail validation or encounter publishing errors. Flag if errors are silently ignored.

5.7.12 Must allow merchants to disconnect their account
**Description:** Allow merchants to [disconnect your sales channel](https://polaris.shopify.com/components/actions/account-connection?) from their store without contacting support to comply with our sales channel configuration requirements.
**Verification guidance:** Check for a disconnect or unlink account action in the app's UI that merchants can use without contacting support. Flag if account disconnection requires manual support intervention.

5.7.13 Display account information properly
**Description:** Ensure that an account section, using the [account connection component](https://polaris.shopify.com/components/actions/account-connection#section-best-practices), is always visible and labelled with your channel name to comply with our sales channel configuration requirements.
**Verification guidance:** Verify the account section includes a visible AccountConnection component (or equivalent) that is labelled with the Sales Channel's name.

5.7.15 Must communicate account approval process
**Description:** The approval process for your sales channel must be communicated to merchants using the [banner component](https://polaris.shopify.com/components/feedback-indicators/banner). Clearly communicate the [account status](https://shopify.dev/tutorials/build-a-sales-channel-onboarding-and-account-connection-flow#account-review-optional-step) the merchant is in. While merchants are awaiting approval, your sales channel must remain in a pending state.
**Verification guidance:** Check that the Sales Channel uses a Polaris Banner component specifically for communicating approval status. Flag if a non-Banner approach is used for this purpose.

5.7.16 Use Sales Attribution
**Description:** You must use a [storefront access token](https://shopify.dev/docs/api/admin-rest/2024-04/resources/storefrontaccesstoken) to attribute an [order to your sales channel](https://shopify.dev/docs/apps/checkout/cart-permalinks/create#step-3-optional-attribute-an-order-to-a-sales-channel). Merchants rely on Shopify to attribute sales accurately.
**Verification guidance:** Search the codebase for cart permalink generation, Storefront API usage, or storefront access token handling used to send buyers from the sales channel to Shopify checkout. Verify that the app appears to use a storefront access token to attribute orders to the sales channel. If the checkout redirect flow is handled outside the reviewed codebase, let the user know this requirement may need to be confirmed outside the app source.

5.7.17 Communicate eligibility issues
**Description:** If the Sales Channel has any qualifying steps, including eligibility requirements or onboarding processes, this must be [communicated in the account connection form](https://shopify.dev/tutorials/build-a-sales-channel-onboarding-and-account-connection-flow#step-6-include-a-setup-flow-for-any-qualifying-steps-or-additional-onboarding-requirements).
**Verification guidance:** Flag if the Sales Channel has qualifying steps not communicated in the Account Connection form. Check that any eligibility requirements or onboarding steps are clearly presented during account connection.

Group 5.8 Post purchase
*Applies if: a `shopify.extension.toml` file declares `type = "checkout_post_purchase"`.*

5.8.1 Add the `write_checkout_extensions_apis` scope
**Description:** The write_checkout_extensions_apis scope has been granted for your app. Familiarize yourself with the [Shopify API License and Terms of Use](https://www.shopify.com/legal/api-terms) to ensure your app remains compliant.
**Verification guidance:** Check the app's scopes configuration (shopify.app.toml or equivalent) for the write_checkout_extensions_apis scope. If the app uses checkout extension APIs but lacks this scope, flag it so the partner can be notified to request it.

5.8.2 Ensure the upsell is transparent to the buyer and include accept and decline buttons
**Description:** To comply with [our guidelines](https://shopify.dev/apps/checkout/post-purchase/ux-guidelines-post-purchase-offers), update your upsell app to be transparent about all costs associated in a buyer's purchase. The buyer must be provided preset accept and decline options on the upsell. You may have set examples to choose from (ie. "Take the deal" / "No thanks", "Buy" / "Decline offer", etc.), however these cannot be modified by a merchant.
**Verification guidance:** Review the post-purchase extension code for any logic that automatically adds products to the cart or checkout without customer interaction. Verify that upsell offers display explicit accept and decline buttons.

5.8.3 Show the same product information on post purchase upsell
**Description:** Ensure your app displays the same product title, product price, and [product image](https://shopify.dev/api/checkout-extensions/components/image) in your upsell as the merchant’s store.
**Verification guidance:** Check that upsell or cross-sell offers displayed by the app use product titles, prices, and images pulled from the merchant's Shopify store data rather than hardcoded or externally sourced values.

5.8.4 Limit consecutive requests displayed to customers
**Description:** Limit consecutive post purchase requests to a maximum of 3 that appear to buyers.
**Verification guidance:** Review the post-purchase or upsell extension flow and count the maximum number of consecutive offers a customer can be shown. Flag if more than 3 consecutive offers (upsell or non-purchase) are possible in a single session.

5.8.5 Correctly assign the purchase option category for each selling plan created
**Description:** App must correctly assign the [purchase option category](https://shopify.dev/docs/apps/selling-strategies/purchase-options#purchase-option-category) in the API for subscriptions, pre-orders, and try before you buy.
**Verification guidance:** Check the app's selling plan creation code and verify that the correct purchase option category (SUBSCRIPTION, PRE_ORDER, or TRY_BEFORE_YOU_BUY) is assigned via the Selling Plan API for each purchase type offered.

5.8.6 Redirect to the order confirmation page when done
**Description:** Post purchase apps must redirect buyers back to the order confirmation page upon completion.
**Verification guidance:** Verify that all post-purchase extension flows return the customer to the Thank You or Order Confirmation page after completion. Flag if the flow redirects elsewhere or leaves the customer on a non-standard page.

5.8.7 Use the calloutbanner component to display callout banners
**Description:** Use the [checkout CalloutBanner](https://shopify.dev/api/checkout-extensions/components/calloutbanner) to display one upsell Callout Banner at the top of the page. Include introductory text, the product name, and discount.
**Verification guidance:** Inspect the post-purchase extension and verify that it uses the CalloutBanner component to display a single upsell banner at the top of the page. Verify that the banner includes introductory text, the product name, and any applicable discount. Fail if the banner is missing, multiple banners are shown, or the required information is not displayed.

5.8.8 Update price breakdown to reflect price changes
**Description:** Display the correct total cost of the upsell offer to the buyer. Your app must dynamically update and reflect price changes if the buyer adjusts the product's quantity or variants.
**Verification guidance:** Test or review the upsell/post-purchase extension code to verify that the displayed price breakdown updates correctly when the customer changes product quantity or selects different variants.

5.8.9 Don't display third party ads or promotions
**Description:** Your post purchase application must not include ads or promotions to other services outside of the merchant’s shop.
**Verification guidance:** Search post-purchase extension code and rendered UI for any third-party advertisements, external service promotions, or links to non-merchant services. Flag any instances found.

5.8.10 Exclude order tracking/status from your post purchase page
**Description:** Post purchase apps must not have any order tracking or status functionality in their post-purchase page.
**Verification guidance:** Check the post-purchase extension for any redirects or links to order tracking functionality. The post-purchase page should not include order tracking features.

Group 5.9 Mobile app builders
*Opt-in: only evaluate if the user explicitly asks.*

5.9.2 Include submission info for the Apple App Store and Google Play
**Description:** Include information about either the Apple App Store or the Google Play store app submission process. Inform the merchant about their wait times and app requirements to comply with our mobile app builder requirements.
**Verification guidance:** Verify the app includes documentation, instructions, or a guided workflow showing merchants how to publish their mobile app on the Apple App Store and/or Google Play Store.

5.9.3 Provide app theme customization or presets
**Description:** Include either a customizable theme builder or preset theme options in your app to comply with our mobile app builder requirements.
**Verification guidance:** Check the app's UI for a theme builder or theme customization interface that allows merchants to customize or select preset themes for the mobile app being built.

Group 5.10 Donation
*Opt-in: only evaluate if the user explicitly asks.*

5.10.1 Give instruction on how to hide add-to-cart on donation products
**Description:** App must include [instructions on how to hide the add-to-cart button](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/hide-add-to-cart-buttons) for any donation product that is created.
**Verification guidance:** Check the app’s onboarding, help documentation, or setup instructions for guidance on how merchants can hide the add-to-cart button for donation products. Verify that the instructions are clear and accessible to the merchant. Fail if the app does not provide guidance on hiding the add-to-cart button for donation products

5.10.2 Provide merchants with proof of donation
**Description:** Donation distribution apps must provide merchants with verifiable proof of donations made within the app interface. This cannot be a tax receipt.
**Verification guidance:** Verify the app's UI includes a section or page displaying proof of donations made (e.g., donation receipts, totals, or transaction history). This must not be a tax receipt.

5.10.3 Indicate operating cost in UI and listing
**Description:** If a portion of the donations are being used to offset the cost of the app, provide a percentage value indicating how much in the user interface as well as the pricing section of the listing.
**Verification guidance:** Check the app's UI for mentions of operating costs. Flag if operating costs are not indicated and remind the user to add the operating cost to the pricing section as a percentage value.

5.10.5 Use a theme app block to add donation products
**Description:** Add a widget to buy the donation product to the product page, cart page or checkout page. This can be implemented using [Theme App Extensions](https://shopify.dev/docs/apps/online-store/theme-app-extensions) or [Checkout UI Extensions](https://shopify.dev/docs/api/checkout-ui-extensions).
**Verification guidance:** Verify the app uses a widget or Theme App Extension (look for theme extension config in shopify.app.toml or a theme-app-extension directory) to add the donation product to the cart on the product page, cart page, or checkout page.

5.10.6 Collect donation funds using PCI-compliant third party gateways or the Billing API
**Description:** Ensure your app collects funds using the [Billing API](https://shopify.dev/docs/apps/billing) or with a [PCI-compliant](https://www.shopify.com/security) third party gateway.
**Verification guidance:** Check that the app collects funds using the Shopify Billing API or a PCI-compliant third-party payment gateway. If the Billing API is used for collecting donations, verify the app itself is free (no subscription charges outside the Billing API). If the app charges a subscription fee, confirm it goes through the Billing API.

5.10.7 Process customer’s donations through Shopify Checkout
**Description:** All customer donations must be routed through Shopify Checkout. Apps that redirect buyers to an external checkout are prohibited.
**Verification guidance:** Verify that donation payments are processed through Shopify Checkout. Search for any external checkout links or redirects that take customers off the Shopify checkout flow to pay for donations. Flag any external payment flows found.
