/**
 * k6 Stress Test — ramp até 1000 VUs até o sistema falhar.
 * Documenta o ponto de quebra (quando error_rate > 5%).
 * Run: k6 run k6-stress.js --env BASE_URL=https://api.staging.moneymind.com.br --env TOKEN=<bearer>
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';
const TOKEN    = __ENV.TOKEN    || 'test-token';
const ORG_ID   = __ENV.ORG_ID  || 'org-test';

export const errorRate = new Rate('error_rate');
export const p95       = new Trend('p95_duration', true);

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'x-org-id': ORG_ID,
};

export const options = {
  stages: [
    { duration: '2m',  target: 100  }, // warm up
    { duration: '5m',  target: 300  }, // escalada moderada
    { duration: '5m',  target: 600  }, // alta carga
    { duration: '5m',  target: 1000 }, // stress máximo — documentar ponto de quebra
    { duration: '3m',  target: 0    }, // recovery
  ],
  thresholds: {
    // Não falhar o test — queremos observar o comportamento
    http_req_duration: ['p(99)<10000'],
    // Documentar quando atingir 30% de erros
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/contas-pagar?page=1&limit=10`, { headers: HEADERS });
  p95.add(res.timings.duration);
  const ok = check(res, {
    'status not 5xx': (r) => r.status < 500,
    'response < 5s':  (r) => r.timings.duration < 5000,
  });
  errorRate.add(!ok);
  sleep(0.05);
}

export function handleSummary(data) {
  const breakingPoint = findBreakingPoint(data);
  return {
    'stress-results.json': JSON.stringify({ ...data, breakingPoint }, null, 2),
    stdout: `\n=== STRESS TEST SUMMARY ===\nBreaking point (est): ${breakingPoint} VUs\np95 max: ${data.metrics?.p95_duration?.values?.['p(95)'] ?? 'N/A'} ms\nError rate: ${((data.metrics?.error_rate?.values?.rate ?? 0) * 100).toFixed(1)}%\n`,
  };
}

function findBreakingPoint(data) {
  const errorRateValue = data.metrics?.error_rate?.values?.rate ?? 0;
  if (errorRateValue > 0.3) return '< 600 VUs (error rate exceeded 30%)';
  if (errorRateValue > 0.1) return '600–1000 VUs range';
  return '> 1000 VUs (system held)';
}
