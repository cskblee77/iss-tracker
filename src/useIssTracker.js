import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchIssNow } from './api';
import { loadPositions, pruneOld, RETENTION_SEC, savePosition } from './db';
import { buildTrack, computeSpeed } from './orbit';

export const MIN_INTERVAL_MS = 5000;
export const MAX_INTERVAL_MS = 60000;
/** 폴링 간격 = 평균 응답시간 × RTT_FACTOR (최소 5초) */
export const RTT_FACTOR = 20;
const EMA_ALPHA = 0.3;
const RTT_HISTORY = 30;

const clamp = (v) => Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, v));

/**
 * 응답시간을 측정할 때마다 지수이동평균(EMA)을 갱신하고 다음 폴링 간격을 다시 계산한다.
 * - 성공: interval = clamp(EMA × RTT_FACTOR)  → 응답이 느릴수록 간격이 늘어난다
 * - 실패: interval = clamp(직전 간격 × 2)      → 연속 실패 시 지수 백오프
 */
function usePollingController() {
  const ref = useRef({ ema: null, interval: MIN_INTERVAL_MS });
  const [stats, setStats] = useState({ ema: null, interval: MIN_INTERVAL_MS, history: [] });

  const record = (rtt, ok) => {
    const s = ref.current;
    if (ok) {
      s.ema = s.ema == null ? rtt : EMA_ALPHA * rtt + (1 - EMA_ALPHA) * s.ema;
      s.interval = clamp(Math.round(s.ema * RTT_FACTOR));
    } else {
      s.interval = clamp(s.interval * 2);
    }
    setStats((prev) => ({
      ema: s.ema,
      interval: s.interval,
      history: [...prev.history, { rtt, ok, at: Date.now(), interval: s.interval }].slice(-RTT_HISTORY),
    }));
  };

  return { ref, stats, record };
}

export function useIssTracker() {
  const polling = usePollingController();
  const recordRef = useRef(polling.record);
  recordRef.current = polling.record;

  const query = useQuery({
    queryKey: ['iss-now'],
    queryFn: async ({ signal }) => {
      try {
        const pos = await fetchIssNow(signal);
        recordRef.current(pos.rtt, true);
        return pos;
      } catch (err) {
        if (err.name !== 'AbortError') recordRef.current(err.rtt ?? 0, false);
        throw err;
      }
    },
    // 매 응답마다 갱신된 간격을 읽어 다음 요청을 예약한다.
    refetchInterval: () => polling.ref.current.interval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 0,
  });

  const [points, setPoints] = useState([]);
  const [now, setNow] = useState(() => Date.now() / 1000);

  // 앱 시작 시 오래된 좌표를 지우고 저장된 궤적을 불러온다.
  useEffect(() => {
    pruneOld().then(loadPositions).then(setPoints).catch(console.error);
  }, []);

  // 새 좌표가 들어오면 IndexedDB 에 저장 → 4시간 초과분 삭제 → 다시 읽기
  useEffect(() => {
    const pos = query.data;
    if (!pos) return;
    let cancelled = false;
    savePosition(pos)
      .then(() => pruneOld())
      .then(loadPositions)
      .then((rows) => !cancelled && setPoints(rows))
      .catch(console.error);
    setNow(Date.now() / 1000);
    return () => {
      cancelled = true;
    };
  }, [query.data]);

  // 응답이 없어도 4시간 창이 밀려나도록 주기적으로 정리한다.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now() / 1000);
      pruneOld().then(loadPositions).then(setPoints).catch(console.error);
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const windowStart = now - RETENTION_SEC;
  const track = useMemo(() => buildTrack(points, windowStart), [points, windowStart]);
  const speed = useMemo(() => computeSpeed(points), [points]);
  const latest = points.length ? points[points.length - 1] : null;

  return { query, points, track, speed, latest, polling: polling.stats };
}
