import { useEffect, useState } from 'react';
import { MAX_INTERVAL_MS, MIN_INTERVAL_MS, RTT_FACTOR } from '../useIssTracker';

const fmt = (n, d = 0) => n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d });

function useCountdown(lastAt, interval) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (!lastAt) return null;
  return Math.max(0, (lastAt + interval - now) / 1000);
}

function RttChart({ history }) {
  if (history.length === 0) return null;
  const max = Math.max(...history.map((h) => h.rtt), 1);
  return (
    <div className="rtt-chart" aria-label="최근 API 응답시간">
      {history.map((h) => (
        <div
          key={h.at}
          className={`rtt-bar ${h.ok ? '' : 'fail'}`}
          style={{ height: `${Math.max(4, (h.rtt / max) * 100)}%` }}
          title={`${fmt(h.rtt)} ms → 간격 ${fmt(h.interval / 1000, 1)}초`}
        />
      ))}
    </div>
  );
}

export default function StatsPanel({ speed, polling, query, latest, pointCount }) {
  const lastAt = Math.max(query.dataUpdatedAt, query.errorUpdatedAt) || null;
  const countdown = useCountdown(lastAt, polling.interval);
  const lastRtt = polling.history.at(-1);

  return (
    <>
      <div className="status-grid">
        <div className="status s3">
          <b>{speed ? `${fmt(speed.kmh)} km/h` : '측정 중…'}</b>
          이동 속도{speed && ` · ${fmt(speed.kmh / 3600, 2)} km/s`}
        </div>
        <div className="status s2">
          <b>{fmt(polling.interval / 1000, 1)}초</b>
          Polling 간격{countdown != null && ` · 다음 ${fmt(countdown, 1)}초`}
        </div>
        <div className={`status ${lastRtt && !lastRtt.ok ? 's5' : 's4'}`}>
          <b>{lastRtt ? `${fmt(lastRtt.rtt)} ms` : '—'}</b>
          API 응답속도{polling.ema != null && ` · 평균 ${fmt(polling.ema)} ms`}
        </div>
        <div className="status s1">
          <b>{latest ? `${latest.lat.toFixed(2)}°, ${latest.lon.toFixed(2)}°` : '—'}</b>
          현재 위치 · 저장 {fmt(pointCount)}건
        </div>
      </div>

      {query.isError && (
        <p className="error-msg">⚠️ API 요청 실패: {query.error.message} — 간격을 늘려 재시도합니다.</p>
      )}

      <RttChart history={polling.history} />
      <p className="hint">
        간격 = clamp(평균 응답시간(EMA) × {RTT_FACTOR}, {MIN_INTERVAL_MS / 1000}초, {MAX_INTERVAL_MS / 1000}초) ·
        실패 시 직전 간격 × 2
        {speed && ` · 속도는 최근 ${speed.baselineSec}초 이동거리(고도 420km 기준) / 지상 속도 ${fmt(speed.groundKmh)} km/h`}
      </p>
    </>
  );
}
