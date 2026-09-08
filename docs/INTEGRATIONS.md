# INTEGRATIONS — FDS AI Agent

## Pattern (Section 8 of the architecture plan)

Tools never call an ecommerce platform's API directly. They call a
generic interface; an adapter registry resolves which concrete
implementation a given tenant should use.

```
Tool (e.g. search_products)
   -> AdapterRegistry.getEcommerceAdapter(tenantId)
   -> EcommerceAdapter interface
   -> [Batch 1: NullEcommerceAdapter | Batch 3+: WooCommerceAdapter, ShopifyAdapter, ...]
```

## What exists as of Batch 1

- `EcommerceAdapter` interface (`src/core/integrations/ecommerceAdapter.interface.ts`)
  — `searchProducts()`, `getOrder()`.
- `NullEcommerceAdapter` — the only implementation so far. Every method
  throws a 501 `not_implemented` error. This is intentional: no tenant
  has connected a real store yet, and the alternative (returning
  invented products) would violate the "never fake functionality" rule.
- `AdapterRegistry.getEcommerceAdapter()` currently always returns the
  null adapter, regardless of tenant. Batch 3 will change this to look
  up the tenant's `integrations` table row and return a real
  `WooCommerceAdapter` when one is connected.

## What's NOT IMPLEMENTED

WooCommerce, Shopify, payment, and communication (email/WhatsApp/SMS)
adapters. The `integrations` table itself (to store per-tenant
credentials) doesn't exist yet either — it's part of Batch 3.
