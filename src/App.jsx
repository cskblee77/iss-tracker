import { useState } from 'react';
import IssMap from './components/IssMap';
import StatsPanel from './components/StatsPanel';
import { useIssTracker } from './useIssTracker';

export default function App() {
  const { query, points, track, speed, latest, polling } = useIssTracker();
  const [follow, setFollow] = useState(true);
  const hasEstimated = track.some((s) => s.kind === 'estimated');

  return (
    <>
      <div className="topbar">
        <span className="brand">🛰️ ISS Tracker</span>
        <nav>
          <a href="#map">궤적 지도</a>
          <a href="#about">동작 방식</a>
        </nav>
      </div>

      <header className="hero">
        <span className="badge">
          <span className={`live-dot ${query.isError ? 'off' : ''}`} /> 실시간 · open-notify API
        </span>
        <h1>국제 우주 정거장 실시간 추적</h1>
        <p>지금 이 순간 ISS가 지구 위 어디를 지나고 있는지, 최근 4시간의 궤적과 함께 보여줍니다.</p>
      </header>

      <main>
        <section id="map">
          <div className="section-head">
            <span className="chip">LIVE</span>
            <h2>최근 4시간 궤적</h2>
          </div>

          <div className="card map-card">
            <div className="map-toolbar">
              <div className="legend">
                <span><i className="line solid" /> 실측 궤적</span>
                <span><i className="line dashed" /> 계산/유추 궤적</span>
              </div>
              <label className="follow">
                <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
                ISS 따라가기
              </label>
            </div>
            <IssMap track={track} latest={latest} points={points} follow={follow} />
            {!latest && <p className="hint">첫 위치를 불러오는 중…</p>}
            {hasEstimated && (
              <p className="hint">점선 구간은 수집되지 않은 시간을 궤도 모델(경사각 51.64°, 주기 92.9분)로 계산한 위치입니다.</p>
            )}
          </div>

          <div className="card">
            <h3>📡 이동 속도 · Polling 상태</h3>
            <StatsPanel speed={speed} polling={polling} query={query} latest={latest} pointCount={points.length} />
          </div>
        </section>

        <section id="about">
          <div className="section-head">
            <span className="chip">HOW</span>
            <h2>동작 방식</h2>
          </div>
          <div className="card">
            <ol className="steps">
              <li>TanStack Query가 <code>iss-now.json</code>을 주기적으로 요청하고, 매 요청의 응답시간을 측정합니다.</li>
              <li>응답시간의 이동평균으로 다음 Polling 간격을 정합니다. 간격은 항상 5초 이상이며 실패 시 두 배로 늘어납니다.</li>
              <li>받은 좌표는 브라우저 IndexedDB에 저장되고, 4시간이 지난 좌표는 자동 삭제됩니다.</li>
              <li>좌표 사이가 90초 이상 끊긴 구간과 수집 이전 4시간 구간은 궤도 모델로 계산해 점선으로 그립니다.</li>
            </ol>
          </div>
        </section>
      </main>

      <footer>ISS Tracker · 데이터: open-notify.org · 지도: © OpenStreetMap</footer>
    </>
  );
}
