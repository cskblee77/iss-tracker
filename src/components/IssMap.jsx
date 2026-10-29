import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { bearing, splitAtDateline } from '../orbit';
import { issIcon } from '../issIcon';

const ACTUAL_STYLE = { color: '#4f46e5', weight: 3, opacity: 0.9 };
const ESTIMATED_STYLE = { color: '#06b6d4', weight: 2.5, opacity: 0.9, dashArray: '6 8' };

function FollowIss({ position, follow }) {
  const map = useMap();
  useEffect(() => {
    if (follow && position) map.panTo(position, { animate: true });
  }, [map, position, follow]);
  return null;
}

export default function IssMap({ track, latest, points, follow }) {
  const lines = useMemo(
    () =>
      track.flatMap((seg, i) =>
        splitAtDateline(seg.coords).map((coords, j) => ({ key: `${i}-${j}`, kind: seg.kind, coords })),
      ),
    [track],
  );

  const position = latest ? [latest.lat, latest.lon] : null;

  const heading = useMemo(() => {
    if (points.length < 2) return 0;
    const a = points[points.length - 2];
    const b = points[points.length - 1];
    return bearing([a.lat, a.lon], [b.lat, b.lon]);
  }, [points]);

  const icon = useMemo(() => issIcon(Math.round(heading)), [heading]);

  return (
    <MapContainer
      className="iss-map"
      center={[20, 0]}
      zoom={2}
      minZoom={1}
      worldCopyJump={false}
      maxBounds={[[-90, -200], [90, 200]]}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        noWrap
      />
      {lines.map((l) => (
        <Polyline
          key={l.key}
          positions={l.coords}
          pathOptions={l.kind === 'estimated' ? ESTIMATED_STYLE : ACTUAL_STYLE}
        />
      ))}
      {position && (
        <Marker position={position} icon={icon}>
          <Tooltip direction="top" offset={[0, -24]}>
            ISS · {latest.lat.toFixed(4)}, {latest.lon.toFixed(4)}
          </Tooltip>
        </Marker>
      )}
      <FollowIss position={position} follow={follow} />
    </MapContainer>
  );
}
