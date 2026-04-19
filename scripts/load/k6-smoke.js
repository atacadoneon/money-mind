/**
 * k6 Smoke Test — validação básica de que o sistema responde.
 * Run: k6 run k6-smoke.js --env BASE_URL=http://localhost:3333
 *
 * Meta: < 200ms p95, 0 erros em 10 req/s por 1 min
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';

export const errorRate = new Rate('error_rate');
export const healthDuration = new Trend('health_duration_ms', true);

export const options = {
  vus: 2,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  healthDuration.add(res.timings.duration);
  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'response < 200ms': (r) => r.timings.duration < 200,
    'body has status': (r) => r.body.includes('ok') || r.body.includes('status'),
  });
  errorRate.add(!ok);
  sleep(0.1);
}
