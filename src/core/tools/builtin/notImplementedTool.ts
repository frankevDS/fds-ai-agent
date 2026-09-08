import { Tool } from '../tool.types';
import { AppError } from '../../../middleware/errorHandler';

/**
 * Registers the name/description of a future business tool (see Section 9
 * of the architecture plan) without faking its behavior. Calling one
 * always fails loudly with a 501 rather than returning invented data —
 * this is the "clearly state NOT IMPLEMENTED" rule from the master
 * prompt applied at the tool layer.
 */
export function defineNotImplementedTool(name: string, description: string): Tool {
  return {
    name,
    description,
    implemented: false,
    async execute(): Promise<never> {
      throw new AppError(
        501,
        'not_implemented',
        `Tool '${name}' is not implemented yet. It is planned for a later batch.`
      );
    },
  };
}
