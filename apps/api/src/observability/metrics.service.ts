import { Injectable } from '@nestjs/common';

interface Counter {
  name: string;
  value: number;
  labels: Record<string, string>;
}

/**
 * Métricas Prometheus-compatible (in-memory counters).
 * Para expor via /metrics, usar @willsoto/nestjs-prometheus ou prom-client.
 */
@Injectable()
export class MetricsService {
  private counters = new Map<string, Counter>();

  increment(name: string, labels: Record<string, string> = {}, amount = 1): void {
    const key = `${name}:${JSON.stringify(labels)}`;
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += amount;
    } else {
      this.counters.set(key, { name, value: amount, labels });
    }
  }

  getAll(): Counter[] {
    return Array.from(this.counters.values());
  }

  getPrometheusText(): string {
    return Array.from(this.counters.values())
      .map((c) => {
        const labelStr = Object.entries(c.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        return `${c.name}{${labelStr}} ${c.value}`;
      })
      .join('\n');
  }
}
