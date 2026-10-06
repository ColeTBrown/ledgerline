/**
 * Input validation for the finance library.
 *
 * Conventions used across lib/finance:
 * - Invalid inputs (NaN, wrong sign where a sign is required, empty arrays)
 *   throw {@link FinanceInputError} with a message suitable for an inline
 *   form error.
 * - Valid inputs with no mathematical answer (an IRR that does not exist, an
 *   implied volatility outside no-arbitrage bounds) return `null` instead
 *   of throwing, so the UI can show "No solution".
 * - Rates are decimal fractions (0.05 = 5%) everywhere.
 */
export class FinanceInputError extends RangeError {
  constructor(
    message: string,
    /** Name of the offending input, for mapping to a form field. */
    public readonly field?: string,
  ) {
    super(message);
    this.name = "FinanceInputError";
  }
}

/** Throw unless `value` is a finite number. */
export function assertFinite(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new FinanceInputError(`${field} must be a finite number.`, field);
  }
}

/** Throw unless `value` is finite and > 0. */
export function assertPositive(value: number, field: string): void {
  assertFinite(value, field);
  if (value <= 0) throw new FinanceInputError(`${field} must be greater than zero.`, field);
}

/** Throw unless `value` is finite and ≥ 0. */
export function assertNonNegative(value: number, field: string): void {
  assertFinite(value, field);
  if (value < 0) throw new FinanceInputError(`${field} cannot be negative.`, field);
}

/** Throw unless `value` is a positive integer. */
export function assertPositiveInteger(value: number, field: string): void {
  assertFinite(value, field);
  if (value <= 0 || !Number.isInteger(value)) {
    throw new FinanceInputError(`${field} must be a whole number greater than zero.`, field);
  }
}

/** Throw unless `rate` > -1 (a rate of -100% or lower makes discounting undefined). */
export function assertRate(rate: number, field: string): void {
  assertFinite(rate, field);
  if (rate <= -1) throw new FinanceInputError(`${field} must be greater than -100%.`, field);
}

/** Throw unless the array is non-empty and every element is finite. */
export function assertFiniteArray(values: readonly number[], field: string): void {
  if (!Array.isArray(values) || values.length === 0) {
    throw new FinanceInputError(`${field} must contain at least one value.`, field);
  }
  values.forEach((v, i) => assertFinite(v, `${field}[${i}]`));
}
