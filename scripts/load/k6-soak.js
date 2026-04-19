/**
 * k6 Soak Test — 100 VUs por 2h para detectar memory leak e degradação.
 * Run: k6 run k6-soak.js --env BASE_URL=https://api.staging.moneymind.com.br --env TOKEN=<bearer>
 *
 * Indicadores de memory leak:
 *   - Latência p95 crescente ao longo do tempo
 *   - Error rate crescente após 30+ min
 *   - Processo Node.js consumindo RAM crescente (monitorar fora do k6)
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';
const TOKEN    = __ENV.TOKEN    || 'test-token';
const ORG_ID   = __ENV.ORG_ID  || 'org-test';

export const errorRate    = new Rate('error_rate');
export const latencyTrend = new Trend('latency_over_time', true);
export const reqTotal     = new Counter('requests_total');

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'x-org-id': ORG_ID,
};

export const options = {
  stages: [
    { duration: '5m',  target: 100 }, // warm up gradual
    { duration: '110m', target: 100 }, // sustain 100 VUs por ~2h
    { duration: '5m',  target: 0   }, // ramp down
  ],
  thresholds: {
    // Latência não deve degradar significativamente ao longo do teste
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    error_rate:        ['rate<0.02'],  // < 2% erros durante soak
  },
};

export default function () {
  reqTotal.add(1);

  group('health check', () => {
    const res = http.get(`${BASE_URL}/health`);
    latencyTrend.add(res.timings.duration);
    check(res, { 'health 200': (r) => r.status === 200 });
  });

  sleep(0.1);

  group('contas-pagar list', () => {
    const res = http.get(`${BASE_URL}/api/v1/contas-pagar?page=1&limit=10`, { headers: HEADERS });
    latencyTrend.add(res.timings.duration);
    const ok = check(res, {
      'cp: status ok': (r) => r.status < 500,
      'cp: < 1500ms': (r) => r.timings.duration < 1500,
    });
    errorRate.add(!ok);
  });

  sleep(0.1);

  // Test with different page to stress pagination
  if (__ITER % 10 === 0) {
    group('pagination test', () => {
      const page = ((__ITER / 10) % 5) + 1;
      const res = http.get(`${BASE_URL}/api/v1/contas-pagar?page=${page}&limit=25`, { headers: HEADERS });
      check(res, { 'pagination ok': (r) => r.status < 500 });
    });
  }

  sleep(0.4);
}

export function handleSummary(data) {
  const p95 = data.metrics?.http_req_duration?.values?.['p(95)'] ?? 0;
  const errRate = (data.metrics?.error_rate?.values?.rate ?? 0) * 100;
  const totalReqs = data.metrics?.requests_total?.values?.count ?? 0;

  return {
    'soak-results.json': JSON.stringify(data, null, 2),
    stdout: `\n=== SOAK TEST SUMMARY (2h) ===
Total requests: ${totalReqs}
p95 latency: ${p95.toFixed(0)}ms
Error rate: ${errRate.toFixed(2)}%
Memory leak indicator: ${p95 > 1000 ? 'POSSIBLE DEGRADATION DETECTED' : 'OK'}
\n`,
  };
}
