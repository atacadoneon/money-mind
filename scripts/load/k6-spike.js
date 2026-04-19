/**
 * k6 Spike Test — pico repentino 50 → 500 → 50 em 3 min.
 * Valida recovery após spike.
 * Run: k6 run k6-spike.js --env BASE_URL=https://api.staging.moneymind.com.br --env TOKEN=<bearer>
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3333';
const TOKEN    = __ENV.TOKEN    || 'test-token';
const ORG_ID   = __ENV.ORG_ID  || 'org-test';

export const errorRate    = new Rate('error_rate');
export const recoveryRate = new Rate('recovery_rate');
export const latency      = new Trend('request_duration', true);

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'x-org-id': ORG_ID,
};

export const options = {
  stages: [
    { duration: '30s', target: 50  }, // baseline
    { duration: '30s', target: 500 }, // SPIKE — carga 10x repentina
    { duration: '30s', target: 500 }, // sustain spike
    { duration: '30s', target: 50  }, // recovery rápido
    { duration: '60s', target: 50  }, // validar recovery completo
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    error_rate:        ['rate<0.15'], // aceitar até 15% erros durante spike
    recovery_rate:     ['rate>0.85'], // 85% de recovery após spike
  },
};

// Rastreia se estamos no período de recovery
let spikeEndTime = 0;

export default function () {
  const now = Date.now();
  const inRecovery = spikeEndTime > 0 && now > spikeEndTime;

  const res = http.get(`${BASE_URL}/api/v1/contas-pagar?page=1&limit=10`, { headers: HEADERS });
  latency.add(res.timings.duration);

  const ok = check(res, {
    'status not 5xx': (r) => r.status < 500,
  });
  errorRate.add(!ok);

  if (inRecovery) {
    recoveryRate.add(ok);
  }

  // Marcar início do recovery (aprox. 90s de execução)
  if (!spikeEndTime && __ITER > 100) {
    spikeEndTime = Date.now();
  }

  sleep(0.05);
}
