export interface ToolContext {
  tenantId: string;
  actingUserId: string;
}

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  /** Marks stubs registered per Section 9 of the architecture plan whose
   * real implementation arrives in a later batch. execute() on these
   * always throws AppError(501, 'not_implemented', ...) rather than
   * returning fabricated data. */
  implemented: boolean;
  execute(input: TInput, ctx: ToolContext): Promise<TOutput>;
}
