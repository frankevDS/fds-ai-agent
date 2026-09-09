/**
 * Generic ecommerce contract (Section 8/9 of the architecture plan).
 * Tools call THIS interface, never a platform-specific client directly.
 * A WooCommerce adapter implementing this arrives in Batch 3; a Shopify
 * one could be added later without touching any tool or agent code.
 */
export interface EcommerceProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  inStock: boolean;
}

export interface EcommerceOrder {
  id: string;
  status: string;
  total: number;
  currency: string;
}

export interface EcommerceAdapter {
  readonly platform: string;
  searchProducts(query: string): Promise<EcommerceProduct[]>;
  getOrder(orderId: string): Promise<EcommerceOrder | null>;
}
