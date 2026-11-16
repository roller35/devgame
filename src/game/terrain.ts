import { RegionId, RoadSurface } from './types';

export interface RoadNode {
  x: number;
  z: number;
  y: number;
}

export interface RoadPolyline {
  id: string;
  surface: RoadSurface;
  width: number;
  closed: boolean;
  nodes: RoadNode[];
}

export interface RoadSample {
  dist: number;
  surface: RoadSurface;
  roadY: number;
  width: number;
  onRoad: boolean;
  tangentX: number;
  tangentZ: number;
  nearestX: number;
  nearestZ: number;
}

export interface StuntRampDef {
  id: string;
  x: number;
  z: number;
  heading: number; // direction ramp climbs toward (radians, 0 = -Z)
  width: number;
  length: number;
  height: number;
}

export const WORLD_HALF_EXTENT = 540;
export const PHEWA_LAKE_CENTER = { x: -325, z: 22 };
export const PHEWA_LAKE_RADIUS = 88;
export const PHEWA_WATER_Y = 2.0;

export const STUNT_RAMPS: StuntRampDef[] = [
  { id: 'terai_ramp_1', x: -85, z: 315, heading: Math.PI / 2, width: 9, length: 16, height: 3.6 },
  { id: 'terai_ramp_2', x: -125, z: 315, heading: -Math.PI / 2, width: 9, length: 16, height: 3.8 },
  { id: 'ktm_ring_ramp', x: 52, z: -62, heading: 0.7, width: 7.5, length: 13, height: 2.6 },
  { id: 'pokhara_shore_ramp', x: -235, z: -18, heading: 0, width: 7, length: 12, height: 2.5 },
];

// Elevation helper for natural Nepal topography outside road corridors
function baseNaturalTerrainY(x: number, z: number): number {
  // Gentle multi-octave sine hills + regional macro elevation
  const micro =
    Math.sin(x * 0.018) * Math.cos(z * 0.018) * 2.4 +
    Math.sin(x * 0.043 + 1.2) * Math.sin(z * 0.039 - 0.7) * 1.1;

  // Kathmandu valley bowl around (0, 20) — wide flat basin for dense urban blocks before climbing foothills
  const ktmDist = Math.hypot(x - 0, z - 20);
  const ktmFlat = 1 - smoothstep(106, 168, ktmDist);

  // Pokhara lake basin around (-315, 22)
  const lakeDist = Math.hypot(x - PHEWA_LAKE_CENTER.x, z - PHEWA_LAKE_CENTER.z);
  const lakeBasin = lakeDist < PHEWA_LAKE_RADIUS + 28
    ? Math.max(0, 1 - Math.max(0, lakeDist - PHEWA_LAKE_RADIUS * 0.55) / (PHEWA_LAKE_RADIUS * 0.6))
    : 0;

  // Sarangkot ridge north of Pokhara (-260, -155)
  const sarangkotDist = Math.hypot(x + 265, z + 165);
  const sarangkotPeak = Math.exp(-(sarangkotDist * sarangkotDist) / (2 * 85 * 85)) * 38;

  // Terai southern plains (z > 190) -> very flat ~0.6m
  const teraiBlend = smoothstep(160, 240, z);

  // Hill village eastern terraced mountains (x > 160)
  const hillBlend = smoothstep(125, 230, x) * (1 - smoothstep(160, 280, z));
  const hillTerraces =
    hillBlend * (22 + Math.floor((Math.sin(x * 0.03) + Math.cos(z * 0.03) + 2) * 3.5) * 1.8);

  // Himalayan ascent north of z < -110
  const himaNorth = smoothstep(-95, -420, z);
  const himaRidge =
    himaNorth * 52 +
    smoothstep(-210, -480, z) *
      (Math.pow(1 - Math.abs(Math.sin(x * 0.016 + 0.3) * Math.cos(z * 0.017 - 0.2)), 1.5) * 34);

  // Outer perimeter mountain rim (natural boundary instead of box walls)
  const edgeDist = Math.max(Math.abs(x), Math.abs(z));
  const perimeterRim =
    smoothstep(430, 560, edgeDist) * (48 + Math.abs(Math.sin(x * 0.03) + Math.cos(z * 0.03)) * 28);

  let y = 6.0 + micro;
  y = y * (1 - ktmFlat) + 6.0 * ktmFlat;
  y = y * (1 - teraiBlend) + (0.6 + micro * 0.12) * teraiBlend;
  y += hillTerraces + sarangkotPeak + himaRidge + perimeterRim;

  if (lakeBasin > 0) {
    y = y * (1 - lakeBasin) + (-1.2) * lakeBasin;
  }

  return y;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Build Ring Road nodes around Kathmandu (0, 20)
const ringRoadNodes: RoadNode[] = [];
const RING_SEGMENTS = 24;
for (let i = 0; i < RING_SEGMENTS; i++) {
  const a = (i / RING_SEGMENTS) * Math.PI * 2;
  // Gently widen only the NW arc around Swayambhu Hill (-55, -35) while keeping all cardinal highway junctions at r=86
  const nwBulge =
    Math.cos(a) < 0 && Math.sin(a) < 0
      ? 20 * Math.pow(Math.sin(2 * a), 2)
      : 0;
  const r = 86 + nwBulge;
  ringRoadNodes.push({
    x: Math.cos(a) * r,
    z: 20 + Math.sin(a) * r,
    y: 6.0,
  });
}

// Build Baneshwor roundabout nodes around (52, 20)
const baneshworRoundaboutNodes: RoadNode[] = [];
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  baneshworRoundaboutNodes.push({
    x: 52 + Math.cos(a) * 8.5,
    z: 20 + Math.sin(a) * 8.5,
    y: 6.0,
  });
}

export const ROAD_NETWORK: RoadPolyline[] = [
  {
    id: 'ktm_ring_road',
    surface: 'asphalt',
    width: 12.0,
    closed: true,
    nodes: ringRoadNodes,
  },
  {
    id: 'ktm_durbar_ns',
    surface: 'asphalt',
    width: 11.2,
    closed: false,
    nodes: [
      { x: 0, z: 106, y: 6.0 },
      { x: 0, z: 20, y: 6.0 },
      { x: 0, z: -66, y: 6.0 },
    ],
  },
  {
    id: 'ktm_ew_ave',
    surface: 'asphalt',
    width: 10.6,
    closed: false,
    nodes: [
      { x: -86, z: 20, y: 6.0 },
      { x: 0, z: 20, y: 6.0 },
      { x: 86, z: 20, y: 6.0 },
    ],
  },
  {
    id: 'ktm_thamel_loop',
    surface: 'asphalt',
    width: 7.8,
    closed: false,
    nodes: [
      { x: -52, z: 20, y: 6.0 },
      { x: -52, z: -10, y: 6.0 },
      { x: -31, z: -14, y: 6.0 },
      { x: -31, z: -34, y: 6.0 },
      { x: 0, z: -34, y: 6.0 },
    ],
  },
  {
    id: 'ktm_thamel_west_link',
    surface: 'asphalt',
    width: 7.6,
    closed: false,
    nodes: [
      { x: -52, z: -10, y: 6.0 },
      { x: -90.5, z: -10, y: 6.0 },
    ],
  },
  {
    id: 'ktm_thamel_alley',
    surface: 'gravel',
    width: 5.6,
    closed: false,
    nodes: [
      { x: -31, z: 20, y: 6.0 },
      { x: -31, z: -14, y: 6.0 },
    ],
  },
  {
    id: 'ktm_lazimpat_ave',
    surface: 'asphalt',
    width: 8.0,
    closed: false,
    nodes: [
      { x: -31, z: -34, y: 6.0 },
      { x: -31, z: -56, y: 6.0 },
      { x: 0, z: -56, y: 6.0 },
      { x: 29, z: -56, y: 6.0 },
      { x: 29, z: -24, y: 6.0 },
    ],
  },
  {
    id: 'ktm_baneshwor_loop',
    surface: 'asphalt',
    width: 8.8,
    closed: false,
    nodes: [
      { x: 24, z: 20, y: 6.0 },
      { x: 24, z: 54, y: 6.0 },
      { x: 54, z: 56, y: 6.0 },
      { x: 70, z: 42, y: 6.0 },
      { x: 52, z: 20, y: 6.0 },
    ],
  },
  {
    id: 'ktm_tinkune_link',
    surface: 'asphalt',
    width: 8.2,
    closed: false,
    nodes: [
      { x: 54, z: 56, y: 6.0 },
      { x: 78.1, z: 56, y: 6.0 },
    ],
  },
  {
    id: 'ktm_baneshwor_roundabout',
    surface: 'asphalt',
    width: 6.4,
    closed: true,
    nodes: baneshworRoundaboutNodes,
  },
  {
    id: 'ktm_patan_street',
    surface: 'asphalt',
    width: 7.8,
    closed: false,
    nodes: [
      { x: -24, z: 20, y: 6.0 },
      { x: -24, z: 62, y: 6.0 },
      { x: -56, z: 62, y: 6.0 },
      { x: -68, z: 44, y: 6.0 },
      { x: -68, z: 20, y: 6.0 },
    ],
  },
  {
    id: 'ktm_kupondole_ave',
    surface: 'asphalt',
    width: 7.8,
    closed: false,
    nodes: [
      { x: -24, z: 62, y: 6.0 },
      { x: -24, z: 78, y: 6.0 },
      { x: 0, z: 78, y: 6.0 },
      { x: 24, z: 78, y: 6.0 },
      { x: 24, z: 54, y: 6.0 },
    ],
  },
  {
    id: 'ktm_bhaktapur_lane',
    surface: 'asphalt',
    width: 7.8,
    closed: false,
    nodes: [
      { x: 29, z: 20, y: 6.0 },
      { x: 29, z: -24, y: 6.0 },
      { x: 56, z: -24, y: 6.0 },
      { x: 64, z: -10, y: 6.0 },
      { x: 56, z: 3, y: 6.0 },
      { x: 29, z: 3, y: 6.0 },
    ],
  },
  {
    id: 'ktm_bhaktapur_east_link',
    surface: 'asphalt',
    width: 7.6,
    closed: false,
    nodes: [
      { x: 56, z: -24, y: 6.0 },
      { x: 73.9, z: -24, y: 6.0 },
    ],
  },
  {
    id: 'prithvi_pokhara_hwy',
    surface: 'asphalt',
    width: 10.0,
    closed: false,
    nodes: [
      { x: -86, z: 20, y: 6.0 },
      { x: -135, z: 15, y: 5.2 },
      { x: -185, z: 18, y: 4.2 },
      { x: -232, z: 28, y: 3.4 },
      { x: -228, z: -20, y: 3.6 },
      { x: -232, z: -65, y: 8.5 },
      { x: -258, z: -102, y: 18.5 },
      { x: -228, z: -130, y: 29.0 },
      { x: -260, z: -155, y: 39.5 },
    ],
  },
  {
    id: 'pokhara_lakeside_loop',
    surface: 'asphalt',
    width: 9.0,
    closed: false,
    nodes: [
      { x: -232, z: 28, y: 3.4 },
      { x: -245, z: 75, y: 3.4 },
      { x: -305, z: 118, y: 3.8 },
      { x: -385, z: 105, y: 4.4 },
    ],
  },
  {
    id: 'terai_mugling_hwy',
    surface: 'asphalt',
    width: 11.0,
    closed: false,
    nodes: [
      { x: 0, z: 106, y: 6.0 },
      { x: 0, z: 165, y: 4.0 },
      { x: 12, z: 220, y: 1.4 },
      { x: 18, z: 278, y: 0.8 },
    ],
  },
  {
    id: 'terai_east_west_hwy',
    surface: 'asphalt',
    width: 12.0,
    closed: false,
    nodes: [
      { x: -230, z: 278, y: 0.8 },
      { x: -95, z: 278, y: 0.8 },
      { x: 18, z: 278, y: 0.8 },
      { x: 165, z: 278, y: 0.8 },
      { x: 280, z: 268, y: 1.2 },
    ],
  },
  {
    id: 'terai_stunt_strip',
    surface: 'asphalt',
    width: 18.0,
    closed: false,
    nodes: [
      { x: -95, z: 278, y: 0.8 },
      { x: -95, z: 315, y: 0.8 },
      { x: -165, z: 315, y: 0.8 },
      { x: -35, z: 315, y: 0.8 },
    ],
  },
  {
    id: 'terai_pokhara_link',
    surface: 'gravel',
    width: 8.5,
    closed: false,
    nodes: [
      { x: -230, z: 278, y: 0.8 },
      { x: -245, z: 185, y: 2.2 },
      { x: -245, z: 75, y: 3.4 },
    ],
  },
  {
    id: 'hill_village_hwy',
    surface: 'asphalt',
    width: 9.0,
    closed: false,
    nodes: [
      { x: 86, z: 20, y: 6.0 },
      { x: 135, z: 4, y: 10.5 },
      { x: 175, z: -20, y: 16.0 },
      { x: 192, z: -28, y: 18.5 },
    ],
  },
  {
    id: 'hill_suspension_bridge',
    surface: 'bridge',
    width: 7.5,
    closed: false,
    nodes: [
      { x: 192, z: -28, y: 18.5 },
      { x: 222, z: -33, y: 19.2 },
    ],
  },
  {
    id: 'hill_terrace_trail',
    surface: 'dirt',
    width: 8.0,
    closed: false,
    nodes: [
      { x: 222, z: -33, y: 19.2 },
      { x: 258, z: -40, y: 22.0 },
      { x: 295, z: -55, y: 26.5 },
      { x: 325, z: -110, y: 24.0 },
      { x: 270, z: -145, y: 22.0 },
    ],
  },
  {
    id: 'himalayan_pass_hwy',
    surface: 'asphalt',
    width: 9.5,
    closed: false,
    nodes: [
      { x: 0, z: -66, y: 6.0 },
      { x: 0, z: -120, y: 9.0 },
      { x: 22, z: -175, y: 16.5 },
      { x: -24, z: -230, y: 26.5 },
      { x: 0, z: -290, y: 38.0 },
      { x: 28, z: -340, y: 49.5 },
      { x: -18, z: -375, y: 58.0 },
      { x: 18, z: -395, y: 63.0 },
    ],
  },
  {
    id: 'sarangkot_himalaya_trail',
    surface: 'gravel',
    width: 8.0,
    closed: false,
    nodes: [
      { x: -260, z: -155, y: 39.5 },
      { x: -190, z: -205, y: 36.0 },
      { x: -105, z: -250, y: 35.0 },
      { x: 0, z: -290, y: 38.0 },
    ],
  },
];

export function getRoadSample(x: number, z: number): RoadSample {
  let bestDist = Infinity;
  let bestSurface: RoadSurface = 'grass';
  let bestRoadY = 0;
  let bestWidth = 0;
  let bestTx = 0;
  let bestTz = -1;
  let bestNx = x;
  let bestNz = z;

  for (let r = 0; r < ROAD_NETWORK.length; r++) {
    const road = ROAD_NETWORK[r];
    const nodes = road.nodes;
    const segCount = road.closed ? nodes.length : nodes.length - 1;

    for (let i = 0; i < segCount; i++) {
      const a = nodes[i];
      const b = nodes[(i + 1) % nodes.length];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const abLenSq = abx * abx + abz * abz;
      if (abLenSq < 1e-6) continue;

      let t = ((x - a.x) * abx + (z - a.z) * abz) / abLenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;

      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const dx = x - px;
      const dz = z - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < bestDist) {
        bestDist = dist;
        bestSurface = road.surface;
        bestRoadY = a.y + (b.y - a.y) * t;
        bestWidth = road.width;
        const invLen = 1 / Math.sqrt(abLenSq);
        bestTx = abx * invLen;
        bestTz = abz * invLen;
        bestNx = px;
        bestNz = pz;
      }
    }
  }

  return {
    dist: bestDist,
    surface: bestDist <= bestWidth * 0.56 ? bestSurface : 'grass',
    roadY: bestRoadY,
    width: bestWidth,
    onRoad: bestDist <= bestWidth * 0.54,
    tangentX: bestTx,
    tangentZ: bestTz,
    nearestX: bestNx,
    nearestZ: bestNz,
  };
}

export function getRampHeightAt(x: number, z: number): number {
  let extra = 0;
  for (let i = 0; i < STUNT_RAMPS.length; i++) {
    const ramp = STUNT_RAMPS[i];
    const dx = x - ramp.x;
    const dz = z - ramp.z;
    // Transform into ramp local space: forward is (-sin(heading), -cos(heading))
    const sinH = Math.sin(ramp.heading);
    const cosH = Math.cos(ramp.heading);
    const forward = dx * -sinH + dz * -cosH;
    const right = dx * cosH + dz * -sinH;

    const halfL = ramp.length * 0.5;
    const halfW = ramp.width * 0.5;
    if (Math.abs(right) <= halfW && forward >= -halfL && forward <= halfL) {
      const progress = (forward + halfL) / ramp.length; // 0 -> 1
      const rampH = progress * progress * ramp.height;
      if (rampH > extra) extra = rampH;
    }
  }
  return extra;
}

export function getTerrainHeight(x: number, z: number): number {
  const natural = baseNaturalTerrainY(x, z);
  const road = getRoadSample(x, z);

  // Carve gorge beneath suspension bridge so bridge spans a visible river valley
  const gorgeDist = Math.abs(x - 207);
  let y = natural;
  if (gorgeDist < 16 && z > -95 && z < 35) {
    const gFactor = smoothstep(16, 4, gorgeDist);
    y = y * (1 - gFactor) + 4.5 * gFactor;
  }

  // Blend terrain smoothly to road height along road shoulder
  const halfW = road.width * 0.5;
  const shoulder = halfW + 10.0;
  if (road.surface === 'bridge') {
    // Only the bridge deck itself sits at roadY; terrain underneath stays in gorge
    if (road.dist <= halfW + 0.4) {
      return road.roadY;
    }
    return y;
  }

  if (road.dist < shoulder) {
    const blend = 1 - smoothstep(halfW + 0.5, shoulder, road.dist);
    y = y * (1 - blend) + road.roadY * blend;
  }

  const rampExtra = getRampHeightAt(x, z);
  return y + rampExtra;
}

export function getGroundNormal(x: number, z: number): { nx: number; ny: number; nz: number } {
  const eps = 0.6;
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  const nx = hL - hR;
  const ny = 2 * eps;
  const nz = hD - hU;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return { nx: nx / len, ny: ny / len, nz: nz / len };
}

export function getRegionAt(x: number, z: number): RegionId {
  if (z < -155) return 'himalaya';
  if (z > 185) return 'terai';
  if (x < -140) return 'pokhara';
  if (x > 135) return 'hill_village';
  return 'kathmandu';
}
