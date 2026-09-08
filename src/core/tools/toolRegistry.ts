import { Tool } from './tool.types';
import { AppError } from '../../middleware/errorHandler';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new AppError(500, 'tool_conflict', `Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new AppError(404, 'tool_not_found', `No such tool: ${name}`);
    }
    return tool;
  }

  list(): Array<{ name: string; description: string; implemented: boolean }> {
    return Array.from(this.tools.values())
      .map((t) => ({ name: t.name, description: t.description, implemented: t.implemented }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
