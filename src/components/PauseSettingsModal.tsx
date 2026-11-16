import React from 'react';
import { createInitialSaveData } from '../game/catalog';
import { GameSettings, HudSnapshot, SaveData, TimeOfDay, WeatherMode } from '../game/types';

interface PauseSettingsModalProps {
  mode: 'paused' | 'gameover';
  hud: HudSnapshot;
  settings: GameSettings;
  onResume: () => void;
  onRestartRoad: () => void;
  onReplayMission: () => void;
  onMainMenu: () => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onSetWeather: (w: WeatherMode) => void;
  onSetTime: (t: TimeOfDay) => void;
  onResetSave: (fresh: SaveData) => void;
}

export const PauseSettingsModal: React.FC<PauseSettingsModalProps> = ({
  mode,
  hud,
  settings,
  onResume,
  onRestartRoad,
  onReplayMission,
  onMainMenu,
  onUpdateSettings,
  onSetWeather,
  onSetTime,
  onResetSave,
}) => {
  if (mode === 'gameover' && hud.lastMissionResult) {
    const res = hud.lastMissionResult;
    return (
      <div className="absolute inset-0 z-30 bg-stone-950/88 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-md max-h-[92%] overflow-y-auto bg-stone-900 border border-stone-700 rounded-xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            {res.success ? 'Mission Complete' : 'Mission Failed'}
          </div>
          <h2 className="font-display text-2xl font-bold text-stone-50">{res.missionTitle}</h2>
          <p className="text-sm text-stone-300">{res.reason}</p>

          <div className="grid grid-cols-2 gap-3 bg-stone-950/80 border border-stone-800 rounded-lg p-3 font-telemetry text-sm">
            <div>
              <div className="text-xs text-stone-400">Clear Time</div>
              <div className="text-stone-100 font-bold">{res.elapsedSec.toFixed(1)}s</div>
            </div>
            <div>
              <div className="text-xs text-stone-400">Reward</div>
              <div className="text-emerald-400 font-bold">NPR {res.rewardNpr.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 mt-2">
            <button
              type="button"
              data-start="true"
              onClick={onReplayMission}
              className="flex-1 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm cursor-pointer"
            >
              Replay Mission
            </button>
            <button
              type="button"
              onClick={onResume}
              className="flex-1 py-2.5 px-4 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-100 text-sm font-medium border border-stone-700 cursor-pointer"
            >
              Free Roam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 bg-stone-950/88 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl bg-stone-900 border border-stone-700 rounded-xl p-4 sm:p-6 shadow-2xl max-h-[92%] overflow-y-auto flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-stone-50">Paused & Settings</h2>
          <button
            type="button"
            onClick={onResume}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm cursor-pointer"
          >
            Resume
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {/* Handling Mode */}
          <div>
            <div className="text-xs text-stone-400 mb-1.5">Physics Handling</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['arcade', 'simulation'] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onUpdateSettings({ handlingMode: h })}
                  className={`py-2 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                    settings.handlingMode === h
                      ? 'bg-amber-500 text-stone-950 border-amber-400'
                      : 'bg-stone-950 text-stone-300 border-stone-800'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Graphics Quality */}
          <div>
            <div className="text-xs text-stone-400 mb-1.5">Graphics Preset</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['low', 'medium', 'high'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onUpdateSettings({ graphicsQuality: g })}
                  className={`py-2 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                    settings.graphicsQuality === g
                      ? 'bg-amber-500 text-stone-950 border-amber-400'
                      : 'bg-stone-950 text-stone-300 border-stone-800'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Traffic Density */}
          <div>
            <div className="text-xs text-stone-400 mb-1.5">Traffic Density</div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['low', 'medium', 'high'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onUpdateSettings({ trafficDensity: d })}
                  className={`py-2 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                    settings.trafficDensity === d
                      ? 'bg-amber-500 text-stone-950 border-amber-400'
                      : 'bg-stone-950 text-stone-300 border-stone-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Time of Day */}
          <div>
            <div className="text-xs text-stone-400 mb-1.5">Time of Day</div>
            <select
              aria-label="Time of Day"
              value={hud.timeOfDay}
              onChange={(e) => onSetTime(e.target.value as TimeOfDay)}
              className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 text-xs capitalize"
            >
              <option value="sunrise">Sunrise</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="sunset">Sunset</option>
              <option value="night">Night</option>
            </select>
          </div>

          {/* Weather */}
          <div>
            <div className="text-xs text-stone-400 mb-1.5">Weather</div>
            <select
              aria-label="Weather"
              value={hud.weather}
              onChange={(e) => onSetWeather(e.target.value as WeatherMode)}
              className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 text-xs capitalize"
            >
              <option value="sunny">Sunny</option>
              <option value="cloudy">Cloudy</option>
              <option value="rain">Monsoon Rain</option>
              <option value="mist">Mountain Mist</option>
            </select>
          </div>

          {/* Gameplay Toggles */}
          <div className="flex flex-col gap-2 justify-end">
            <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
              <span>Fuel Consumption</span>
              <input
                type="checkbox"
                checked={settings.fuelEnabled}
                onChange={(e) => onUpdateSettings({ fuelEnabled: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
              <span>On-Screen Touch Controls</span>
              <input
                type="checkbox"
                checked={settings.touchControlsEnabled}
                onChange={(e) => onUpdateSettings({ touchControlsEnabled: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between text-xs text-stone-200 cursor-pointer">
              <span>Auto Gear Shifting</span>
              <input
                type="checkbox"
                checked={settings.autoGear}
                onChange={(e) => onUpdateSettings({ autoGear: e.target.checked })}
              />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-800">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onRestartRoad();
                onResume();
              }}
              className="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-100 cursor-pointer"
            >
              Reset Bike on Road
            </button>
            <button
              type="button"
              onClick={onMainMenu}
              className="px-3.5 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-100 cursor-pointer"
            >
              Title Screen
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              const fresh = createInitialSaveData();
              onResetSave(fresh);
            }}
            className="px-3 py-2 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-800/70 text-xs text-red-200 cursor-pointer"
          >
            Reset Save Data
          </button>
        </div>
      </div>
    </div>
  );
};
