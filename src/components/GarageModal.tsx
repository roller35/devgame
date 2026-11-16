import React from 'react';
import { X } from 'lucide-react';
import { MOTORCYCLES, PAINT_SWATCHES } from '../game/catalog';
import { BikeCustomization, SaveData } from '../game/types';

interface GarageModalProps {
  save: SaveData;
  onSelectBike: (id: string) => void;
  onBuyBike: (id: string) => void;
  onUpdateCustomization: (id: string, patch: Partial<BikeCustomization>) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  save,
  onSelectBike,
  onBuyBike,
  onUpdateCustomization,
  onClose,
}) => {
  const activeBike = MOTORCYCLES.find((b) => b.id === save.selectedBikeId) ?? MOTORCYCLES[0];
  const cust = save.customizations[activeBike.id];

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex justify-between p-3 sm:p-4 md:p-6">
      {/* Left: Bike Roster */}
      <div className="w-80 bg-stone-950/92 border border-stone-700/80 rounded-xl p-4 flex flex-col gap-3 pointer-events-auto max-h-full overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-50">Nepal Moto Garage</h2>
            <p className="text-xs text-amber-400 font-telemetry">
              Balance: NPR {save.moneyNpr.toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Garage"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {MOTORCYCLES.map((bike) => {
            const owned = save.ownedBikeIds.includes(bike.id);
            const selected = save.selectedBikeId === bike.id;
            return (
              <div
                key={bike.id}
                className={`p-3 rounded-lg border transition-colors ${
                  selected
                    ? 'bg-stone-800/95 border-amber-500'
                    : 'bg-stone-900/90 border-stone-800 hover:border-stone-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm text-stone-100">{bike.name}</div>
                    <div className="text-xs text-stone-400">
                      {bike.displacementCc}cc · {bike.topSpeedKmh} km/h · {bike.category}
                    </div>
                  </div>
                  {owned ? (
                    <button
                      type="button"
                      onClick={() => onSelectBike(bike.id)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                        selected
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-700 hover:bg-stone-600 text-stone-100'
                      }`}
                    >
                      {selected ? 'Active' : 'Select'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onBuyBike(bike.id)}
                      disabled={save.moneyNpr < bike.priceNpr}
                      className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-800 disabled:text-stone-500 text-white cursor-pointer"
                    >
                      NPR {bike.priceNpr.toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Live 3D Customization Panel (center left clear for 3D bike turntable!) */}
      <div className="w-80 bg-stone-950/92 border border-stone-700/80 rounded-xl p-4 flex flex-col gap-4 pointer-events-auto max-h-full overflow-y-auto shadow-2xl">
        <div>
          <h3 className="font-display text-lg font-bold text-stone-50">{activeBike.name}</h3>
          <p className="text-xs text-stone-400">{activeBike.subtitle}</p>
        </div>

        {/* Performance Specs */}
        <div className="grid grid-cols-2 gap-2 text-xs font-telemetry bg-stone-900/90 p-2.5 rounded-lg border border-stone-800">
          <div>Top Speed: {activeBike.topSpeedKmh} km/h</div>
          <div>Gears: {activeBike.gears} Speed</div>
          <div>Off-Road Grip: {Math.round(activeBike.offroadGrip * 100)}%</div>
          <div>Mass: {activeBike.massKg} kg</div>
        </div>

        {/* Paint Swatches */}
        <div>
          <div className="text-xs font-medium text-stone-300 mb-2">Tank & Fairing Paint</div>
          <div className="flex flex-wrap gap-2">
            {PAINT_SWATCHES.map((sw) => (
              <button
                key={sw.hex}
                type="button"
                aria-label={`Paint ${sw.name}`}
                title={sw.name}
                onClick={() => onUpdateCustomization(activeBike.id, { paintColor: sw.hex })}
                className={`w-7 h-7 rounded-md border-2 cursor-pointer ${
                  cust.paintColor === sw.hex ? 'border-amber-400 scale-110' : 'border-stone-700'
                }`}
                style={{ backgroundColor: sw.hex }}
              />
            ))}
          </div>
        </div>

        {/* Wheel Finish */}
        <div>
          <div className="text-xs font-medium text-stone-300 mb-2">Wheel Rim Finish</div>
          <div className="grid grid-cols-4 gap-1.5">
            {(['alloy', 'black', 'gold', 'chrome'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onUpdateCustomization(activeBike.id, { wheelFinish: w })}
                className={`py-1.5 rounded text-xs capitalize cursor-pointer border ${
                  cust.wheelFinish === w
                    ? 'bg-amber-500 text-stone-950 border-amber-400 font-semibold'
                    : 'bg-stone-900 text-stone-300 border-stone-700 hover:bg-stone-800'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Exhaust Style */}
        <div>
          <div className="text-xs font-medium text-stone-300 mb-2">Exhaust Finish</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['stock', 'carbon', 'chrome'] as const).map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onUpdateCustomization(activeBike.id, { exhaustStyle: ex })}
                className={`py-1.5 rounded text-xs capitalize cursor-pointer border ${
                  cust.exhaustStyle === ex
                    ? 'bg-amber-500 text-stone-950 border-amber-400 font-semibold'
                    : 'bg-stone-900 text-stone-300 border-stone-700 hover:bg-stone-800'
                }`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Headlight Tint */}
        <div>
          <div className="text-xs font-medium text-stone-300 mb-2">Headlight Beam</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['warm', 'xenon', 'amber'] as const).map((hl) => (
              <button
                key={hl}
                type="button"
                onClick={() => onUpdateCustomization(activeBike.id, { headlightTint: hl })}
                className={`py-1.5 rounded text-xs capitalize cursor-pointer border ${
                  cust.headlightTint === hl
                    ? 'bg-amber-500 text-stone-950 border-amber-400 font-semibold'
                    : 'bg-stone-900 text-stone-300 border-stone-700 hover:bg-stone-800'
                }`}
              >
                {hl}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Nepali License Plate */}
        <div>
          <label htmlFor="plate-input" className="block text-xs font-medium text-stone-300 mb-1.5">
            Nepali Number Plate
          </label>
          <input
            id="plate-input"
            type="text"
            maxLength={15}
            value={cust.plateText}
            onChange={(e) =>
              onUpdateCustomization(activeBike.id, { plateText: e.target.value.toUpperCase() })
            }
            className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-700 text-stone-100 font-telemetry text-sm uppercase focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-auto w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-sm cursor-pointer"
        >
          Ride Out
        </button>
      </div>
    </div>
  );
};
