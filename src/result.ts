export interface Failure<E> {
  tag: 'failure';
  error: E;
}
export interface Success<T> {
  tag: 'success';
  value: T;
}

/**
 * Discriminated union used to convey a result from an operation which may fail.
 * It is in fact an Either Monad (refer to functional programming languages).
 *
 * Anyway, a Result is either a Success or a Failure, discriminated by the tag.
 */
export type Result<T, E> = Success<T> | Failure<E>;

export const success = <T, E>(value: T): Success<T> => ({
  tag: 'success',
  value
});

export const failure = <E>(err: E): Failure<E> => ({
  error: err,
  tag: 'failure'
});

export const match = <T, E>(condition: boolean, value: T, err: E): Result<T, E> =>
  condition ? success(value) : failure(err);

export const matchNonEmptyList = <T, E>(
  list: T & { length: number } | undefined,
  err: E
): Result<T, E> => (list && list.length > 0 ? success(list) : failure(err));

export const firstFailureOrSuccess = <E>(list: Result<void, E>[]): Result<void, E> => {
  if (list.length === 0) {
    return success(undefined);
  }
  const failures = list.filter(item => item.tag === 'failure');
  if (failures.length > 0) {
    return failures[0];
  }
  return success(undefined);
};
