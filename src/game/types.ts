export type GameScreenState =
  | 'title'
  | 'playing'
  | 'paused'
  | 'garage'
  | 'map'
  | 'missions'
  | 'gameover';

export type RegionId =
  | 'kathmandu'
  | 'pokhara'
  | 'terai'
  | 'hill_village'
  | 'himalaya';

export type RoadSurface = 'asphalt' | 'gravel' | 'dirt' | 'bridge' | 'grass';

export type HandlingMode = 'arcade' | 'simulation';

export type CameraMode = 'third_person' | 'first_person';

export type WeatherMode = 'sunny' | 'cloudy' | 'rain' | 'mist';

export type TimeOfDay = 'sunrise' | 'morning' | 'afternoon' | 'sunset' | 'night';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type TrafficDensity = 'low' | 'medium' | 'high';

export type BikeCategory =
  | 'adventure'
  | 'commuter'
  | 'dirt'
  | 'sport'
  | 'classic'
  | 'scooter';

export interface MotorcycleSpecs {
  id: string;
  name: string;
  subtitle: string;
  category: BikeCategory;
  priceNpr: number;
  displacementCc: number;
  topSpeedKmh: number;
  maxPower: number; // acceleration force factor
  torqueLow: number;
  massKg: number;
  gears: number;
  maxRpm: number;
  idleRpm: number;
  steeringResponse: number;
  brakePower: number;
  offroadGrip: number; // 0.4 - 1.0
  suspensionTravel: number;
  wheelieEase: number;
  defaultColor: string;
  exhaustTone: 'thumper' | 'commuter' | 'dirt_2t' | 'inline4' | 'cruiser' | 'scooter';
  fuelCapacityL: number;
}

export interface BikeCustomization {
  paintColor: string;
  wheelFinish: 'alloy' | 'black' | 'gold' | 'chrome';
  exhaustStyle: 'stock' | 'carbon' | 'chrome';
  headlightTint: 'warm' | 'xenon' | 'amber';
  plateText: string;
}

export interface RegionInfo {
  id: RegionId;
  name: string;
  elevationLabel: string;
  description: string;
  spawnPos: { x: number; z: number; heading: number };
  mapBounds: { x: number; z: number; radius: number };
}

export interface LandmarkDef {
  id: string;
  name: string;
  region: RegionId;
  kind: 'garage' | 'petrol' | 'viewpoint' | 'stunt_arena' | 'monument';
  x: number;
  z: number;
  radius: number;
}

export interface MissionCheckpoint {
  x: number;
  z: number;
  radius: number;
  label?: string;
}

export interface MissionDef {
  id: string;
  title: string;
  category: 'delivery' | 'time_trial' | 'hill_climb' | 'stunt' | 'exploration';
  region: RegionId;
  description: string;
  rewardNpr: number;
  timeLimitSec: number | null;
  targetStuntPoints?: number;
  startPos: { x: number; z: number; heading: number };
  checkpoints: MissionCheckpoint[];
}

export interface StuntEvent {
  type: 'wheelie' | 'stoppie' | 'airtime';
  label: string;
  points: number;
  timestamp: number;
}

export interface PhysicsInput {
  throttle: number; // 0..1
  brakeFront: number; // 0..1
  brakeRear: number; // 0..1
  steer: number; // -1 (left) .. +1 (right)
  wheeliePull: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
  horn: boolean;
}

export interface BikePhysicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number; // radians, 0 = -Z (North), + = counter-clockwise? Let's standardize: heading 0 = -Z, +heading turns left (CCW) or right? We'll document cleanly!
  speedMs: number;
  leanAngle: number; // radians (+ leans right, - leans left)
  pitchAngle: number; // radians (+ wheelie nose up, - stoppie nose down)
  steerAngle: number; // front fork angle
  gear: number; // 1..N (0 = neutral)
  rpm: number;
  suspensionCompression: number;
  grounded: boolean;
  airTime: number;
  wheelieTime: number;
  stoppieTime: number;
  stuntCombo: number;
  activeStuntLabel: string;
  activeStuntPoints: number;
  fuelL: number;
  damage: number; // 0..100
  surface: RoadSurface;
  wheelRotation: number;
}

export interface RiderState {
  onFoot: boolean;
  x: number;
  y: number;
  z: number;
  heading: number;
  walkSpeed: number;
  walkCycle: number;
}

export interface GameSettings {
  handlingMode: HandlingMode;
  graphicsQuality: GraphicsQuality;
  trafficDensity: TrafficDensity;
  fuelEnabled: boolean;
  touchControlsEnabled: boolean;
  autoGear: boolean;
  muted: boolean;
}

export interface SaveData {
  version: number;
  moneyNpr: number;
  selectedBikeId: string;
  ownedBikeIds: string[];
  customizations: Record<string, BikeCustomization>;
  completedMissionIds: string[];
  bestMissionTimes: Record<string, number>;
  discoveredLandmarkIds: string[];
  totalStuntScore: number;
  totalDistanceKm: number;
  settings: GameSettings;
}

export interface ActiveMissionState {
  missionId: string;
  checkpointIndex: number;
  elapsedSec: number;
  stuntPointsEarned: number;
  status: 'active' | 'completed' | 'failed';
}

export interface HudSnapshot {
  screen: GameScreenState;
  speedKmh: number;
  rpm: number;
  maxRpm: number;
  gear: number;
  fuelPct: number;
  damagePct: number;
  onFoot: boolean;
  nearBike: boolean;
  nearPetrol: boolean;
  nearGarage: boolean;
  regionId: RegionId;
  regionName: string;
  surface: RoadSurface;
  cameraMode: CameraMode;
  headlightsOn: boolean;
  weather: WeatherMode;
  timeOfDay: TimeOfDay;
  moneyNpr: number;
  activeStuntLabel: string;
  activeStuntPoints: number;
  stuntCombo: number;
  lastStuntBanner: string;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  gpsTarget: { x: number; z: number; label: string } | null;
  activeMission: ActiveMissionState | null;
  lastMissionResult: {
    missionTitle: string;
    success: boolean;
    elapsedSec: number;
    rewardNpr: number;
    reason: string;
  } | null;
  toastMessage: string;
}
