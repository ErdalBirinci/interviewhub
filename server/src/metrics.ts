/**
 * Observability: bellek ici metrik kaydi.
 *
 * counter / gauge / histogram destekler; /api/metrics endpoint'i
 * ile JSON olarak verilir. OpenTelemetry tarzi adlandirma
 * (<isim>_<birim>_total) kullanilir; uzami bir APM eklendiginde
 * bu modulu degistirmek yeterlidir.
 */

export type Tags = Record<string, string | number | undefined>;

interface HistogramData {
  count: number;
  sum: number;
  max: number;
  min: number;
}

interface HistogramSummary {
  count: number;
  sum: number;
  avg: number;
  max: number;
  min: number;
}

export interface MetricsSnapshot {
  counters: Record<string, Record<string, number>>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramSummary>;
  at: string;
}

class MetricsRegistry {
  private counters = new Map<string, Map<string, number>>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, HistogramData>();

  private static tagKey(tags: Tags): string {
    const keys = Object.keys(tags)
      .filter((k) => tags[k] !== undefined)
      .sort();
    return keys.map((k) => `${k}=${tags[k]}`).join(",");
  }

  /** Sayaç artir. */
  inc(name: string, tags: Tags = {}, value = 1): void {
    const key = MetricsRegistry.tagKey(tags);
    let row = this.counters.get(name);
    if (!row) {
      row = new Map();
      this.counters.set(name, row);
    }
    row.set(key, (row.get(key) ?? 0) + value);
  }

  /** Anlik deger ata (son deger kazanir). */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /** Dagilim icin gozlem ekle (sure, boyut vb.). */
  observe(name: string, value: number): void {
    const h =
      this.histograms.get(name) ??
      { count: 0, sum: 0, max: -Infinity, min: Infinity };
    h.count++;
    h.sum += value;
    h.max = Math.max(h.max, value);
    h.min = Math.min(h.min, value);
    this.histograms.set(name, h);
  }

  snapshot(): MetricsSnapshot {
    const counters: Record<string, Record<string, number>> = {};
    for (const [name, row] of this.counters) {
      const out: Record<string, number> = {};
      for (const [tags, value] of row) out[tags || "total"] = value;
      counters[name] = out;
    }
    const histograms: Record<string, HistogramSummary> = {};
    for (const [name, h] of this.histograms) {
      histograms[name] = {
        count: h.count,
        sum: Math.round(h.sum * 100) / 100,
        avg: h.count ? Math.round((h.sum / h.count) * 100) / 100 : 0,
        max: h.max === -Infinity ? 0 : Math.round(h.max * 100) / 100,
        min: h.min === Infinity ? 0 : Math.round(h.min * 100) / 100,
      };
    }
    return {
      counters,
      gauges: Object.fromEntries(this.gauges),
      histograms,
      at: new Date().toISOString(),
    };
  }
}

export const metrics = new MetricsRegistry();

/* ----------------------------- yapili log ------------------------------ */

export type LogLevel = "info" | "warn" | "error";

/**
 * JSON satir logu — log toplama (Loki/Cloudwatch/Stdout) icin
 * makine okunabilir, kisacagi insana okunur.
 */
export function log(
  level: LogLevel,
  msg: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
