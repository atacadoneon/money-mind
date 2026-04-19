/**
 * k6 Load Test — 100 VUs ramp-up 5 min → sustain 500 req/s 15 min
 * Run: k6 run k6-load.js --env BASE_URL=https://api.staging.moneymind.com.br --env TOKEN=<bearer>
 *
 * Endpoints críticos testados:
 *   GET  /api/v1/contas-pagar
 *   POST /api/v1/reconciliation/run
 *   GET  /api/v1/relatorios/dre
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';
const TOKEN    = __ENV.TOKEN    || 'test-token';
const ORG_ID   = __ENV.ORG_ID  || 'org-test';

export const errorRate      = new Rate('error_rate');
export const cpDuration     = new Trend('cp_list_duration', true);
export const reconcDuration = new Trend('reconciliation_duration', true);
export const dreDuration    = new Trend('dre_duration', true);
export const reqCount       = new Counter('requests_total');

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'x-org-id': ORG_ID,
  'Content-Type': 'application/json',
};

export const options = {
  stages: [
    { duration: '2m',  target: 50  }, // ramp-up
    { duration: '3m',  target: 100 }, // ramp-up continua
    { duration: '15m', target: 100 }, // sustain
    { duration: '2m',  target: 0   }, // ramp-down
  ],
  thresholds: {
    http_req_duration:    ['p(95)<1000', 'p(99)<2000'],
    http_req_failed:      ['rate<0.05'],
    error_rate:           ['rate<0.05'],
    cp_list_duration:     ['p(95)<800'],
    reconciliation_duration: ['p(95)<3000'],
    dre_duration:         ['p(95)<2000'],
  },
};

export default function () {
  reqCount.add(1);

  group('GET contas-pagar', () => {
    const res = http.get(`${BASE_URL}/api/v1/contas-pagar?page=1&limit=25`, { headers: HEADERS });
    cpDuration.add(res.timings.duration);
    const ok = check(res, {
      'CP: status 200 or 401': (r) => r.status === 200 || r.status === 401,
      'CP: < 800ms': (r) => r.timings.duration < 800,
    });
    errorRate.add(!ok);
  });

  sleep(0.1);

  group('GET relatorios/dre', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/relatorios/dre?companyId=test&ano=2026&mes=5`,
      { headers: HEADERS }
    );
    dreDuration.add(res.timings.duration);
    check(res, {
      'DRE: status 200 or 401': (r) => r.status === 200 || r.status === 401,
      'DRE: < 2000ms': (r) => r.timings.duration < 2000,
    });
  });

  sleep(0.1);

  // POST reconciliation run (every 5th iteration to avoid overload)
  if (__ITER % 5 === 0) {
    group('POST reconciliation/run', () => {
      const body = JSON.stringify({ contaBancariaId: 'cb-test', date: '2026-05-10' });
      const res = http.post(`${BASE_URL}/api/v1/reconciliation/run`, body, { headers: HEADERS });
      reconcDuration.add(res.timings.duration);
      check(res, {
        'Reconcil: status 200/201/401/422': (r) => [200, 201, 401, 422].includes(r.status),
      });
    });
  }

  sleep(0.2);
}
