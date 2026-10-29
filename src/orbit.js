// 원궤도 모델로 ISS 위치를 계산/유추한다.
// 기준점(시각·위도·경도·진행 방향)을 하나 정하면 임의 시각의 지상 위치를 구할 수 있다.

const DEG = Math.PI / 180;
const INCLINATION = 51.64 * DEG; // ISS 궤도 경사각
const PERIOD_SEC = 92.9 * 60; // 공전 주기
const MEAN_MOTION = (2 * Math.PI) / PERIOD_SEC; // rad/s
const EARTH_ROT = 7.2921159e-5; // 지구 자전 각속도 rad/s
const NODAL_PRECESSION = (-5.0 * DEG) / 86400; // 승교점 세차 rad/s
export const EARTH_RADIUS_KM = 6371;
export const ISS_ALTITUDE_KM = 420;

/** 실측 좌표 사이가 이 시간(초)보다 벌어지면 단절 구간으로 보고 궤적을 계산한다. */
export const GAP_SEC = 90;
const SAMPLE_STEP_SEC = 30;
/** 진행 방향(상승/하강) 판단에 사용할 이웃 좌표의 최대 시간 차 */
const NEIGHBOR_MAX_SEC = 15 * 60;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const normLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
const lonOffset = (u) => Math.atan2(Math.cos(INCLINATION) * Math.sin(u), Math.cos(u));

function makeAnchorBranch(p, ascending) {
  let u0 = Math.asin(clamp(Math.sin(p.lat * DEG) / Math.sin(INCLINATION), -1, 1));
  if (!ascending) u0 = Math.PI - u0;
  return { t: p.t, u0, node0: p.lon * DEG - lonOffset(u0) };
}

/** 기준점에서 t 시각의 위치 [lat, lon] (deg) */
export function propagate(anchor, t) {
  const dt = t - anchor.t;
  const u = anchor.u0 + MEAN_MOTION * dt;
  const lat = Math.asin(Math.sin(INCLINATION) * Math.sin(u));
  const lon = anchor.node0 + (NODAL_PRECESSION - EARTH_ROT) * dt + lonOffset(u);
  return [lat / DEG, normLon(lon / DEG)];
}

function toVec([lat, lon]) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

function fromVec([x, y, z]) {
  const r = Math.hypot(x, y, z) || 1;
  return [Math.asin(z / r) / DEG, Math.atan2(y, x) / DEG];
}

/** 두 좌표 사이의 중심각(rad) */
export function centralAngle(a, b) {
  const va = toVec(a);
  const vb = toVec(b);
  const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
  return Math.acos(clamp(dot, -1, 1));
}

/**
 * 좌표 하나로 기준점을 만든다. 같은 위도에 상승/하강 두 해가 있으므로
 * 가까운 이웃 좌표를 더 잘 맞추는 쪽을 고른다. 이웃이 없으면 상승 궤도로 가정한다.
 */
export function makeAnchor(p, neighbor) {
  const asc = makeAnchorBranch(p, true);
  if (!neighbor || neighbor.t === p.t || Math.abs(neighbor.t - p.t) > NEIGHBOR_MAX_SEC) return asc;
  const desc = makeAnchorBranch(p, false);
  const target = [neighbor.lat, neighbor.lon];
  const errAsc = centralAngle(propagate(asc, neighbor.t), target);
  const errDesc = centralAngle(propagate(desc, neighbor.t), target);
  return errAsc <= errDesc ? asc : desc;
}

/** 시각 from~to 사이를 계산한 좌표 목록. 두 기준점이 있으면 시간 비율로 섞어 양 끝을 맞춘다. */
function estimate(from, to, anchorA, anchorB) {
  const coords = [];
  const span = to - from;
  const steps = Math.max(1, Math.ceil(span / SAMPLE_STEP_SEC));
  for (let i = 0; i <= steps; i++) {
    const t = from + (span * i) / steps;
    if (!anchorB) {
      coords.push(propagate(anchorA, t));
      continue;
    }
    const w = (t - from) / span;
    const a = toVec(propagate(anchorA, t));
    const b = toVec(propagate(anchorB, t));
    coords.push(fromVec(a.map((v, k) => v * (1 - w) + b[k] * w)));
  }
  return coords;
}

/**
 * 저장된 실측 좌표로 최근 4시간 궤적을 만든다.
 * - 실측 구간: kind 'actual'
 * - 단절 구간 및 수집 시작 이전 구간: kind 'estimated' (궤도 모델로 계산)
 */
export function buildTrack(points, windowStart) {
  const pts = points.filter((p) => p.t >= windowStart);
  if (pts.length === 0) return [];

  const segments = [];
  const first = pts[0];

  if (first.t - windowStart > SAMPLE_STEP_SEC) {
    const anchor = makeAnchor(first, pts[1]);
    segments.push({ kind: 'estimated', coords: estimate(windowStart, first.t, anchor) });
  }

  let current = [[first.lat, first.lon]];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const p = pts[i];
    if (p.t - prev.t > GAP_SEC) {
      segments.push({ kind: 'actual', coords: current });
      const anchorA = makeAnchor(prev, pts[i - 2]);
      const anchorB = makeAnchor(p, pts[i + 1]);
      segments.push({ kind: 'estimated', coords: estimate(prev.t, p.t, anchorA, anchorB) });
      current = [];
    }
    current.push([p.lat, p.lon]);
  }
  segments.push({ kind: 'actual', coords: current });

  return segments.filter((s) => s.coords.length > 0);
}

/** 날짜변경선(±180°)을 넘는 선을 나눠 지도에서 가로지르는 직선이 생기지 않게 한다. */
export function splitAtDateline(coords) {
  const parts = [];
  let cur = [];
  for (let i = 0; i < coords.length; i++) {
    const p = coords[i];
    const prev = coords[i - 1];
    if (prev && Math.abs(p[1] - prev[1]) > 180) {
      const edge = prev[1] > 0 ? 180 : -180;
      const pLon = p[1] + (prev[1] > 0 ? 360 : -360);
      const f = (edge - prev[1]) / (pLon - prev[1]);
      const lat = prev[0] + (p[0] - prev[0]) * f;
      cur.push([lat, edge]);
      parts.push(cur);
      cur = [[lat, -edge]];
    }
    cur.push(p);
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/** 진행 방향(북쪽 기준 시계방향 deg) */
export function bearing(a, b) {
  const la1 = a[0] * DEG;
  const la2 = b[0] * DEG;
  const dLon = (b[1] - a[1]) * DEG;
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

const SPEED_BASELINE_SEC = 60;

/**
 * 최근 실측 좌표로 궤도 속도(km/h)를 구한다.
 * API 타임스탬프가 초 단위라 약 60초 이상 떨어진 좌표를 기준으로 삼아 오차를 줄인다.
 */
export function computeSpeed(points) {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  let base = null;
  for (let i = points.length - 2; i >= 0; i--) {
    if (points[i + 1].t - points[i].t > GAP_SEC) break;
    base = points[i];
    if (last.t - base.t >= SPEED_BASELINE_SEC) break;
  }
  if (!base || last.t === base.t) return null;
  const angle = centralAngle([base.lat, base.lon], [last.lat, last.lon]);
  const km = angle * (EARTH_RADIUS_KM + ISS_ALTITUDE_KM);
  const groundKm = angle * EARTH_RADIUS_KM;
  const hours = (last.t - base.t) / 3600;
  return { kmh: km / hours, groundKmh: groundKm / hours, baselineSec: last.t - base.t };
}
