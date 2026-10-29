const ISS_URL = 'http://api.open-notify.org/iss-now.json';
const REQUEST_TIMEOUT_MS = 15000;

/**
 * ISS 현재 위치를 조회하고 요청~응답 소요 시간(rtt)을 함께 반환한다.
 * 실패한 경우에도 소요 시간을 error.rtt 로 전달해 폴링 간격 조정에 사용한다.
 */
export async function fetchIssNow(signal) {
  const started = performance.now();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const res = await fetch(ISS_URL, { signal: combined, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.message !== 'success') throw new Error('API 응답 오류');

    return {
      t: Number(json.timestamp),
      lat: Number(json.iss_position.latitude),
      lon: Number(json.iss_position.longitude),
      rtt: performance.now() - started,
    };
  } catch (err) {
    err.rtt = performance.now() - started;
    throw err;
  }
}
