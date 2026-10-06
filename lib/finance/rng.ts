/**
 * Seeded pseudo-random numbers so simulations are reproducible
 * (same seed → same paths, which matters for audit and client reports).
 */

/** Mulberry32: fast 32-bit PRNG returning uniforms in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal generator using the Box–Muller transform:
 *   Z₀ = √(−2 ln U₁)·cos(2πU₂),  Z₁ = √(−2 ln U₁)·sin(2πU₂)
 */
export function normalGenerator(uniform: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u1 = 0;
    while (u1 === 0) u1 = uniform();
    const u2 = uniform();
    const r = Math.sqrt(-2 * Math.log(u1));
    spare = r * Math.sin(2 * Math.PI * u2);
    return r * Math.cos(2 * Math.PI * u2);
  };
}
