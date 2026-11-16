import React from 'react';

interface TitleOverlayProps {
  moneyNpr: number;
  selectedBikeName: string;
  onStartFreeRoam: () => void;
  onOpenGarage: () => void;
  onOpenMissions: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  moneyNpr,
  selectedBikeName,
  onStartFreeRoam,
  onOpenGarage,
  onOpenMissions,
}) => {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6 md:p-10">
      {/* Subtle top-left scrim over sky negative space so typography is always razor-sharp */}
      <div className="max-w-lg pointer-events-auto bg-stone-950/80 border border-stone-700/60 rounded-xl p-5 sm:p-6 md:p-8 shadow-2xl">
        {/* Bespoke inline SVG Title Emblem */}
        <div className="flex items-center gap-4 mb-4">
          <svg
            viewBox="0 0 84 64"
            className="w-16 h-12 shrink-0"
            aria-hidden="true"
          >
            {/* Himalayan mountain silhouette */}
            <path
              d="M4 44 L24 14 L38 30 L54 8 L80 44 Z"
              fill="#1c1917"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M24 14 L30 22 L24 20 L19 23 Z M54 8 L63 21 L54 18 L46 22 Z"
              fill="#f8fafc"
            />
            {/* Motorcycle wheel & road streak */}
            <circle cx="24" cy="48" r="10" fill="none" stroke="#dc2626" strokeWidth="3.5" />
            <circle cx="60" cy="48" r="10" fill="none" stroke="#dc2626" strokeWidth="3.5" />
            <path
              d="M24 48 L39 36 L52 36 L60 48 M39 36 L34 29 L42 29"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-stone-50 leading-none">
              NEPAL RIDER 3D
            </h1>
            <p className="text-xs md:text-sm text-amber-400 font-medium mt-1.5">
              Kathmandu · Pokhara · Terai · Himalayas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-stone-300 mb-6 font-telemetry">
          <span>{selectedBikeName}</span>
          <span aria-hidden="true">·</span>
          <span>NPR {moneyNpr.toLocaleString()}</span>
        </div>

        {/* <= 3 Primary Menu Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStartFreeRoam}
            className="px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer whitespace-nowrap"
          >
            Start Free Roam
          </button>
          <button
            type="button"
            onClick={onOpenGarage}
            className="px-5 py-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 font-medium text-sm border border-stone-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            Garage
          </button>
          <button
            type="button"
            onClick={onOpenMissions}
            className="px-5 py-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 font-medium text-sm border border-stone-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            Missions
          </button>
        </div>
      </div>

      {/* Flat borderless control hint in bottom safe margin */}
      <div className="text-center md:text-left">
        <p className="inline-block px-3 py-1.5 rounded-md bg-stone-950/75 text-xs text-stone-200 tracking-wide hud-text-shadow">
          WASD / Arrows Drive · Space Rear Brake · Shift Wheelie · C Camera · E Dismount · Tab Map · / Sandbox · Esc Pause
        </p>
      </div>
    </div>
  );
};
