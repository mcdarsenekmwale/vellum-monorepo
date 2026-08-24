/**
 * Prisma relation update helpers.
 *
 * Prisma update operations must use relation syntax (`connect` / `disconnect`)
 * rather than assigning scalar foreign-key fields when a `@relation` is defined.
 * Create operations may accept either form; updates require relation syntax.
 */

/** Payload accepted by Prisma relation update inputs. */
export type PrismaRelationUpdate =
  | { connect: { id: string } }
  | { disconnect: true };

export class RequiredRelationDisconnectError extends Error {
  constructor(field: string) {
    super(`Cannot disconnect required relation "${field}"`);
    this.name = 'RequiredRelationDisconnectError';
  }
}

/**
 * Build a Prisma relation update from an optional foreign-key value.
 *
 * @param id - `undefined` = omit (no change), `null` = disconnect, string = connect
 * @param options.required - When true, `null` throws instead of disconnecting
 */
export function buildRelationUpdate(
  id: string | null | undefined,
  options?: { required?: boolean },
): PrismaRelationUpdate | undefined {
  if (id === undefined) return undefined;
  if (id === null) {
    if (options?.required) {
      throw new RequiredRelationDisconnectError('relation');
    }
    return { disconnect: true };
  }
  return { connect: { id } };
}

/**
 * Assign a relation update onto a Prisma `data` object when the FK value is present.
 */
export function assignRelationUpdate(
  data: Record<string, unknown>,
  relationField: string,
  id: string | null | undefined,
  options?: { required?: boolean },
): void {
  const update = buildRelationUpdate(id, options);
  if (update !== undefined) {
    data[relationField] = update;
  }
}
