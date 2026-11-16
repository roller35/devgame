import React, { useState } from 'react';
import { Navigation, X } from 'lucide-react';
import { LANDMARKS, REGIONS } from '../game/catalog';
import { PHEWA_LAKE_CENTER, PHEWA_LAKE_RADIUS, ROAD_NETWORK, WORLD_HALF_EXTENT } from '../game/terrain';
import { HudSnapshot, LandmarkDef, RegionId, SaveData } from '../game/types';

interface WorldMapModalProps {
  hud: HudSnapshot;
  save: SaveData;
  onSetGps: (target: { x: number; z: number; label: string } | null) => void;
  onTeleportRegion: (regionId: RegionId) => void;
  onClose: () => void;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  hud,
  save,
  onSetGps,
  onTeleportRegion,
  onClose,
}) => {
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkDef | null>(null);

  const toMapX = (x: number) => ((x + WORLD_HALF_EXTENT) / (WORLD_HALF_EXTENT * 2)) * 600;
  const toMapY = (z: number) => ((z + WORLD_HALF_EXTENT) / (WORLD_HALF_EXTENT * 2)) * 600;

  return (
    <div className="absolute inset-0 z-30 bg-stone-950/92 flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-5xl bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[94%]">
        {/* Left: Interactive SVG Nepal World Map */}
        <div className="flex-1 bg-stone-950 p-4 flex items-center justify-center relative">
          <svg
            viewBox="0 0 600 600"
            className="w-full max-w-[520px] aspect-square rounded-lg border border-stone-800 bg-[#1a2218]"
          >
            {/* Elevation Zone Hints */}
            <rect x="0" y="0" width="600" height="190" fill="#27323f" opacity="0.65" />
            <rect x="0" y="405" width="600" height="195" fill="#2c3d1e" opacity="0.65" />

            {/* Phewa Lake */}
            <circle
              cx={toMapX(PHEWA_LAKE_CENTER.x)}
              cy={toMapY(PHEWA_LAKE_CENTER.z)}
              r={(PHEWA_LAKE_RADIUS / (WORLD_HALF_EXTENT * 2)) * 600}
              fill="#0e7490"
              opacity="0.85"
            />

            {/* Road Network */}
            {ROAD_NETWORK.map((road) => {
              const pts = road.nodes.map((n) => `${toMapX(n.x)},${toMapY(n.z)}`).join(' ');
              const Tag = road.closed ? 'polygon' : 'polyline';
              return (
                <Tag
                  key={road.id}
                  points={pts}
                  fill="none"
                  stroke={
                    road.surface === 'asphalt'
                      ? '#a1a1aa'
                      : road.surface === 'bridge'
                      ? '#f59e0b'
                      : '#b45309'
                  }
                  strokeWidth={road.surface === 'asphalt' ? 4 : 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Region Labels */}
            {REGIONS.map((r) => (
              <text
                key={r.id}
                x={toMapX(r.mapBounds.x)}
                y={toMapY(r.mapBounds.z) - (r.id === 'kathmandu' ? 54 : 30)}
                textAnchor="middle"
                fill="#f5f5f4"
                stroke="#0c0a09"
                strokeWidth="4"
                paintOrder="stroke"
                fontSize="12"
                fontWeight="700"
                className="pointer-events-none"
              >
                {r.name} ({r.elevationLabel})
              </text>
            ))}

            {/* Interactive Landmarks */}
            {LANDMARKS.map((lm) => {
              const discovered = save.discoveredLandmarkIds.includes(lm.id);
              const color =
                lm.kind === 'garage'
                  ? '#10b981'
                  : lm.kind === 'petrol'
                  ? '#ef4444'
                  : lm.kind === 'stunt_arena'
                  ? '#a855f7'
                  : '#f59e0b';
              return (
                <g
                  key={lm.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedLandmark(lm)}
                >
                  <circle
                    cx={toMapX(lm.x)}
                    cy={toMapY(lm.z)}
                    r={selectedLandmark?.id === lm.id ? 9 : 6}
                    fill={color}
                    stroke={discovered ? '#ffffff' : '#44403c'}
                    strokeWidth="2"
                  />
                </g>
              );
            })}

            {/* GPS Target Marker */}
            {hud.gpsTarget && (
              <circle
                cx={toMapX(hud.gpsTarget.x)}
                cy={toMapY(hud.gpsTarget.z)}
                r="10"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="3"
              />
            )}

            {/* Player Indicator */}
            <circle
              cx={toMapX(hud.playerX)}
              cy={toMapY(hud.playerZ)}
              r="7"
              fill="#facc15"
              stroke="#09090b"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Right: Region Fast Travel & Landmark Details */}
        <div className="w-full md:w-80 p-5 flex flex-col gap-4 overflow-y-auto border-t md:border-t-0 md:border-l border-stone-800">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-stone-50">Nepal World Map</h2>
            <button
              type="button"
              aria-label="Close Map"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-stone-400">
            Discovered {save.discoveredLandmarkIds.length} / {LANDMARKS.length} landmarks
          </div>

          {selectedLandmark && (
            <div className="p-3 rounded-lg bg-stone-800/80 border border-stone-700 flex flex-col gap-2">
              <div className="text-sm font-semibold text-stone-100">{selectedLandmark.name}</div>
              <div className="text-xs text-stone-400 capitalize">
                {selectedLandmark.kind.replace('_', ' ')} · {selectedLandmark.region.replace('_', ' ')}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSetGps({
                    x: selectedLandmark.x,
                    z: selectedLandmark.z,
                    label: selectedLandmark.name,
                  });
                  onClose();
                }}
                className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                Set GPS Marker
              </button>
            </div>
          )}

          {hud.gpsTarget && (
            <button
              type="button"
              onClick={() => onSetGps(null)}
              className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 cursor-pointer"
            >
              Clear GPS ({hud.gpsTarget.label})
            </button>
          )}

          <div>
            <div className="text-xs font-semibold text-stone-300 uppercase tracking-wider mb-2">
              Regions & Fast Travel
            </div>
            <div className="flex flex-col gap-2">
              {REGIONS.map((region) => (
                <div
                  key={region.id}
                  className="p-2.5 rounded-lg bg-stone-950/80 border border-stone-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-medium text-stone-100">{region.name}</div>
                    <div className="text-xs text-stone-400">{region.elevationLabel}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onTeleportRegion(region.id);
                      onClose();
                    }}
                    className="px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold cursor-pointer shrink-0"
                  >
                    Ride Here
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
