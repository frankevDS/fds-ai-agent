import { EcommerceAdapter } from './ecommerceAdapter.interface';
import { NullEcommerceAdapter } from './nullEcommerceAdapter';

/**
 * Resolves which ecommerce adapter a tenant should use. Batch 1 always
 * returns NullEcommerceAdapter (no integrations exist yet). Batch 3
 * extends this to look up the tenant's `integrations` row and return a
 * real WooCommerceAdapter when one is connected — nothing calling this
 * registry will need to change when that happens.
 */
export class AdapterRegistry {
  private nullAdapter = new NullEcommerceAdapter();

  async getEcommerceAdapter(_tenantId: string): Promise<EcommerceAdapter> {
    return this.nullAdapter;
  }
}
