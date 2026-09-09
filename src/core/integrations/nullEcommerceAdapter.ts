import { EcommerceAdapter } from './ecommerceAdapter.interface';
import { AppError } from '../../middleware/errorHandler';

/**
 * DEVELOPMENT MOCK / default adapter for tenants with no ecommerce
 * platform connected. Every method fails loudly (501) instead of
 * returning invented products or orders — see Section 41 of the
 * architecture plan ("never fake functionality").
 */
export class NullEcommerceAdapter implements EcommerceAdapter {
  readonly platform = 'none';

  async searchProducts(): Promise<never> {
    throw new AppError(501, 'not_implemented', 'No ecommerce platform is connected for this tenant yet.');
  }

  async getOrder(): Promise<never> {
    throw new AppError(501, 'not_implemented', 'No ecommerce platform is connected for this tenant yet.');
  }
}
