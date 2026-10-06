import { describe, expect, it } from "vitest";
import { correlation, covariance, finiteOnly, mean, median, normCdf, normPdf, percentile, stdev, summarize, variance } from "@/lib/finance/stats";
import { FinanceInputError } from "@/lib/finance/errors";

describe("descriptive statistics (Excel equivalents)", () => {
  const data = [2, 4, 4, 4, 5, 5, 7, 9];
  it("mean / median", () => {
    expect(mean(data)).toBe(5);
    expect(median(data)).toBe(4.5);
    expect(median([3, 1, 2])).toBe(2);
  });
  it("variance and stdev, sample and population", () => {
    expect(variance(data, false)).toBe(4);
    expect(stdev(data, false)).toBe(2);
    expect(variance(data)).toBeCloseTo(32 / 7, 12);
    expect(() => variance([1])).toThrow(FinanceInputError);
  });
  it("covariance and correlation", () => {
    const x = [1, 2, 3, 4, 5];
    expect(covariance(x, [2, 4, 6, 8, 10])).toBeCloseTo(5, 12);
    expect(correlation(x, [2, 4, 6, 8, 10])).toBeCloseTo(1, 12);
    expect(correlation(x, [10, 8, 6, 4, 2])).toBeCloseTo(-1, 12);
    expect(correlation(x, [3, 3, 3, 3, 3])).toBe(0);
  });
  it("percentile matches PERCENTILE.INC", () => {
    expect(percentile([1, 2, 3, 4], 0.3)).toBeCloseTo(1.9, 12);
    expect(percentile([15, 20, 35, 40, 50], 0.4)).toBe(29);
    expect(() => percentile([1], 1.5)).toThrow(FinanceInputError);
  });
  it("summarize drops missing values", () => {
    expect(finiteOnly([1, null, Number.NaN, 3, undefined, Infinity])).toEqual([1, 3]);
    expect(summarize([10, null, 12, 20])).toEqual({ count: 3, mean: 14, median: 12, min: 10, max: 20 });
    expect(summarize([null])).toEqual({ count: 0, mean: null, median: null, min: null, max: null });
  });
});

describe("normal distribution", () => {
  it("matches reference values to double precision", () => {
    expect(normCdf(0)).toBe(0.5);
    expect(normCdf(1)).toBeCloseTo(0.8413447460685429, 14);
    expect(normCdf(1.96)).toBeCloseTo(0.9750021048517796, 14);
    expect(normCdf(-3)).toBeCloseTo(0.0013498980316301035, 15);
    expect(normCdf(40)).toBe(1);
    expect(normCdf(-40)).toBe(0);
    expect(normPdf(0)).toBeCloseTo(0.3989422804014327, 15);
  });
});
