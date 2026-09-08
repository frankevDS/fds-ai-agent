import { Tool, ToolContext } from '../tool.types';
import { getCurrentTenant } from '../../../modules/tenants/tenant.service';

/**
 * A REAL tool (not a stub) — proves the tool -> service -> RLS-scoped DB
 * path works end to end, using data that already exists from Batch 0.
 */
export const getTenantInfoTool: Tool<void, unknown> = {
  name: 'get_tenant_info',
  description: "Get the acting user's tenant profile (name, slug, status).",
  implemented: true,
  async execute(_input: void, ctx: ToolContext) {
    return getCurrentTenant(ctx.tenantId);
  },
};
