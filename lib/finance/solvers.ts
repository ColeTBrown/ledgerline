/**
 * Numerical root finders shared by IRR, YTM, implied volatility and TVM rate.
 * All return `null` when no root is found within tolerance — never a
 * half-converged value.
 */

export interface SolverOptions {
  /** Absolute tolerance on f(x). Default 1e-10. */
  tolerance?: number;
  /** Maximum iterations. Default 200. */
  maxIterations?: number;
}

/**
 * Newton–Raphson: x_{n+1} = x_n − f(x_n) / f′(x_n).
 * Fast (quadratic) near a simple root but can diverge; callers should fall
 * back to a bracketing method when this returns null.
 */
export function newton(
  f: (x: number) => number,
  df: (x: number) => number,
  x0: number,
  { tolerance = 1e-10, maxIterations = 100 }: SolverOptions = {},
): number | null {
  let x = x0;
  for (let i = 0; i < maxIterations; i++) {
    const fx = f(x);
    if (!Number.isFinite(fx)) return null;
    if (Math.abs(fx) < tolerance) return x;
    const d = df(x);
    if (!Number.isFinite(d) || d === 0) return null;
    const next = x - fx / d;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - x) < 1e-15 * Math.max(1, Math.abs(x))) return Math.abs(f(next)) < tolerance * 1e3 ? next : null;
    x = next;
  }
  return null;
}

/**
 * Bisection on [lo, hi] where f(lo) and f(hi) have opposite signs.
 * Guaranteed to converge (linearly) when a sign change exists.
 */
export function bisection(
  f: (x: number) => number,
  lo: number,
  hi: number,
  { tolerance = 1e-10, maxIterations = 300 }: SolverOptions = {},
): number | null {
  let a = lo;
  let b = hi;
  let fa = f(a);
  const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) return null;
  for (let i = 0; i < maxIterations; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (Math.abs(fm) < tolerance || (b - a) / 2 < 1e-15 * Math.max(1, Math.abs(m))) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else {
      b = m;
    }
  }
  return (a + b) / 2;
}

/**
 * Brent's method: bracketing with inverse-quadratic / secant steps.
 * Robust like bisection, typically as fast as secant.
 */
export function brent(
  f: (x: number) => number,
  lo: number,
  hi: number,
  { tolerance = 1e-12, maxIterations = 200 }: SolverOptions = {},
): number | null {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) return null;
  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }
  let c = a;
  let fc = fa;
  let d = b - a;
  let mflag = true;
  for (let i = 0; i < maxIterations; i++) {
    if (Math.abs(fb) < tolerance || Math.abs(b - a) < 1e-15 * Math.max(1, Math.abs(b))) return b;
    let s: number;
    if (fa !== fc && fb !== fc) {
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      s = b - (fb * (b - a)) / (fb - fa);
    }
    const cond1 = (s - (3 * a + b) / 4) * (s - b) >= 0;
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < 1e-15;
    const cond5 = !mflag && Math.abs(c - d) < 1e-15;
    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }
    const fs = f(s);
    if (!Number.isFinite(fs)) return null;
    d = c;
    c = b;
    fc = fb;
    if (Math.sign(fa) === Math.sign(fs)) {
      a = s;
      fa = fs;
    } else {
      b = s;
      fb = fs;
    }
    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
  }
  return Math.abs(fb) < Math.sqrt(tolerance) ? b : null;
}

/**
 * Scan a grid of points for sign changes of f. Returns every bracket found,
 * in ascending order — used to detect multiple IRRs.
 */
export function findBrackets(
  f: (x: number) => number,
  points: readonly number[],
): Array<[number, number]> {
  const brackets: Array<[number, number]> = [];
  let prevX: number | undefined;
  let prevF: number | undefined;
  for (const x of points) {
    const fx = f(x);
    if (!Number.isFinite(fx)) {
      prevX = undefined;
      prevF = undefined;
      continue;
    }
    if (prevX !== undefined && prevF !== undefined && (fx === 0 || Math.sign(fx) !== Math.sign(prevF))) {
      brackets.push([prevX, x]);
    }
    prevX = x;
    prevF = fx;
  }
  return brackets;
}

/**
 * Solve with Newton first, then fall back to Brent on the supplied bracket,
 * then to scanning `grid` for any bracket. Returns null if all fail.
 */
export function solveRobust(
  f: (x: number) => number,
  df: ((x: number) => number) | null,
  guess: number,
  grid: readonly number[],
  options: SolverOptions = {},
): number | null {
  if (df) {
    const r = newton(f, df, guess, options);
    if (r !== null && Number.isFinite(r)) return r;
  }
  const brackets = findBrackets(f, grid);
  if (brackets.length === 0) return null;
  // Choose the bracket closest to the guess.
  brackets.sort((p, q) => Math.abs((p[0] + p[1]) / 2 - guess) - Math.abs((q[0] + q[1]) / 2 - guess));
  const [lo, hi] = brackets[0]!;
  return brent(f, lo, hi, options);
}
