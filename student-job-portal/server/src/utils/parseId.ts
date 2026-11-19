import { HttpError } from './httpError';

/** Turns a URL parameter such as "12" into a positive integer, or throws a 400. */
export function parseId(value: unknown): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw HttpError.badRequest('Invalid id');
  return id;
}
