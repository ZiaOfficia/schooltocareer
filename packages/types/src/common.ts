/** Small, shared type-level helpers. No runtime code in this file. */

export type Maybe<T> = T | null | undefined;
export type Nullable<T> = T | null;

/** Nominal typing, so a Slug is not accidentally interchangeable with a title. */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Slug = Brand<string, 'Slug'>;
export type EntityId = Brand<string, 'EntityId'>;
export type UrlPath = Brand<string, 'UrlPath'>;
export type IsoDateString = Brand<string, 'IsoDateString'>;

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

/** Makes selected keys required while leaving the rest optional. */
export type RequireKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Serialised form of an entity as it crosses the API boundary. */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K] extends bigint
        ? string
        : T[K];
};

/**
 * Result type for operations whose failure is an expected outcome rather than
 * an exception — slug collisions, optimistic-concurrency conflicts. Throwing
 * for control flow makes the happy path unreadable at the service layer.
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Exhaustiveness guard for switch statements over union types. */
export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
