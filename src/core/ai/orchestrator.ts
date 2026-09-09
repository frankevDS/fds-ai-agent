import { ToolRegistry } from '../tools/toolRegistry';
import { ToolContext } from '../tools/tool.types';
import { EventBus } from '../events/eventBus';

/**
 * Batch 1 scope: a thin dispatcher from "run this named tool with this
 * input" to the tool's execute(), with every call logged as an event.
 * This is deliberately NOT an LLM-driven agent yet — there is no
 * reasoning here about WHICH tool to call. That arrives in Batch 4
 * (Customer AI), once there's a knowledge base and real conversations
 * to reason over. What Batch 1 establishes is the seam Batch 4 will
 * plug an LLM into.
 */
export class Orchestrator {
  constructor(private tools: ToolRegistry, private events: EventBus) {}

  async runTool(toolName: string, input: unknown, ctx: ToolContext): Promise<unknown> {
    const tool = this.tools.get(toolName);
    try {
      const result = await tool.execute(input, ctx);
      await this.events.publish({
        tenantId: ctx.tenantId,
        type: 'tool.executed',
        payload: { toolName, actingUserId: ctx.actingUserId, success: true },
      });
      return result;
    } catch (err) {
      await this.events.publish({
        tenantId: ctx.tenantId,
        type: 'tool.executed',
        payload: {
          toolName,
          actingUserId: ctx.actingUserId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  listTools() {
    return this.tools.list();
  }
}
