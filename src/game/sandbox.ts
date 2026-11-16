import {
  createDefaultCustomization,
  createInitialSaveData,
  DEFAULT_SETTINGS,
  MOTORCYCLES,
  REGIONS,
} from './catalog';
import {
  RegionId,
  SaveData,
  TimeOfDay,
  TrafficDensity,
  WeatherMode,
} from './types';

export const SAVE_STORAGE_KEY = 'nepal_rider_3d_save_v1';

export type SandboxAction =
  | { type: 'help'; message: string }
  | { type: 'spawn_bike'; bikeId: string; message: string }
  | { type: 'weather'; weather: WeatherMode; message: string }
  | { type: 'time'; time: TimeOfDay; message: string }
  | { type: 'teleport'; region: RegionId; message: string }
  | { type: 'repair'; message: string }
  | { type: 'refuel'; message: string }
  | { type: 'reset_bike'; message: string }
  | { type: 'traffic'; density: TrafficDensity; message: string }
  | { type: 'money'; amount: number; message: string }
  | { type: 'error'; message: string };

const HELP_TEXT =
  'Commands: spawn <bike> | weather <sunny|cloudy|rain|mist> | time <sunrise|morning|afternoon|sunset|night> | teleport <kathmandu|pokhara|terai|village|himalaya> | repair | refuel | reset | traffic <low|medium|high> | money <amount>';

export function parseSandboxCommand(
  rawInput: string,
  ownedBikeIds: string[]
): SandboxAction {
  const trimmed = rawInput.trim().toLowerCase();
  if (!trimmed) {
    return { type: 'error', message: 'Enter a command. Type "help" for available commands.' };
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  const arg = parts[1] ?? '';

  switch (cmd) {
    case 'help':
      return { type: 'help', message: HELP_TEXT };

    case 'spawn': {
      if (!arg) {
        return {
          type: 'error',
          message: `Usage: spawn <${MOTORCYCLES.map((b) => b.id.split('_')[0]).join('|')}>`,
        };
      }
      const match = MOTORCYCLES.find(
        (b) => b.id === arg || b.id.startsWith(arg) || b.name.toLowerCase().includes(arg)
      );
      if (!match) {
        return { type: 'error', message: `Unknown motorcycle "${arg}".` };
      }
      if (!ownedBikeIds.includes(match.id)) {
        return {
          type: 'error',
          message: `${match.name} is locked. Purchase it in the Garage first (or use "money 50000").`,
        };
      }
      return { type: 'spawn_bike', bikeId: match.id, message: `Spawned ${match.name}.` };
    }

    case 'weather': {
      const valid: WeatherMode[] = ['sunny', 'cloudy', 'rain', 'mist'];
      if (valid.includes(arg as WeatherMode)) {
        return { type: 'weather', weather: arg as WeatherMode, message: `Weather set to ${arg}.` };
      }
      return { type: 'error', message: 'Usage: weather <sunny|cloudy|rain|mist>' };
    }

    case 'time': {
      const aliases: Record<string, TimeOfDay> = {
        sunrise: 'sunrise',
        morning: 'morning',
        noon: 'afternoon',
        afternoon: 'afternoon',
        day: 'afternoon',
        sunset: 'sunset',
        dusk: 'sunset',
        night: 'night',
      };
      const resolved = aliases[arg];
      if (resolved) {
        return { type: 'time', time: resolved, message: `Time of day set to ${resolved}.` };
      }
      return {
        type: 'error',
        message: 'Usage: time <sunrise|morning|afternoon|sunset|night>',
      };
    }

    case 'teleport':
    case 'tp': {
      const regionAliases: Record<string, RegionId> = {
        kathmandu: 'kathmandu',
        ktm: 'kathmandu',
        pokhara: 'pokhara',
        pkr: 'pokhara',
        terai: 'terai',
        village: 'hill_village',
        hill: 'hill_village',
        hill_village: 'hill_village',
        himalaya: 'himalaya',
        himalayas: 'himalaya',
      };
      const region = regionAliases[arg];
      if (region) {
        const info = REGIONS.find((r) => r.id === region)!;
        return { type: 'teleport', region, message: `Teleported to ${info.name}.` };
      }
      return {
        type: 'error',
        message: 'Usage: teleport <kathmandu|pokhara|terai|village|himalaya>',
      };
    }

    case 'repair':
      return { type: 'repair', message: 'Motorcycle repaired to 100%.' };

    case 'refuel':
      return { type: 'refuel', message: 'Fuel tank filled to 100%.' };

    case 'reset':
      return { type: 'reset_bike', message: 'Motorcycle uprighted on nearest road.' };

    case 'traffic': {
      if (arg === 'low' || arg === 'medium' || arg === 'high') {
        return {
          type: 'traffic',
          density: arg,
          message: `Traffic density set to ${arg}.`,
        };
      }
      return { type: 'error', message: 'Usage: traffic <low|medium|high>' };
    }

    case 'money': {
      const amount = Number(arg);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
        return { type: 'error', message: 'Usage: money <1..1000000>' };
      }
      const rounded = Math.round(amount);
      return { type: 'money', amount: rounded, message: `Added NPR ${rounded.toLocaleString()}.` };
    }

    default:
      return { type: 'error', message: `Unknown command "${cmd}". Type "help" for commands.` };
  }
}

export function migrateSaveData(raw: unknown): SaveData {
  const base = createInitialSaveData();
  if (!raw || typeof raw !== 'object') return base;

  const obj = raw as Partial<SaveData>;
  const validBikeIds = new Set(MOTORCYCLES.map((b) => b.id));

  const owned = Array.isArray(obj.ownedBikeIds)
    ? obj.ownedBikeIds.filter((id): id is string => typeof id === 'string' && validBikeIds.has(id))
    : base.ownedBikeIds;
  if (!owned.includes('himalayan_411')) owned.unshift('himalayan_411');

  const selectedBikeId =
    typeof obj.selectedBikeId === 'string' && owned.includes(obj.selectedBikeId)
      ? obj.selectedBikeId
      : owned[0];

  const customizations = { ...base.customizations };
  if (obj.customizations && typeof obj.customizations === 'object') {
    for (const bike of MOTORCYCLES) {
      const savedCust = obj.customizations[bike.id];
      if (savedCust && typeof savedCust === 'object') {
        customizations[bike.id] = {
          ...createDefaultCustomization(bike),
          ...savedCust,
          plateText:
            typeof savedCust.plateText === 'string' && savedCust.plateText.trim()
              ? savedCust.plateText.slice(0, 16).toUpperCase()
              : 'BA 24 PA 4812',
        };
      }
    }
  }

  const incomingSettings: Partial<SaveData['settings']> =
    obj.settings && typeof obj.settings === 'object' ? obj.settings : {};
  const isV2 = obj.version === 2;

  return {
    version: 2,
    moneyNpr:
      typeof obj.moneyNpr === 'number' && Number.isFinite(obj.moneyNpr) && obj.moneyNpr >= 0
        ? Math.round(obj.moneyNpr)
        : base.moneyNpr,
    selectedBikeId,
    ownedBikeIds: owned,
    customizations,
    completedMissionIds: Array.isArray(obj.completedMissionIds)
      ? obj.completedMissionIds.filter((id): id is string => typeof id === 'string')
      : [],
    bestMissionTimes:
      obj.bestMissionTimes && typeof obj.bestMissionTimes === 'object'
        ? { ...obj.bestMissionTimes }
        : {},
    discoveredLandmarkIds: Array.isArray(obj.discoveredLandmarkIds)
      ? Array.from(new Set([...base.discoveredLandmarkIds, ...obj.discoveredLandmarkIds]))
      : base.discoveredLandmarkIds,
    totalStuntScore:
      typeof obj.totalStuntScore === 'number' && Number.isFinite(obj.totalStuntScore)
        ? obj.totalStuntScore
        : 0,
    totalDistanceKm:
      typeof obj.totalDistanceKm === 'number' && Number.isFinite(obj.totalDistanceKm)
        ? obj.totalDistanceKm
        : 0,
    settings: {
      ...DEFAULT_SETTINGS,
      ...incomingSettings,
      touchControlsEnabled:
        isV2 && typeof incomingSettings.touchControlsEnabled === 'boolean'
          ? incomingSettings.touchControlsEnabled
          : true,
    },
  };
}

export function loadSaveData(): SaveData {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialSaveData();
    }
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return createInitialSaveData();
    return migrateSaveData(JSON.parse(raw));
  } catch {
    return createInitialSaveData();
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota errors
  }
}
