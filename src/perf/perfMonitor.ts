/**
 * Lightweight runtime performance monitor for local profiling.
 *
 * How to enable:
 * - URL query flag: `?perf=1` (disable with `?perf=0`)
 * - Local storage flag: `localStorage.setItem("threeBodyPerf", "1")`
 *   Disable with `localStorage.setItem("threeBodyPerf", "0")`
 *
 * Behavior:
 * - When disabled, calls are effectively no-ops.
 * - When enabled, metrics are aggregated and flushed to the console every ~2s.
 * - Duration stats are window-scoped: they reset after each flush.
 * - Flush output uses `console.groupCollapsed` + `console.table`.
 *
 * What it collects:
 * - Durations (`recordDuration` / `measure`):
 *   rolling samples (capped), then `count`, `avgMs`, `p95Ms`, `p99Ms`, `maxMs`.
 * - Counters (`incrementCounter`):
 *   total count per metric and derived rate (`perSecond`) per flush window.
 * - Gauges (`recordGauge`):
 *   latest numeric value per metric at flush time.
 * - React render metrics (`recordReactRender`):
 *   commit counters + actual/base duration series per profiler id.
 */
type DurationStats = {
  count: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
};

type DurationSummary = Record<string, DurationStats>;
type CounterSummary = Record<string, { count: number; perSecond: number }>;
type GaugeSummary = Record<string, number>;

type PerfSnapshot = {
  elapsedMs: number;
  durations: DurationSummary;
  counters: CounterSummary;
  gauges: GaugeSummary;
};

const LOCAL_STORAGE_KEY = "threeBodyPerf";
const QUERY_PARAM = "perf";
const SAMPLE_CAP = 300;
const FLUSH_INTERVAL_MS = 2000;

const percentile = (sorted: number[], pct: number): number => {
  if (sorted.length === 0) {
    return 0;
  }
  const position = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * pct)));
  return sorted[position];
};

const summarizeDuration = (samples: number[]): DurationStats => {
  if (samples.length === 0) {
    return { count: 0, avgMs: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }
  let total = 0;
  let maxMs = 0;
  for (const sample of samples) {
    total += sample;
    if (sample > maxMs) {
      maxMs = sample;
    }
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    count: samples.length,
    avgMs: total / samples.length,
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs,
  };
};

const readQueryPerfFlag = (): boolean | null => {
  try {
    const raw = new URLSearchParams(window.location.search).get(QUERY_PARAM);
    if (raw === "1" || raw === "true" || raw === "on") {
      return true;
    }
    if (raw === "0" || raw === "false" || raw === "off") {
      return false;
    }
  } catch {
    return null;
  }
  return null;
};

const readStoragePerfFlag = (): boolean | null => {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    if (raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on") {
      return true;
    }
    if (raw === "0" || raw.toLowerCase() === "false" || raw.toLowerCase() === "off") {
      return false;
    }
  } catch {
    return null;
  }
  return null;
};

const detectEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const queryValue = readQueryPerfFlag();
  if (queryValue !== null) {
    return queryValue;
  }
  const storageValue = readStoragePerfFlag();
  return storageValue ?? false;
};

class PerfMonitor {
  private enabled = detectEnabled();
  private readonly durationSamples = new Map<string, number[]>();
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private lastFlushAt = performance.now();

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.lastFlushAt = performance.now();
    this.durationSamples.clear();
    this.counters.clear();
    this.gauges.clear();
  }

  recordDuration(name: string, durationMs: number): void {
    if (!this.enabled || !Number.isFinite(durationMs)) {
      return;
    }
    const bucket = this.durationSamples.get(name) ?? [];
    bucket.push(durationMs);
    if (bucket.length > SAMPLE_CAP) {
      bucket.shift();
    }
    this.durationSamples.set(name, bucket);
    this.maybeFlush();
  }

  incrementCounter(name: string, by = 1): void {
    if (!this.enabled || !Number.isFinite(by)) {
      return;
    }
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
    this.maybeFlush();
  }

  recordGauge(name: string, value: number): void {
    if (!this.enabled || !Number.isFinite(value)) {
      return;
    }
    this.gauges.set(name, value);
    this.maybeFlush();
  }

  measure<T>(name: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }
    const start = performance.now();
    try {
      return fn();
    } finally {
      this.recordDuration(name, performance.now() - start);
    }
  }

  recordReactRender(id: string, actualDuration: number, baseDuration: number): void {
    if (!this.enabled) {
      return;
    }
    this.recordDuration(`react.render.${id}.actual`, actualDuration);
    this.recordDuration(`react.render.${id}.base`, baseDuration);
    this.incrementCounter(`react.render.${id}.commits`);
  }

  snapshotAndReset(elapsedMs: number): PerfSnapshot {
    const durations: DurationSummary = {};
    const counters: CounterSummary = {};
    const gauges: GaugeSummary = {};
    for (const [name, samples] of this.durationSamples.entries()) {
      durations[name] = summarizeDuration(samples);
    }
    for (const [name, count] of this.counters.entries()) {
      counters[name] = {
        count,
        perSecond: elapsedMs > 0 ? (count * 1000) / elapsedMs : 0,
      };
    }
    for (const [name, value] of this.gauges.entries()) {
      gauges[name] = value;
    }
    this.durationSamples.clear();
    this.counters.clear();
    return {
      elapsedMs,
      durations,
      counters,
      gauges,
    };
  }

  maybeFlush(): void {
    if (!this.enabled) {
      return;
    }
    const now = performance.now();
    const elapsedMs = now - this.lastFlushAt;
    if (elapsedMs < FLUSH_INTERVAL_MS) {
      return;
    }
    this.lastFlushAt = now;
    const snapshot = this.snapshotAndReset(elapsedMs);
    const durationRows = Object.entries(snapshot.durations).map(([name, stats]) => ({
      segment: name,
      count: stats.count,
      avgMs: Number(stats.avgMs.toFixed(3)),
      p95Ms: Number(stats.p95Ms.toFixed(3)),
      p99Ms: Number(stats.p99Ms.toFixed(3)),
      maxMs: Number(stats.maxMs.toFixed(3)),
    }));
    const counterRows = Object.entries(snapshot.counters).map(([name, entry]) => ({
      counter: name,
      count: entry.count,
      perSecond: Number(entry.perSecond.toFixed(2)),
    }));
    const gaugeRows = Object.entries(snapshot.gauges).map(([name, value]) => ({
      gauge: name,
      value: Number(value.toFixed(3)),
    }));
    console.groupCollapsed(
      `[perf] window=${Math.round(snapshot.elapsedMs)}ms durations=${durationRows.length} counters=${counterRows.length}`,
    );
    if (durationRows.length > 0) {
      console.table(durationRows);
    }
    if (counterRows.length > 0) {
      console.table(counterRows);
    }
    if (gaugeRows.length > 0) {
      console.table(gaugeRows);
    }
    console.groupEnd();
  }
}

export const perfMonitor = new PerfMonitor();
