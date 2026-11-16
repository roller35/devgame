import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  Camera,
  Pause,
  RotateCcw,
  Terminal,
  Trophy,
  User,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { LANDMARKS, MISSIONS } from '../game/catalog';
import { ROAD_NETWORK, WORLD_HALF_EXTENT } from '../game/terrain';
import { HudSnapshot, PhysicsInput } from '../game/types';

interface HudOverlayProps {
  hud: HudSnapshot;
  muted: boolean;
  touchControlsEnabled: boolean;
  fuelEnabled: boolean;
  onToggleCamera: () => void;
  onResetBike: () => void;
  onToggleMute: () => void;
  onOpenPause: () => void;
  onOpenGarage: () => void;
  onOpenMap: () => void;
  onOpenMissions: () => void;
  onOpenSandbox: () => void;
  onMountToggle: () => void;
  onRefuel: () => void;
  onHorn: () => void;
  onTouchInput: (partial: Partial<PhysicsInput>) => void;
}

const SPEEDO_MAX = 200;
const SPEEDO_START_DEG = -135; // relative to 12 o'clock
const SPEEDO_SWEEP_DEG = 270;

function polarPoint(cx: number, cy: number, radius: number, degFromTop: number) {
  const rad = ((degFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  };
}

function describeArc(cx: number, cy: number, radius: number, startDeg: number, endDeg: number) {
  const start = polarPoint(cx, cy, radius, endDeg);
  const end = polarPoint(cx, cy, radius, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  muted,
  touchControlsEnabled,
  fuelEnabled,
  onToggleCamera,
  onResetBike,
  onToggleMute,
  onOpenPause,
  onOpenGarage,
  onOpenMap,
  onOpenMissions,
  onOpenSandbox,
  onMountToggle,
  onRefuel,
  onHorn,
  onTouchInput,
}) => {
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const [steerPressed, setSteerPressed] = useState<-1 | 0 | 1>(0);
  const [brakePressed, setBrakePressed] = useState(false);
  const [throttlePressed, setThrottlePressed] = useState(false);

  // Release held touch inputs if component unmounts or window loses focus
  useEffect(() => {
    const releaseAll = () => {
      setSteerPressed(0);
      setBrakePressed(false);
      setThrottlePressed(false);
    };
    window.addEventListener('blur', releaseAll);
    return () => window.removeEventListener('blur', releaseAll);
  }, []);

  // Precompute speedometer ticks (0..200 every 10 km/h)
  const speedoTicks = useMemo(() => {
    const items: Array<{
      val: number;
      major: boolean;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      lx: number;
      ly: number;
      color: string;
    }> = [];
    for (let v = 0; v <= SPEEDO_MAX; v += 10) {
      const major = v % 20 === 0;
      const deg = SPEEDO_START_DEG + (v / SPEEDO_MAX) * SPEEDO_SWEEP_DEG;
      const outer = polarPoint(80, 80, 66, deg);
      const inner = polarPoint(80, 80, major ? 58 : 61.5, deg);
      const labelPos = polarPoint(80, 80, 48, deg);
      const color = v >= 170 ? '#ef4444' : v >= 140 ? '#34d399' : '#f1f5f9';
      items.push({
        val: v,
        major,
        x1: outer.x,
        y1: outer.y,
        x2: inner.x,
        y2: inner.y,
        lx: labelPos.x,
        ly: labelPos.y,
        color,
      });
    }
    return items;
  }, []);

  // Draw live circular road-network minimap centered on player
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const half = size / 2;
    const scale = size / 340;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#14191f';
    ctx.fillRect(0, 0, size, size);

    // Subtle radar rings
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(half, half, half * 0.48, 0, Math.PI * 2);
    ctx.arc(half, half, half * 0.8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(half, half);

    // Roads relative to player
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const road of ROAD_NETWORK) {
      ctx.beginPath();
      road.nodes.forEach((n, idx) => {
        const rx = (n.x - hud.playerX) * scale;
        const rz = (n.z - hud.playerZ) * scale;
        if (idx === 0) ctx.moveTo(rx, rz);
        else ctx.lineTo(rx, rz);
      });
      if (road.closed) ctx.closePath();
      ctx.strokeStyle = road.surface === 'asphalt' ? '#64748b' : '#a16207';
      ctx.lineWidth = Math.max(2.5, road.width * scale * 0.72);
      ctx.stroke();
    }

    // Landmarks inside circular view
    for (const lm of LANDMARKS) {
      const lx = (lm.x - hud.playerX) * scale;
      const lz = (lm.z - hud.playerZ) * scale;
      if (Math.hypot(lx, lz) > half - 6) continue;
      ctx.fillStyle =
        lm.kind === 'garage'
          ? '#34d399'
          : lm.kind === 'petrol'
          ? '#ef4444'
          : '#f59e0b';
      ctx.beginPath();
      ctx.arc(lx, lz, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Active mission checkpoint or GPS target
    const activeM = hud.activeMission
      ? MISSIONS.find((m) => m.id === hud.activeMission!.missionId)
      : null;
    const cp =
      activeM && activeM.checkpoints[hud.activeMission!.checkpointIndex];
    const target = cp
      ? { x: cp.x, z: cp.z, color: '#f59e0b' }
      : hud.gpsTarget
      ? { x: hud.gpsTarget.x, z: hud.gpsTarget.z, color: '#38bdf8' }
      : null;

    if (target) {
      const tx = (target.x - hud.playerX) * scale;
      const tz = (target.z - hud.playerZ) * scale;
      const clampedDist = Math.min(half - 10, Math.hypot(tx, tz));
      const ang = Math.atan2(tz, tx);
      ctx.fillStyle = target.color;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * clampedDist, Math.sin(ang) * clampedDist, 4.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bright green directional player arrow (matches reference)
    ctx.rotate(-hud.playerHeading);
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5.5, 5.5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5.5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }, [hud.playerX, hud.playerZ, hud.playerHeading, hud.activeMission, hud.gpsTarget]);

  const activeMissionDef = hud.activeMission
    ? MISSIONS.find((m) => m.id === hud.activeMission!.missionId)
    : null;
  const activeCp =
    activeMissionDef &&
    activeMissionDef.checkpoints[hud.activeMission!.checkpointIndex];
  const cpDist = activeCp
    ? Math.round(Math.hypot(activeCp.x - hud.playerX, activeCp.z - hud.playerZ))
    : null;

  const clampedSpeed = Math.min(SPEEDO_MAX, Math.max(0, hud.speedKmh));
  const needleDeg = SPEEDO_START_DEG + (clampedSpeed / SPEEDO_MAX) * SPEEDO_SWEEP_DEG;
  const speedArcEndDeg = Math.max(SPEEDO_START_DEG + 1, needleDeg);

  const clampedWorldEdge =
    Math.abs(hud.playerX) > WORLD_HALF_EXTENT - 40 ||
    Math.abs(hud.playerZ) > WORLD_HALF_EXTENT - 40;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none">
      {/* Top Row: Left Circular Minimap + Compact Info | Right Pause + Circular Analog Speedometer + Cam/Reset */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-Left Cluster */}
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Circular Minimap */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Expand World Map"
            title="World Map [Tab]"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenMap();
            }}
            className="pointer-events-auto relative w-[92px] h-[92px] sm:w-[116px] sm:h-[116px] md:w-[128px] md:h-[128px] rounded-full p-[3px] bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600 shadow-[0_4px_18px_rgba(0,0,0,0.7)] cursor-pointer shrink-0 transition-transform active:scale-95"
          >
            <div className="w-full h-full rounded-full bg-stone-950 p-[2px]">
              <canvas ref={minimapRef} width={136} height={136} className="w-full h-full rounded-full block" />
            </div>
          </button>

          {/* Discreet Region / Balance / Quick Actions */}
          <div className="flex flex-col gap-1.5 items-start pt-0.5">
            <div className="bg-stone-950/75 border border-white/15 rounded-md px-2.5 py-1 shadow-md">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400 leading-tight">
                <span>{hud.regionName}</span>
                <span aria-hidden="true" className="text-stone-500">·</span>
                <span className="font-telemetry text-stone-100">NPR {hud.moneyNpr.toLocaleString()}</span>
              </div>
            </div>

            {/* Compact Quick Action Buttons */}
            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Open Garage"
                title="Garage [G]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenGarage();
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-950/75 hover:bg-stone-800 border border-white/25 text-stone-100 flex items-center justify-center cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Open Missions"
                title="Missions [J]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenMissions();
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-950/75 hover:bg-stone-800 border border-white/25 text-stone-100 flex items-center justify-center cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Open Sandbox Console"
                title="Sandbox Console [/]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenSandbox();
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-950/75 hover:bg-stone-800 border border-white/25 text-stone-100 flex items-center justify-center cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label={hud.onFoot ? 'Mount Motorcycle' : 'Dismount Motorcycle'}
                title={hud.onFoot ? 'Mount [E]' : 'Dismount [E]'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onMountToggle();
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-950/75 hover:bg-stone-800 border border-white/25 text-stone-100 flex items-center justify-center cursor-pointer"
              >
                {hud.onFoot ? <Bike className="w-3.5 h-3.5 text-emerald-400" /> : <User className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                title="Mute [M]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-950/75 hover:bg-stone-800 border border-white/25 text-stone-100 flex items-center justify-center cursor-pointer"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Active Mission Compact Card */}
            {activeMissionDef && hud.activeMission && (
              <div className="bg-stone-950/85 border border-amber-500/60 rounded-md px-2.5 py-1.5 shadow-lg">
                <div className="text-[11px] font-semibold text-amber-400 leading-tight">
                  {activeMissionDef.title}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] font-telemetry text-stone-100">
                  {activeMissionDef.category === 'stunt' && activeMissionDef.targetStuntPoints ? (
                    <span>
                      Stunt: {hud.activeMission.stuntPointsEarned} / {activeMissionDef.targetStuntPoints}
                    </span>
                  ) : (
                    <span>
                      CP {hud.activeMission.checkpointIndex + 1}/{activeMissionDef.checkpoints.length}
                      {cpDist !== null ? ` · ${cpDist}m` : ''}
                    </span>
                  )}
                  {activeMissionDef.timeLimitSec && (
                    <span className="text-amber-300">
                      {Math.max(0, Math.ceil(activeMissionDef.timeLimitSec - hud.activeMission.elapsedSec))}s
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Contextual Prompts */}
            {hud.nearGarage && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenGarage();
                }}
                className="pointer-events-auto px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
              >
                Open Garage [G]
              </button>
            )}
            {hud.nearPetrol && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onRefuel();
                }}
                className="pointer-events-auto px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
              >
                Refuel Tank [F]
              </button>
            )}
          </div>
        </div>

        {/* Top-Right Cluster: Pause Button + Analog Speedometer + Vertical Camera/Reset Stack */}
        <div className="flex flex-col items-end">
          <div className="flex items-start gap-2 sm:gap-3">
            {/* Circular Mint-Ringed Pause Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Game"
              title="Pause [Esc]"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenPause();
              }}
              className="pointer-events-auto mt-1.5 sm:mt-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-stone-950/70 hover:bg-stone-900 border-2 border-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.45)] flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <div className="w-[82%] h-[82%] rounded-full border border-[#34d399]/60 flex items-center justify-center">
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-[#34d399] fill-[#34d399]" />
              </div>
            </button>

            {/* Circular Analog Speedometer */}
            <div
              data-testid="hud-speedometer"
              className="relative w-[108px] h-[108px] sm:w-[130px] sm:h-[130px] md:w-[144px] md:h-[144px] shrink-0"
            >
              <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-[0_6px_16px_rgba(0,0,0,0.75)]">
                {/* Gauge Dark Body */}
                <circle cx="80" cy="80" r="76" fill="rgba(10, 14, 19, 0.88)" />

                {/* Outer Metallic White Ring */}
                <circle cx="80" cy="80" r="75" fill="none" stroke="rgba(241, 245, 249, 0.9)" strokeWidth="2.5" />

                {/* Mint Accent Outer Arc */}
                <path
                  d={describeArc(80, 80, 71, -145, 145)}
                  fill="none"
                  stroke="rgba(52, 211, 153, 0.45)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Active Speed Progress Arc */}
                {clampedSpeed > 1 && (
                  <path
                    d={describeArc(80, 80, 71, SPEEDO_START_DEG, speedArcEndDeg)}
                    fill="none"
                    stroke={clampedSpeed >= 170 ? '#ef4444' : '#34d399'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                )}

                {/* Redline Band */}
                <path
                  d={describeArc(80, 80, 63.5, 94, 135)}
                  fill="none"
                  stroke="rgba(239, 68, 68, 0.85)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Tick Marks & Speed Numerals */}
                {speedoTicks.map((t) => (
                  <g key={t.val}>
                    <line
                      x1={t.x1}
                      y1={t.y1}
                      x2={t.x2}
                      y2={t.y2}
                      stroke={t.color}
                      strokeWidth={t.major ? 2.2 : 1.2}
                      strokeLinecap="round"
                    />
                    {t.major && (
                      <text
                        x={t.lx}
                        y={t.ly}
                        fill={t.color}
                        fontSize="9.5"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {t.val}
                      </text>
                    )}
                  </g>
                ))}

                {/* Rotating Speed Needle */}
                <g transform={`rotate(${needleDeg} 80 80)`}>
                  <polygon
                    points="77.8,80 80,22 82.2,80"
                    fill="#f8fafc"
                  />
                  <polygon
                    points="78.8,80 80,24 81.2,80"
                    fill="#34d399"
                  />
                </g>

                {/* Center Hub Ring */}
                <circle cx="80" cy="80" r="8.5" fill="#0d1218" stroke="#34d399" strokeWidth="2.6" />
                <circle cx="80" cy="80" r="3.2" fill="#34d399" />
              </svg>

              {/* Digital Speed Readout inside Bottom Wedge */}
              <div className="absolute inset-x-0 top-[58%] flex flex-col items-center pointer-events-none">
                <span className="text-[8px] sm:text-[9px] font-semibold tracking-widest text-stone-300 uppercase leading-none">
                  {hud.onFoot ? 'FOOT' : 'KM/H'}
                </span>
                <span className="font-display font-bold font-telemetry text-lg sm:text-xl md:text-2xl text-white leading-none mt-0.5">
                  {hud.onFoot ? 'WALK' : hud.speedKmh}
                </span>
                <div className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-telemetry text-emerald-300 leading-none mt-0.5">
                  {!hud.onFoot && <span>G{hud.gear}</span>}
                  {fuelEnabled && <span className={hud.fuelPct < 20 ? 'text-red-400' : 'text-stone-300'}>{hud.fuelPct}%</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Vertical Stack Right Below Speedometer: Camera + Reset Bike */}
          <div className="flex flex-col items-end gap-2 mt-1.5 mr-1 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Switch Camera"
              title="Camera [C]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleCamera();
              }}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-stone-950/75 hover:bg-stone-900 border-2 border-white/85 shadow-[0_3px_10px_rgba(0,0,0,0.65)] text-white flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Reset Bike on Road"
              title="Reset Bike [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onResetBike();
              }}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-stone-950/75 hover:bg-stone-900 border-2 border-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.4)] text-white flex items-center justify-center cursor-pointer transition-transform active:scale-95"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Center Transient Stunt / Toast Callouts */}
      <div className="flex flex-col items-center gap-1">
        {hud.activeStuntLabel && (
          <div className="px-4 py-1 rounded-md bg-amber-500 text-stone-950 font-display font-bold text-sm sm:text-base tracking-wider shadow-lg">
            {hud.activeStuntLabel} · {hud.activeStuntPoints} PTS
          </div>
        )}
        {hud.lastStuntBanner && !hud.activeStuntLabel && (
          <div className="px-3 py-1 rounded-md bg-stone-950/90 border border-amber-500/60 text-amber-300 font-telemetry text-xs">
            {hud.lastStuntBanner}
          </div>
        )}
        {hud.toastMessage && (
          <div className="px-3 py-1 rounded-md bg-stone-950/90 border border-stone-700 text-stone-100 text-xs font-medium">
            {hud.toastMessage}
          </div>
        )}
        {clampedWorldEdge && (
          <div className="px-3 py-1 rounded-md bg-red-950/90 border border-red-500/60 text-red-200 text-xs">
            Himalayan Border Ridge — Turn back toward valley roads
          </div>
        )}
      </div>

      {/* Bottom Row: Left Steering Circles (< >) | Right Brake Disc & Handlebar Throttle Grip */}
      <div className="flex items-end justify-between gap-4 pb-0.5 sm:pb-1">
        {/* Bottom-Left Controls */}
        {touchControlsEnabled ? (
          <div className="flex items-center gap-3 sm:gap-4 pointer-events-auto">
            {/* Steer Left Circle */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Steer Left"
              onPointerDown={(e) => {
                e.currentTarget.blur();
                setSteerPressed(-1);
                onTouchInput({ steer: -1 });
              }}
              onPointerUp={() => {
                setSteerPressed(0);
                onTouchInput({ steer: 0 });
              }}
              onPointerLeave={() => {
                if (steerPressed === -1) {
                  setSteerPressed(0);
                  onTouchInput({ steer: 0 });
                }
              }}
              onPointerCancel={() => {
                setSteerPressed(0);
                onTouchInput({ steer: 0 });
              }}
              className="relative w-[64px] h-[64px] sm:w-[76px] sm:h-[76px] md:w-[86px] md:h-[86px] rounded-full cursor-pointer touch-none transition-transform active:scale-95"
            >
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
                <circle cx="50" cy="50" r="44" fill="rgba(16, 22, 28, 0.56)" />
                <circle
                  cx="50"
                  cy="50"
                  r="47"
                  fill="none"
                  stroke={steerPressed === -1 ? '#34d399' : 'rgba(255,255,255,0.88)'}
                  strokeWidth="3"
                  strokeDasharray="24 6 12 6 34 6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={steerPressed === -1 ? '#34d399' : 'rgba(255,255,255,0.72)'}
                  strokeWidth="2.4"
                />
                <path
                  d="M 58 32 L 38 50 L 58 68"
                  fill="none"
                  stroke={steerPressed === -1 ? '#34d399' : '#f8fafc'}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Steer Right Circle */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Steer Right"
              onPointerDown={(e) => {
                e.currentTarget.blur();
                setSteerPressed(1);
                onTouchInput({ steer: 1 });
              }}
              onPointerUp={() => {
                setSteerPressed(0);
                onTouchInput({ steer: 0 });
              }}
              onPointerLeave={() => {
                if (steerPressed === 1) {
                  setSteerPressed(0);
                  onTouchInput({ steer: 0 });
                }
              }}
              onPointerCancel={() => {
                setSteerPressed(0);
                onTouchInput({ steer: 0 });
              }}
              className="relative w-[64px] h-[64px] sm:w-[76px] sm:h-[76px] md:w-[86px] md:h-[86px] rounded-full cursor-pointer touch-none transition-transform active:scale-95"
            >
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
                <circle cx="50" cy="50" r="44" fill="rgba(16, 22, 28, 0.56)" />
                <circle
                  cx="50"
                  cy="50"
                  r="47"
                  fill="none"
                  stroke={steerPressed === 1 ? '#34d399' : 'rgba(255,255,255,0.88)'}
                  strokeWidth="3"
                  strokeDasharray="24 6 12 6 34 6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={steerPressed === 1 ? '#34d399' : 'rgba(255,255,255,0.72)'}
                  strokeWidth="2.4"
                />
                <path
                  d="M 42 32 L 62 50 L 42 68"
                  fill="none"
                  stroke={steerPressed === 1 ? '#34d399' : '#f8fafc'}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onMountToggle();
              }}
              className="px-3 py-1.5 rounded-lg bg-stone-950/80 hover:bg-stone-800 border border-stone-700/70 text-xs text-stone-200 cursor-pointer"
            >
              {hud.onFoot ? 'Mount Bike [E]' : 'Dismount [E]'}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onHorn();
              }}
              className="px-3 py-1.5 rounded-lg bg-stone-950/80 hover:bg-stone-800 border border-stone-700/70 text-xs text-stone-200 cursor-pointer"
            >
              Horn [H]
            </button>
          </div>
        )}

        {/* Bottom-Right Controls: Brake Disc Circle + Motorcycle Handlebar Throttle Grip */}
        {touchControlsEnabled && (
          <div className="flex items-end gap-3 sm:gap-5 pointer-events-auto">
            {/* Circular BRAKE Disc Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Brake"
              onPointerDown={(e) => {
                e.currentTarget.blur();
                setBrakePressed(true);
                onTouchInput({ brakeFront: 1, brakeRear: 1 });
              }}
              onPointerUp={() => {
                setBrakePressed(false);
                onTouchInput({ brakeFront: 0, brakeRear: 0 });
              }}
              onPointerLeave={() => {
                if (brakePressed) {
                  setBrakePressed(false);
                  onTouchInput({ brakeFront: 0, brakeRear: 0 });
                }
              }}
              onPointerCancel={() => {
                setBrakePressed(false);
                onTouchInput({ brakeFront: 0, brakeRear: 0 });
              }}
              className="relative w-[64px] h-[64px] sm:w-[76px] sm:h-[76px] md:w-[84px] md:h-[84px] rounded-full cursor-pointer touch-none transition-transform active:scale-95"
            >
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)]">
                <circle cx="50" cy="50" r="44" fill={brakePressed ? 'rgba(127, 29, 29, 0.78)' : 'rgba(16, 22, 28, 0.56)'} />
                <circle
                  cx="50"
                  cy="50"
                  r="47"
                  fill="none"
                  stroke={brakePressed ? '#f87171' : 'rgba(255,255,255,0.88)'}
                  strokeWidth="3"
                  strokeDasharray="24 6 12 6 34 6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={brakePressed ? '#f87171' : 'rgba(255,255,255,0.72)'}
                  strokeWidth="2.4"
                />

                {/* BRAKE label */}
                <text
                  x="50"
                  y="34"
                  fill="#f8fafc"
                  fontSize="11.5"
                  fontWeight="700"
                  textAnchor="middle"
                  letterSpacing="0.8"
                  fontFamily="Chakra Petch, sans-serif"
                >
                  BRAKE
                </text>

                {/* Brake Disc Rotor + Caliper Graphic */}
                <g transform="translate(50, 62)">
                  <circle cx="0" cy="0" r="16" fill="rgba(226,232,240,0.16)" stroke="#e2e8f0" strokeWidth="2.2" />
                  <circle cx="0" cy="0" r="10.5" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="3 2.5" />
                  <circle cx="0" cy="0" r="5" fill="rgba(15,23,42,0.9)" stroke="#e2e8f0" strokeWidth="1.8" />
                  {/* Perforated rotor holes */}
                  <circle cx="0" cy="-13" r="1.2" fill="#e2e8f0" />
                  <circle cx="11" cy="-7" r="1.2" fill="#e2e8f0" />
                  <circle cx="11" cy="7" r="1.2" fill="#e2e8f0" />
                  <circle cx="0" cy="13" r="1.2" fill="#e2e8f0" />
                  <circle cx="-11" cy="7" r="1.2" fill="#e2e8f0" />
                  {/* Caliper clamp on left side */}
                  <path
                    d="M -17 -9 C -20 -4 -20 4 -17 9 L -11 7 L -11 -7 Z"
                    fill="#f1f5f9"
                    stroke="#0f172a"
                    strokeWidth="1"
                  />
                </g>
              </svg>
            </button>

            {/* Motorcycle Handlebar Throttle Grip & Brake Lever Button */}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Accelerate Throttle"
              onPointerDown={(e) => {
                e.currentTarget.blur();
                setThrottlePressed(true);
                onTouchInput({ throttle: 1 });
              }}
              onPointerUp={() => {
                setThrottlePressed(false);
                onTouchInput({ throttle: 0 });
              }}
              onPointerLeave={() => {
                if (throttlePressed) {
                  setThrottlePressed(false);
                  onTouchInput({ throttle: 0 });
                }
              }}
              onPointerCancel={() => {
                setThrottlePressed(false);
                onTouchInput({ throttle: 0 });
              }}
              className="relative w-[112px] h-[64px] sm:w-[132px] sm:h-[76px] md:w-[150px] md:h-[86px] cursor-pointer touch-none transition-transform active:scale-95"
            >
              <svg
                viewBox="0 0 180 105"
                className="w-full h-full drop-shadow-[0_5px_12px_rgba(0,0,0,0.7)]"
              >
                {/* Upper Front Brake Lever */}
                <path
                  d="M 28 52 L 58 43 L 146 14 C 155 11 162 15 159 23 C 156 29 149 27 142 29 L 66 53 L 52 63 Z"
                  fill={throttlePressed ? '#6ee7b7' : '#e2e8f0'}
                  stroke="#1e293b"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                {/* Lever Pivot Mount Block */}
                <path
                  d="M 16 44 L 44 44 L 48 64 L 22 64 Z"
                  fill={throttlePressed ? '#34d399' : '#cbd5e1'}
                  stroke="#1e293b"
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                />
                <circle cx="33" cy="54" r="4" fill="#1e293b" />

                {/* Inner Collar Flange */}
                <rect
                  x="30"
                  y="60"
                  width="12"
                  height="38"
                  rx="4"
                  fill={throttlePressed ? '#a7f3d0' : '#f1f5f9'}
                  stroke="#1e293b"
                  strokeWidth="2.4"
                />

                {/* Handlebar Twist Grip Barrel */}
                <rect
                  x="42"
                  y="65"
                  width="112"
                  height="28"
                  rx="6"
                  fill={throttlePressed ? '#6ee7b7' : '#e2e8f0'}
                  stroke="#1e293b"
                  strokeWidth="2.4"
                />

                {/* Textured Grip Grooves */}
                <path
                  d="M 55 71 C 62 68 72 68 80 71 C 88 74 98 74 108 71 C 118 68 128 68 138 71"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 55 87 C 62 90 72 90 80 87 C 88 84 98 84 108 87 C 118 90 128 90 138 87"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line x1="68" y1="67" x2="68" y2="91" stroke="#64748b" strokeWidth="1.8" />
                <line x1="94" y1="67" x2="94" y2="91" stroke="#64748b" strokeWidth="1.8" />
                <line x1="120" y1="67" x2="120" y2="91" stroke="#64748b" strokeWidth="1.8" />

                {/* Bar-End Cap */}
                <ellipse
                  cx="154"
                  cy="79"
                  rx="10"
                  ry="15"
                  fill={throttlePressed ? '#34d399' : '#cbd5e1'}
                  stroke="#1e293b"
                  strokeWidth="2.4"
                />
                <ellipse
                  cx="155"
                  cy="79"
                  rx="4.5"
                  ry="7.5"
                  fill="#1e293b"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
