import React from 'react';
import { X } from 'lucide-react';
import { MISSIONS } from '../game/catalog';
import { ActiveMissionState, SaveData } from '../game/types';

interface MissionsModalProps {
  save: SaveData;
  activeMission: ActiveMissionState | null;
  onStartMission: (missionId: string) => void;
  onAbandonMission: () => void;
  onClose: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  save,
  activeMission,
  onStartMission,
  onAbandonMission,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 z-30 bg-stone-950/90 flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-3xl bg-stone-900 border border-stone-700 rounded-xl p-4 sm:p-5 md:p-6 shadow-2xl max-h-[92%] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-stone-50">Nepal Rider Missions</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Completed {save.completedMissionIds.length} / {MISSIONS.length} · Total Stunt Score:{' '}
              <span className="font-telemetry text-amber-400">{save.totalStuntScore.toLocaleString()}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Missions"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {activeMission && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/50 flex items-center justify-between gap-3">
            <span className="text-sm text-amber-200">
              A mission is currently active.
            </span>
            <button
              type="button"
              onClick={onAbandonMission}
              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
            >
              Abandon Active Mission
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          {MISSIONS.map((m) => {
            const done = save.completedMissionIds.includes(m.id);
            const best = save.bestMissionTimes[m.id];
            return (
              <div
                key={m.id}
                className="p-4 rounded-xl bg-stone-950/85 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-stone-100">{m.title}</h3>
                    {done && (
                      <span className="text-xs font-semibold text-emerald-400">Completed</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{m.description}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-telemetry text-stone-300">
                    <span className="capitalize">{m.region.replace('_', ' ')}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400">Reward: NPR {m.rewardNpr.toLocaleString()}</span>
                    {m.timeLimitSec && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Limit: {m.timeLimitSec}s</span>
                      </>
                    )}
                    {best && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400">Best: {best.toFixed(1)}s</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onStartMission(m.id)}
                  className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm cursor-pointer shrink-0"
                >
                  {done ? 'Replay' : 'Start Mission'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
