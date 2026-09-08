import { Tool, ToolContext } from '../tool.types';
import { AdapterRegistry } from '../../integrations/adapterRegistry';
import { EcommerceProduct } from '../../integrations/ecommerceAdapter.interface';

export interface SearchProductsInput {
  query: string;
}

/**
 * A REAL tool whose implementation genuinely delegates to the
 * integration layer (Section 8) rather than touching any ecommerce
 * platform directly — it just has nothing connected to delegate TO yet,
 * so calling it currently surfaces the adapter's honest 501.
 */
export function createSearchProductsTool(adapters: AdapterRegistry): Tool<SearchProductsInput, EcommerceProduct[]> {
  return {
    name: 'search_products',
    description: 'Search the tenant\'s connected store for products matching a query.',
    implemented: true,
    async execute(input: SearchProductsInput, ctx: ToolContext) {
      const adapter = await adapters.getEcommerceAdapter(ctx.tenantId);
      return adapter.searchProducts(input.query);
    },
  };
}
