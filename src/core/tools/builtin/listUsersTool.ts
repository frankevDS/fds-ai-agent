import { Tool, ToolContext } from '../tool.types';
import { listUsers } from '../../../modules/users/user.service';

export const listUsersTool: Tool<void, unknown> = {
  name: 'list_tenant_users',
  description: "List users belonging to the acting user's tenant.",
  implemented: true,
  async execute(_input: void, ctx: ToolContext) {
    return listUsers(ctx.tenantId);
  },
};
