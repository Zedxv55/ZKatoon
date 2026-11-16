import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass, Film, Navigation, Pause, Play, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MapAnimationProject, MapWaypoint } from '../../types/platform';
import type { StudioProject, StudioScene } from '../../types/studio';

if (typeof window !== 'undefined' && typeof maplibregl.setWorkerUrl === 'function') {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}

interface MapStudioTabProps {
  activeProject: StudioProject;
  tileStyleUrl?: string;
  attributionText?: string;
  onInjectMapScene: (nextProject: StudioProject) => void;
}

const CURATED_MAP_PRESETS: MapAnimationProject[] = [
  {
    id: 'bangkok_ayutthaya',
    title: 'เส้นทางค้าขายเจ้าพระยา: กรุงเทพฯ → อยุธยา',
    category: 'historical_map',
    projection: 'mercator',
    showRoutePath: true,
    routeColor: '#f5c542',
    waypoints: [
      {
        id: 'wp1',
        name: 'พระบรมมหาราชวัง กรุงเทพฯ',
        lat: 13.7501,
        lng: 100.4913,
        zoom: 11.2,
        pitch: 45,
        bearing: 15,
        durationSec: 2.5,
        narration: 'จุดเริ่มต้นการเดินเรือจากปากน้ำเจ้าพระยาและกรุงรัตนโกสินทร์',
      },
      {
        id: 'wp2',
        name: 'เกาะเกร็ด นนทบุรี',
        lat: 13.9114,
        lng: 100.4795,
        zoom: 12.0,
        pitch: 50,
        bearing: -10,
        durationSec: 2.5,
        narration: 'ลัดเลาะตามคุ้งน้ำเจ้าพระยาผ่านชุมชนเครื่องปั้นดินเผาโบราณ',
      },
      {
        id: 'wp3',
        name: 'เกาะเมืองพระนครศรีอยุธยา',
        lat: 14.3532,
        lng: 100.5689,
        zoom: 11.8,
        pitch: 55,
        bearing: 25,
        durationSec: 3.0,
        narration: 'สู่ศูนย์กลางการค้านานาชาติแห่งกรุงศรีอยุธยา',
      },
    ],
  },
  {
    id: 'bkk_tokyo_flight',
    title: 'เส้นทางบิน: กรุงเทพฯ (BKK) → โตเกียว (HND)',
    category: 'flight_path',
    projection: 'mercator',
    showRoutePath: true,
    routeColor: '#38bdf8',
    waypoints: [
      {
        id: 'f1',
        name: 'ท่าอากาศยานสุวรรณภูมิ (BKK)',
        lat: 13.69,
        lng: 100.7501,
        zoom: 5.2,
        pitch: 30,
        bearing: 35,
        durationSec: 2.5,
        narration: 'เครื่องบินออกเดินทางจากกรุงเทพมหานครมุ่งหน้าทิศตะวันออกเฉียงเหนือ',
      },
      {
        id: 'f2',
        name: 'ไทเป / ทะเลจีนตะวันออก',
        lat: 25.033,
        lng: 121.5654,
        zoom: 5.0,
        pitch: 40,
        bearing: 45,
        durationSec: 2.5,
        narration: 'บินผ่านน่านฟ้าไทเปและมหาสมุทรแปซิฟิกตะวันตก',
      },
      {
        id: 'f3',
        name: 'โตเกียว ฮาเนดะ (HND)',
        lat: 35.5494,
        lng: 139.7798,
        zoom: 6.5,
        pitch: 50,
        bearing: 10,
        durationSec: 3.0,
        narration: 'ลงจอดที่มหานครโตเกียว ระยะทางประมาณ 4,600 กิโลเมตร',
      },
    ],
  },
  {
    id: 'malacca_trade',
    title: 'ยุทธศาสตร์ช่องแคบมะละกาและอ่าวไทย',
    category: 'geography',
    projection: 'mercator',
    showRoutePath: true,
    routeColor: '#10b981',
    waypoints: [
      {
        id: 'm1',
        name: 'สิงคโปร์ / ช่องแคบมะละกา',
        lat: 1.2903,
        lng: 103.8519,
        zoom: 6.0,
        pitch: 35,
        bearing: 0,
        durationSec: 2.5,
        narration: 'เส้นทางเดินเรือขนส่งสินค้าที่หนาแน่นที่สุดแห่งหนึ่งของโลก',
      },
      {
        id: 'm2',
        name: 'คอคอดกระ จังหวัดระนอง–ชุมพร',
        lat: 10.4833,
        lng: 98.9667,
        zoom: 7.4,
        pitch: 45,
        bearing: 20,
        durationSec: 3.0,
        narration: 'จุดยุทธศาสตร์เชื่อมทะเลอันดามันสู่อ่าวไทยในภูมิภาคเอเชียตะวันออกเฉียงใต้',
      },
    ],
  },
];

export function MapStudioTab({
  activeProject,
  tileStyleUrl = 'https://demotiles.maplibre.org/style.json',
  attributionText = '© MapLibre • OpenStreetMap Contributors',
  onInjectMapScene,
}: MapStudioTabProps) {
  const [preset, setPreset] = useState<MapAnimationProject>(CURATED_MAP_PRESETS[0]);
  const [mapReady, setMapReady] = useState(false);
  const [fallbackCanvasMode, setFallbackCanvasMode] = useState(false);
  const [playingFlyover, setPlayingFlyover] = useState(false);
  const [activeWpIdx, setActiveWpIdx] = useState(0);
  const [newWpName, setNewWpName] = useState('');
  const [newWpLat, setNewWpLat] = useState('18.7883');
  const [newWpLng, setNewWpLng] = useState('98.9853');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const flyTimerRef = useRef<number | null>(null);

  // Initialize MapLibre GL with graceful offline GeoJSON Canvas 2D fallback
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    setMapReady(false);
    setFallbackCanvasMode(false);

    let disposed = false;
    try {
      const firstWp = preset.waypoints[0];
      const map = new maplibregl.Map({
        container,
        style: tileStyleUrl,
        center: [firstWp.lng, firstWp.lat],
        zoom: firstWp.zoom,
        pitch: firstWp.pitch,
        bearing: firstWp.bearing,
        attributionControl: false,
      });

      const loadTimeout = window.setTimeout(() => {
        if (!disposed && !map.loaded()) {
          setFallbackCanvasMode(true);
        }
      }, 4500);

      map.on('load', () => {
        window.clearTimeout(loadTimeout);
        if (disposed) return;
        setMapReady(true);
        setFallbackCanvasMode(false);
        const coords = preset.waypoints.map((w) => [w.lng, w.lat]);
        if (preset.showRoutePath && coords.length >= 2) {
          map.addSource('zk-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          });
          map.addLayer({
            id: 'zk-route-line',
            type: 'line',
            source: 'zk-route',
            paint: {
              'line-color': preset.routeColor,
              'line-width': 4,
              'line-dasharray': [2, 1],
            },
          });
        }
        preset.waypoints.forEach((wp, idx) => {
          new maplibregl.Marker({ color: idx === 0 ? '#10b981' : '#f5c542' })
            .setLngLat([wp.lng, wp.lat])
            .setPopup(new maplibregl.Popup({ offset: 18 }).setText(wp.name))
            .addTo(map);
        });
      });

      map.on('error', () => {
        window.clearTimeout(loadTimeout);
        if (!disposed) setFallbackCanvasMode(true);
      });

      mapRef.current = map;
      return () => {
        disposed = true;
        window.clearTimeout(loadTimeout);
        map.remove();
        mapRef.current = null;
      };
    } catch {
      setFallbackCanvasMode(true);
    }
  }, [preset, tileStyleUrl]);

  // Draw crisp offline vector GeoJSON route canvas when fallback mode active or as synchronized overlay
  useEffect(() => {
    if (!fallbackCanvasMode) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0e1726';
    ctx.fillRect(0, 0, w, h);

    // Coordinate grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const lats = preset.waypoints.map((wp) => wp.lat);
    const lngs = preset.waypoints.map((wp) => wp.lng);
    const minLat = Math.min(...lats) - 1;
    const maxLat = Math.max(...lats) + 1;
    const minLng = Math.min(...lngs) - 1;
    const maxLng = Math.max(...lngs) + 1;

    const toXY = (wp: MapWaypoint) => ({
      x: 60 + ((wp.lng - minLng) / Math.max(0.1, maxLng - minLng)) * (w - 120),
      y: h - 60 - ((wp.lat - minLat) / Math.max(0.1, maxLat - minLat)) * (h - 120),
    });

    const pts = preset.waypoints.map(toXY);
    ctx.strokeStyle = preset.routeColor;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);

    pts.forEach((p, idx) => {
      ctx.fillStyle = idx === activeWpIdx ? '#34d399' : '#f5c542';
      ctx.beginPath();
      ctx.arc(p.x, p.y, idx === activeWpIdx ? 10 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '700 13px "Prompt", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(preset.waypoints[idx].name, p.x + 14, p.y + 4);
    });
  }, [fallbackCanvasMode, preset, activeWpIdx]);

  const flyToWaypoint = (idx: number) => {
    const wp = preset.waypoints[idx];
    if (!wp) return;
    setActiveWpIdx(idx);
    if (mapRef.current && mapReady) {
      mapRef.current.flyTo({
        center: [wp.lng, wp.lat],
        zoom: wp.zoom,
        pitch: wp.pitch,
        bearing: wp.bearing,
        duration: Math.round(wp.durationSec * 800),
      });
    }
  };

  const toggleFlyover = () => {
    if (playingFlyover) {
      if (flyTimerRef.current !== null) window.clearTimeout(flyTimerRef.current);
      setPlayingFlyover(false);
      return;
    }
    setPlayingFlyover(true);
    let idx = 0;
    const step = () => {
      if (idx >= preset.waypoints.length) {
        setPlayingFlyover(false);
        return;
      }
      flyToWaypoint(idx);
      const waitMs = Math.max(1200, preset.waypoints[idx].durationSec * 1000);
      idx++;
      flyTimerRef.current = window.setTimeout(step, waitMs);
    };
    step();
  };

  const handleAddWaypoint = () => {
    const lat = Number(newWpLat);
    const lng = Number(newWpLng);
    if (!newWpName.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setPreset((prev) => ({
      ...prev,
      waypoints: [
        ...prev.waypoints,
        {
          id: `wp_${Date.now()}`,
          name: newWpName.trim(),
          lat,
          lng,
          zoom: 9,
          pitch: 45,
          bearing: 0,
          durationSec: 2.5,
          narration: `เดินทางต่อไปยัง ${newWpName.trim()}`,
        },
      ],
    }));
    setNewWpName('');
  };

  const handleInjectToProject = () => {
    const mapScene: StudioScene = {
      id: `sc_map_${Date.now()}`,
      narration: preset.waypoints.map((w) => w.narration).join(' '),
      highlightWords: preset.waypoints.map((w) => w.name.split(' ')[0]),
      holdAfter: 0.6,
      bg: { preset: 'grid_tech' },
      blurBg: false,
      hud: { mode: preset.category, route: `${preset.waypoints.length} จุด` },
      actors: [],
      props: [],
      pov: null,
      cards: [
        {
          type: 'map_route',
          title: preset.title,
          from: preset.waypoints[0]?.name || '',
          to: preset.waypoints[preset.waypoints.length - 1]?.name || '',
          route: preset.waypoints.map((w) => w.name),
          dur: 6,
        },
      ],
      camera: { type: 'push_in', shot: 'wide' },
      fx: [{ type: 'sparkles', intensity: 0.35 }],
      sfx: [{ name: 'whoosh', vol: 0.45 }],
      ambient: 'wind',
      transition: 'fade',
      visualIntent: `MapLibre flyover animation: ${preset.title}`,
    };

    const nextProj: StudioProject = {
      ...activeProject,
      updatedAt: Date.now(),
      episodes: activeProject.episodes.map((ep, idx) =>
        idx === 0 ? { ...ep, scenes: [...ep.scenes, mapScene] } : ep
      ),
    };
    onInjectMapScene(nextProj);
  };

  return (
    <div data-testid="map-studio-tab" className="space-y-4 px-3 py-4 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#13141d] p-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-amber-300" />
          <div>
            <div className="text-sm font-extrabold text-white">Map Animation Engine (MapLibre GL)</div>
            <div className="text-[11px] text-[#9894b8]">
              สร้างฉากแผนที่โลก ประเทศ ประวัติศาสตร์ เส้นทางเดินเรือ และการบินจริง
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleFlyover}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-xs font-extrabold text-slate-950 hover:bg-amber-300 cursor-pointer"
          >
            {playingFlyover ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span>{playingFlyover ? 'หยุด Flyover' : 'เล่น Flyover'}</span>
          </button>
          <button
            type="button"
            onClick={handleInjectToProject}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
          >
            <Film className="h-4 w-4" />
            <span>เพิ่มฉากแผนที่เข้าโปรเจกต์วิดีโอ</span>
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {CURATED_MAP_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPreset(p);
              setActiveWpIdx(0);
            }}
            className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold cursor-pointer ${
              preset.id === p.id
                ? 'bg-amber-400 text-slate-950'
                : 'border border-white/10 bg-[#13141d] text-white/80 hover:bg-white/10'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Map Viewport + Waypoints */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="relative h-[380px] overflow-hidden rounded-2xl border border-white/15 bg-[#0b101b] lg:col-span-8">
          <div
            ref={mapContainerRef}
            className={`h-full w-full ${fallbackCanvasMode ? 'hidden' : 'block'}`}
          />
          {fallbackCanvasMode && (
            <canvas ref={fallbackCanvasRef} width={760} height={380} className="h-full w-full object-cover" />
          )}
          <div className="absolute bottom-2 right-2 rounded-lg bg-black/75 px-2.5 py-1 text-[10px] text-white/75">
            {fallbackCanvasMode ? 'Offline Vector GeoJSON Preview • ' : ''}
            {attributionText}
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-[#13141d] p-3 lg:col-span-4 space-y-2.5 max-h-[380px] overflow-y-auto">
          <div className="text-xs font-extrabold text-white">จุดหมายบนแผนที่ (Waypoints)</div>
          {preset.waypoints.map((wp, idx) => (
            <button
              key={wp.id}
              type="button"
              onClick={() => flyToWaypoint(idx)}
              className={`w-full rounded-xl border p-2.5 text-left cursor-pointer ${
                activeWpIdx === idx
                  ? 'border-amber-400 bg-amber-400/15'
                  : 'border-white/10 bg-[#1b1d29]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="inline-flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-amber-300" />
                  {wp.name}
                </span>
                <span className="font-mono-tabular text-[10px] text-amber-300">{wp.durationSec}s</span>
              </div>
              <div className="mt-1 font-mono-tabular text-[10px] text-[#9894b8]">
                {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)} • zoom {wp.zoom}
              </div>
              <div className="mt-1 text-[11px] text-[#c7c3e0]">{wp.narration}</div>
            </button>
          ))}

          <div className="border-t border-white/10 pt-2.5 space-y-1.5">
            <div className="text-[11px] font-bold text-white">เพิ่มจุดพิกัดใหม่</div>
            <input
              type="text"
              value={newWpName}
              onChange={(e) => setNewWpName(e.target.value)}
              placeholder="ชื่อสถานที่ เช่น เชียงใหม่"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                value={newWpLat}
                onChange={(e) => setNewWpLat(e.target.value)}
                placeholder="Lat"
                className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono-tabular text-xs text-white"
              />
              <input
                type="text"
                value={newWpLng}
                onChange={(e) => setNewWpLng(e.target.value)}
                placeholder="Lng"
                className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono-tabular text-xs text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleAddWaypoint}
              className="inline-flex w-full min-h-[38px] items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>เพิ่ม Waypoint</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
