import * as THREE from 'three';
import { LANDMARKS } from './catalog';
import { getRoadSample, getTerrainHeight, STUNT_RAMPS } from './terrain';
import { ProceduralTextureSet } from './textures';
import { GraphicsQuality } from './types';

export interface KathmanduCityHandles {
  group: THREE.Group;
  update: (elapsed: number, playerX: number, playerZ: number) => void;
  setQuality: (q: GraphicsQuality) => void;
  dispose: () => void;
}

interface PedestrianAgent {
  root: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  speed: number;
  phase: number;
  stationary: boolean;
}

interface BuildingSpec {
  x: number;
  z: number;
  rotY: number;
  kind: 'newari' | 'modern' | 'shop';
  w: number;
  d: number;
  floors: number;
  shopType: number;
  tone: number;
}

const KTM_Y = 6.0;

// Mission & spawn safety exclusion points inside Kathmandu
const PROTECTED_POINTS: Array<{ x: number; z: number; r: number }> = [
  { x: 0, z: 54, r: 9 }, // Player spawn
  { x: 0, z: 18, r: 10 }, // Mission CP 1
  { x: 75, z: 20, r: 10 }, // Mission CP 2
  { x: 0, z: -85, r: 11 }, // Mission CP 3
  { x: -78, z: 20, r: 10 }, // Mission CP 4
  { x: 0, z: 85, r: 10 }, // Mission CP 5
  { x: 52, z: 20, r: 6.5 }, // Baneshwor roundabout center
  ...LANDMARKS.filter((l) => l.region === 'kathmandu').map((l) => ({
    x: l.x,
    z: l.z,
    r: l.kind === 'monument' ? 15 : 11,
  })),
  ...STUNT_RAMPS.filter((r) => Math.hypot(r.x, r.z - 20) < 120).map((r) => ({
    x: r.x,
    z: r.z,
    r: 12,
  })),
];

function isClearSpot(x: number, z: number, radius: number): boolean {
  const road = getRoadSample(x, z);
  if (road.dist < road.width * 0.5 + radius) return false;
  for (let i = 0; i < PROTECTED_POINTS.length; i++) {
    const p = PROTECTED_POINTS[i];
    if (Math.hypot(x - p.x, z - p.z) < p.r + radius * 0.65) return false;
  }
  return true;
}

export function buildKathmanduCity(
  root: THREE.Group,
  textures: ProceduralTextureSet,
  quality: GraphicsQuality,
  prayerFlags: THREE.Mesh[]
): KathmanduCityHandles {
  const group = new THREE.Group();
  root.add(group);

  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };

  // --- Shared PBR Materials (Distinct roughness/metalness contrast) ---
  const brickMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.brickMap,
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.03,
    })
  );
  const plasterCreamMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.plasterFacadeMap,
      color: 0xe6d7bf,
      roughness: 0.84,
      metalness: 0.02,
    })
  );
  const plasterOchreMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.plasterFacadeMap,
      color: 0xe0a26b,
      roughness: 0.86,
      metalness: 0.02,
    })
  );
  const plasterSageMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.plasterFacadeMap,
      color: 0xaec9ba,
      roughness: 0.85,
      metalness: 0.02,
    })
  );
  const modernGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.modernFacadeMap,
      color: 0xdbe3ec,
      roughness: 0.26,
      metalness: 0.4,
      envMapIntensity: 1.1,
    })
  );
  const modernDarkGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.modernFacadeMap,
      color: 0x9bc4de,
      roughness: 0.22,
      metalness: 0.52,
      envMapIntensity: 1.15,
    })
  );
  const carvedWoodMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.72, metalness: 0.05 })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.36, metalness: 0.78 })
  );
  const roofTileMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.roofTileMap,
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.04,
    })
  );
  const stoneMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.88, metalness: 0.03 })
  );
  const plazaStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.sidewalkMap,
      color: 0xbcb8b1,
      roughness: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const sidewalkMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.sidewalkMap,
      color: 0xe5e0d8,
      roughness: 0.88,
    })
  );
  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x828e9e, roughness: 0.84, metalness: 0.05 })
  );
  const whitePalaceMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: 0.72, metalness: 0.04 })
  );
  const goldMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.18, metalness: 0.9 })
  );
  const tankBlackMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.1 })
  );
  const tankBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.38, metalness: 0.1 })
  );
  const awningRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.65 })
  );
  const awningBlueMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.65 })
  );
  const awningGreenMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 })
  );
  const awningAmberMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 })
  );
  const awningMats = [awningRedMat, awningBlueMat, awningGreenMat, awningAmberMat];
  const shutterMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.shutterMap,
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.42,
    })
  );
  const warmWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xd97706,
      emissiveIntensity: 0.28,
      roughness: 0.35,
    })
  );
  const solarPanelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.2, metalness: 0.65 })
  );
  const urbanBaseMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.sidewalkMap,
      color: 0x948e84,
      roughness: 0.92,
      metalness: 0.02,
    })
  );

  // Bilingual Nepali + English Local Business Signs
  const businessSignDefs = [
    { np: 'चिया पसल', en: 'HIMALAYAN TEA SHOP', bg: '#7c2d12', fg: '#fde047' },
    { np: 'मोटरसाइकल वर्कशप', en: 'KATHMANDU MOTO', bg: '#0f172a', fg: '#34d399' },
    { np: 'किराना पसल', en: 'NEWARI GROCERY', bg: '#14532d', fg: '#fef08a' },
    { np: 'भोजनालय · मःम', en: 'MOMO & KITCHEN', bg: '#991b1b', fg: '#fde68a' },
    { np: 'ठमेल ट्रेकिङ', en: 'THAMEL APPAREL', bg: '#1e3a8a', fg: '#f8fafc' },
    { np: 'इलेक्ट्रोनिक्स', en: 'TECH & MOBILE', bg: '#1e293b', fg: '#38bdf8' },
    { np: 'औषधि पसल', en: 'CITY PHARMACY', bg: '#065f46', fg: '#ffffff' },
  ];
  const businessSignMats = businessSignDefs.map((s) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.createSignTexture(s.np, s.en, s.bg, s.fg),
        roughness: 0.38,
        metalness: 0.08,
      })
    )
  );

  // --- Distance-Culled Groups for Mobile/Android Optimization ---
  const detailPropsGroup = new THREE.Group();
  const pedestrianGroup = new THREE.Group();
  group.add(detailPropsGroup);
  group.add(pedestrianGroup);

  // =========================================================================
  // 1. SIDEWALKS, CURBS, ZEBRA CROSSINGS & DRAINAGE
  // =========================================================================
  buildKathmanduStreetSurfaceDetails(
    group,
    detailPropsGroup,
    textures,
    sidewalkMat,
    urbanBaseMat,
    stoneMat,
    darkMetalMat,
    trackGeo,
    trackMat
  );

  // =========================================================================
  // 2. FAMOUS KATHMANDU-INSPIRED HERITAGE & URBAN LANDMARKS
  // =========================================================================
  buildDurbarSquareComplex(
    group,
    brickMat,
    roofTileMat,
    carvedWoodMat,
    stoneMat,
    plazaStoneMat,
    whitePalaceMat,
    goldMat,
    trackGeo
  );

  buildSwayambhuHillComplex(
    group,
    whitePalaceMat,
    goldMat,
    stoneMat,
    brickMat,
    prayerFlags,
    trackGeo
  );

  buildPashupatiAndBagmatiGhats(
    group,
    stoneMat,
    brickMat,
    roofTileMat,
    goldMat,
    carvedWoodMat,
    trackGeo,
    trackMat
  );

  buildPatanHeritageSquare(
    group,
    stoneMat,
    plazaStoneMat,
    brickMat,
    carvedWoodMat,
    roofTileMat,
    goldMat,
    trackGeo
  );

  buildBhaktapurNyatapola(
    group,
    brickMat,
    stoneMat,
    roofTileMat,
    carvedWoodMat,
    goldMat,
    trackGeo
  );

  buildBaneshworRoundaboutAndPark(
    group,
    stoneMat,
    plazaStoneMat,
    goldMat,
    concreteMat,
    darkMetalMat,
    trackGeo,
    trackMat
  );

  // =========================================================================
  // 3. DETAILED 3D KATHMANDU BUILDINGS (NEWARI, MODERN, SHOPS) WITH LOD
  // =========================================================================
  const buildingSpecs: BuildingSpec[] = [
    // --- DURBAR NORTH-SOUTH BOULEVARD (Flanking Spawn Vista & Downtown Core) ---
    { x: -15.5, z: 42, rotY: Math.PI / 2, kind: 'newari', w: 12.5, d: 10.0, floors: 4, shopType: 0, tone: 0 },
    { x: 15.5, z: 43, rotY: -Math.PI / 2, kind: 'shop', w: 12.0, d: 9.8, floors: 4, shopType: 2, tone: 1 },
    { x: -15.5, z: 29, rotY: Math.PI / 2, kind: 'shop', w: 11.5, d: 9.6, floors: 4, shopType: 3, tone: 0 },
    { x: 15.5, z: 30, rotY: -Math.PI / 2, kind: 'newari', w: 12.0, d: 9.8, floors: 5, shopType: 6, tone: 0 },
    { x: -15.5, z: 68, rotY: Math.PI / 2, kind: 'modern', w: 13.5, d: 10.5, floors: 5, shopType: 5, tone: 1 },
    { x: 15.5, z: 54, rotY: -Math.PI / 2, kind: 'modern', w: 11.0, d: 9.2, floors: 5, shopType: 4, tone: 0 },
    { x: -15.5, z: 55, rotY: Math.PI / 2, kind: 'shop', w: 11.5, d: 9.5, floors: 4, shopType: 1, tone: 2 },
    { x: 14.0, z: 91, rotY: -Math.PI / 2, kind: 'modern', w: 13.0, d: 10.2, floors: 5, shopType: 1, tone: 2 },
    { x: -14.0, z: 91, rotY: Math.PI / 2, kind: 'shop', w: 12.8, d: 10.0, floors: 4, shopType: 6, tone: 0 },
    { x: -15.5, z: -45, rotY: Math.PI / 2, kind: 'newari', w: 12.5, d: 9.5, floors: 4, shopType: 0, tone: 0 },
    { x: 15.5, z: -45, rotY: -Math.PI / 2, kind: 'newari', w: 12.5, d: 9.5, floors: 4, shopType: 3, tone: 1 },
    { x: -15.0, z: -67, rotY: Math.PI / 2, kind: 'modern', w: 13.5, d: 10.2, floors: 5, shopType: 4, tone: 0 },
    { x: 15.0, z: -67, rotY: -Math.PI / 2, kind: 'modern', w: 13.5, d: 10.2, floors: 5, shopType: 5, tone: 1 },

    // --- LAZIMPAT & NORTH URBAN CORRIDOR (z: -42..-76) ---
    { x: -30, z: -67, rotY: 0, kind: 'modern', w: 14.0, d: 10.5, floors: 6, shopType: 4, tone: 1 },
    { x: -15, z: -45, rotY: Math.PI, kind: 'shop', w: 11.0, d: 8.8, floors: 4, shopType: 2, tone: 2 },
    { x: 30, z: -67, rotY: 0, kind: 'modern', w: 14.5, d: 10.5, floors: 5, shopType: 6, tone: 0 },
    { x: 43, z: -45, rotY: 0, kind: 'newari', w: 12.0, d: 9.5, floors: 4, shopType: 0, tone: 0 },
    { x: 58, z: -45, rotY: 0, kind: 'shop', w: 12.0, d: 9.5, floors: 4, shopType: 3, tone: 1 },
    { x: 16, z: -44, rotY: Math.PI, kind: 'shop', w: 11.5, d: 9.0, floors: 4, shopType: 4, tone: 0 },

    // --- THAMEL COMMERCIAL & TOURIST QUARTER (NW Quadrant) ---
    { x: -20, z: 9, rotY: 0, kind: 'shop', w: 11.5, d: 9.2, floors: 4, shopType: 4, tone: 0 },
    { x: -41.5, z: 9, rotY: 0, kind: 'newari', w: 12.0, d: 9.2, floors: 5, shopType: 3, tone: 0 },
    { x: -41.5, z: -2, rotY: Math.PI / 2, kind: 'modern', w: 11.5, d: 9.2, floors: 5, shopType: 4, tone: 2 },
    { x: -21, z: -2, rotY: 0, kind: 'shop', w: 11.0, d: 8.8, floors: 4, shopType: 0, tone: 1 },
    { x: -63, z: 8, rotY: Math.PI / 2, kind: 'modern', w: 13.0, d: 10.0, floors: 5, shopType: 5, tone: 0 },
    { x: -63, z: -21, rotY: 0, kind: 'newari', w: 12.0, d: 9.4, floors: 4, shopType: 4, tone: 0 },
    { x: -76, z: 8, rotY: 0, kind: 'shop', w: 11.8, d: 9.2, floors: 4, shopType: 2, tone: 1 },
    { x: -77, z: -21, rotY: 0, kind: 'modern', w: 12.5, d: 9.6, floors: 5, shopType: 6, tone: 3 },
    { x: -42, z: -24, rotY: 0, kind: 'shop', w: 11.5, d: 9.0, floors: 4, shopType: 3, tone: 2 },
    { x: -19, z: -45, rotY: 0, kind: 'newari', w: 11.5, d: 9.0, floors: 4, shopType: 2, tone: 1 },
    { x: -42, z: -45, rotY: 0, kind: 'modern', w: 12.2, d: 9.2, floors: 5, shopType: 4, tone: 0 },

    // --- NEW BANESHWOR & TINKUNE COMMERCIAL TOWER DISTRICT (E/SE Quadrant) ---
    { x: 16, z: 9, rotY: Math.PI, kind: 'modern', w: 12.5, d: 9.5, floors: 6, shopType: 5, tone: 0 },
    { x: 39, z: 10, rotY: Math.PI, kind: 'modern', w: 12.0, d: 9.0, floors: 5, shopType: 6, tone: 1 },
    { x: 66, z: 8, rotY: Math.PI, kind: 'modern', w: 13.5, d: 9.5, floors: 6, shopType: 4, tone: 2 },
    { x: 78, z: 8, rotY: Math.PI, kind: 'modern', w: 13.0, d: 9.5, floors: 6, shopType: 5, tone: 0 },
    { x: 36, z: 34, rotY: 0, kind: 'modern', w: 13.0, d: 10.0, floors: 6, shopType: 5, tone: 1 },
    { x: 50, z: 37, rotY: -Math.PI / 2, kind: 'shop', w: 12.0, d: 9.2, floors: 4, shopType: 1, tone: 0 },
    { x: 52, z: 43, rotY: Math.PI, kind: 'modern', w: 13.0, d: 9.6, floors: 5, shopType: 6, tone: 0 },
    { x: 36, z: 46, rotY: -Math.PI / 2, kind: 'shop', w: 11.8, d: 9.2, floors: 4, shopType: 3, tone: 2 },
    { x: 38, z: 67, rotY: Math.PI, kind: 'modern', w: 14.0, d: 10.2, floors: 6, shopType: 2, tone: 3 },
    { x: 53, z: 68, rotY: Math.PI, kind: 'modern', w: 13.5, d: 10.0, floors: 7, shopType: 5, tone: 1 },
    { x: 68, z: 68, rotY: Math.PI, kind: 'modern', w: 12.5, d: 9.5, floors: 5, shopType: 6, tone: 0 },
    { x: 78, z: 36, rotY: -Math.PI / 2, kind: 'modern', w: 13.0, d: 9.8, floors: 5, shopType: 4, tone: 1 },
    { x: 14, z: 32, rotY: -Math.PI / 2, kind: 'shop', w: 11.5, d: 9.0, floors: 4, shopType: 2, tone: 0 },

    // --- PATAN HERITAGE & KUPONDOLE NEIGHBORHOOD (SW/S Quadrant) ---
    { x: -37, z: 32, rotY: 0, kind: 'newari', w: 12.0, d: 9.5, floors: 4, shopType: 0, tone: 1 },
    { x: -53, z: 32, rotY: 0, kind: 'newari', w: 12.5, d: 9.5, floors: 4, shopType: 2, tone: 0 },
    { x: -37, z: 50, rotY: Math.PI, kind: 'newari', w: 12.0, d: 9.5, floors: 4, shopType: 3, tone: 0 },
    { x: -54, z: 50, rotY: Math.PI, kind: 'shop', w: 12.0, d: 9.5, floors: 4, shopType: 6, tone: 2 },
    { x: -78, z: 33, rotY: Math.PI / 2, kind: 'modern', w: 12.5, d: 9.5, floors: 5, shopType: 5, tone: 0 },
    { x: -78, z: 50, rotY: Math.PI / 2, kind: 'shop', w: 12.0, d: 9.5, floors: 4, shopType: 1, tone: 1 },
    { x: -13, z: 70, rotY: Math.PI / 2, kind: 'newari', w: 11.0, d: 9.0, floors: 4, shopType: 0, tone: 0 },
    { x: -29, z: 90, rotY: Math.PI, kind: 'modern', w: 13.5, d: 10.2, floors: 5, shopType: 2, tone: 2 },
    { x: -46, z: 90, rotY: Math.PI, kind: 'newari', w: 12.5, d: 9.8, floors: 4, shopType: 3, tone: 0 },
    { x: 29, z: 90, rotY: Math.PI, kind: 'modern', w: 13.5, d: 10.2, floors: 5, shopType: 1, tone: 1 },
    { x: 46, z: 90, rotY: Math.PI, kind: 'shop', w: 12.5, d: 9.8, floors: 4, shopType: 4, tone: 0 },

    // --- BHAKTAPUR & EAST HERITAGE DISTRICT (NE Quadrant) ---
    { x: 41, z: -36, rotY: Math.PI, kind: 'newari', w: 11.5, d: 9.0, floors: 4, shopType: 0, tone: 0 },
    { x: 55, z: -36, rotY: Math.PI, kind: 'newari', w: 11.8, d: 9.2, floors: 4, shopType: 3, tone: 0 },
    { x: 42, z: -11, rotY: Math.PI, kind: 'newari', w: 11.5, d: 9.0, floors: 4, shopType: 2, tone: 0 },
    { x: 53, z: -11, rotY: -Math.PI / 2, kind: 'newari', w: 11.5, d: 9.0, floors: 5, shopType: 3, tone: 1 },
    { x: 75, z: -11, rotY: -Math.PI / 2, kind: 'shop', w: 12.0, d: 9.5, floors: 4, shopType: 4, tone: 1 },
    { x: 42, z: -3, rotY: 0, kind: 'newari', w: 11.5, d: 9.0, floors: 4, shopType: 0, tone: 0 },

    // --- OUTER RING ROAD COMMERCIAL BELT (r ~ 96..118m around Kathmandu) ---
    { x: 100, z: 36, rotY: -Math.PI / 2, kind: 'modern', w: 14.5, d: 11.0, floors: 6, shopType: 6, tone: 0 },
    { x: 100, z: 5, rotY: -Math.PI / 2, kind: 'newari', w: 13.0, d: 10.2, floors: 4, shopType: 0, tone: 1 },
    { x: 96, z: -16, rotY: -Math.PI / 2, kind: 'modern', w: 13.5, d: 10.5, floors: 5, shopType: 2, tone: 2 },
    { x: 94, z: 58, rotY: -Math.PI / 2, kind: 'modern', w: 14.0, d: 10.5, floors: 6, shopType: 5, tone: 0 },
    { x: -100, z: 36, rotY: Math.PI / 2, kind: 'modern', w: 14.5, d: 11.0, floors: 5, shopType: 5, tone: 2 },
    { x: -102, z: 2, rotY: Math.PI / 2, kind: 'shop', w: 13.0, d: 10.2, floors: 4, shopType: 1, tone: 0 },
    { x: -98, z: 62, rotY: Math.PI / 2, kind: 'modern', w: 13.5, d: 10.5, floors: 5, shopType: 3, tone: 1 },
    { x: -108, z: -18, rotY: Math.PI / 2, kind: 'shop', w: 13.0, d: 10.0, floors: 4, shopType: 4, tone: 0 },
    { x: -102, z: -46, rotY: 0.7, kind: 'modern', w: 13.5, d: 10.2, floors: 5, shopType: 6, tone: 1 },
    { x: -64, z: -84, rotY: 0.4, kind: 'modern', w: 14.0, d: 10.5, floors: 5, shopType: 4, tone: 0 },
    { x: -30, z: -90, rotY: 0, kind: 'modern', w: 14.5, d: 10.8, floors: 6, shopType: 5, tone: 2 },
    { x: 30, z: -90, rotY: 0, kind: 'modern', w: 14.5, d: 10.8, floors: 6, shopType: 4, tone: 1 },
    { x: 68, z: -76, rotY: -0.5, kind: 'modern', w: 13.5, d: 10.2, floors: 5, shopType: 3, tone: 0 },
    { x: 16, z: 120, rotY: -Math.PI / 2, kind: 'modern', w: 13.5, d: 10.5, floors: 5, shopType: 1, tone: 0 },
    { x: -16, z: 120, rotY: Math.PI / 2, kind: 'shop', w: 13.0, d: 10.2, floors: 4, shopType: 2, tone: 1 },
    { x: 52, z: 112, rotY: Math.PI, kind: 'modern', w: 14.0, d: 10.5, floors: 5, shopType: 6, tone: 2 },
    { x: -52, z: 112, rotY: Math.PI, kind: 'modern', w: 14.0, d: 10.5, floors: 5, shopType: 5, tone: 0 },
    { x: 82, z: 90, rotY: -0.7, kind: 'modern', w: 13.5, d: 10.2, floors: 5, shopType: 4, tone: 1 },
    { x: -82, z: 90, rotY: 0.7, kind: 'shop', w: 13.0, d: 10.0, floors: 4, shopType: 0, tone: 2 },
  ];

  // Shared geometry cache for modular building construction
  const unitBoxGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const unitCylGeo = trackGeo(new THREE.CylinderGeometry(0.5, 0.5, 1, 10));
  const unitRoofGeo = trackGeo(new THREE.ConeGeometry(0.76, 1, 4));
  unitRoofGeo.rotateY(Math.PI / 4);

  for (let i = 0; i < buildingSpecs.length; i++) {
    const spec = buildingSpecs[i];
    if (!isClearSpot(spec.x, spec.z, Math.max(spec.w, spec.d) * 0.52)) continue;

    const lod = buildCityBuildingLOD(spec, {
      unitBoxGeo,
      unitCylGeo,
      unitRoofGeo,
      brickMat,
      plasterMats: [plasterCreamMat, plasterOchreMat, plasterSageMat, brickMat],
      modernMats: [modernGlassMat, modernDarkGlassMat, plasterCreamMat, plasterSageMat],
      carvedWoodMat,
      darkMetalMat,
      shutterMat,
      warmWindowMat,
      roofTileMat,
      stoneMat,
      concreteMat,
      solarPanelMat,
      tankMats: [tankBlackMat, tankBlueMat],
      awningMats,
      businessSignMats,
      quality,
    });
    lod.position.set(spec.x, getTerrainHeight(spec.x, spec.z) - 0.04, spec.z);
    lod.rotation.y = spec.rotY;
    group.add(lod);
  }

  // =========================================================================
  // 4. THAMEL OVERHEAD BUNTING FLAGS & CONSTRUCTION ZONE
  // =========================================================================
  buildThamelOverheadBunting(detailPropsGroup, prayerFlags, trackGeo, trackMat);
  buildRoadsideConstructionZone(detailPropsGroup, darkMetalMat, concreteMat, trackGeo, trackMat);

  // =========================================================================
  // 5. ELECTRICITY POLES, OVERHEAD WIRES, STREETLIGHTS, SIGNS & STREET PROPS
  // =========================================================================
  buildUtilitiesAndStreetClutter(
    group,
    detailPropsGroup,
    textures,
    concreteMat,
    darkMetalMat,
    carvedWoodMat,
    awningMats,
    quality,
    trackGeo,
    trackMat
  );

  // =========================================================================
  // 6. PARKED MOTORCYCLES & CARS (LEFT-SIDE PARKING CONVENTION)
  // =========================================================================
  buildParkedVehicles(detailPropsGroup, darkMetalMat, concreteMat, trackGeo, trackMat);

  // =========================================================================
  // 7. CITY VEGETATION (PIPAL, JACARANDA, PLANTER SHRUBS)
  // =========================================================================
  buildKathmanduVegetation(group, detailPropsGroup, stoneMat, quality, trackGeo, trackMat);

  // =========================================================================
  // 8. DISTANT KATHMANDU VALLEY OUTSKIRTS URBAN DENSITY (INSTANCED LOD)
  // =========================================================================
  buildDistantValleyUrbanRing(group, textures, quality, trackGeo, trackMat);

  // =========================================================================
  // 9. OPTIMIZED SIDEWALK PEDESTRIANS & SHOP ACTIVITY
  // =========================================================================
  const pedestrians = buildPedestrians(pedestrianGroup, trackGeo, trackMat);

  return {
    group,
    update: (elapsed: number, playerX: number, playerZ: number) => {
      const distFromKtm = Math.hypot(playerX, playerZ - 20);
      const inCityDetail = distFromKtm < 185;
      detailPropsGroup.visible = inCityDetail;
      pedestrianGroup.visible = distFromKtm < 165;

      if (!pedestrianGroup.visible) return;

      for (let i = 0; i < pedestrians.length; i++) {
        const p = pedestrians[i];
        if (p.stationary) {
          p.leftArm.rotation.x = Math.sin(elapsed * 2.2 + p.phase) * 0.14;
          p.rightArm.rotation.x = -Math.sin(elapsed * 1.9 + p.phase) * 0.12;
          continue;
        }
        const pingPong = 0.5 - 0.5 * Math.cos(elapsed * p.speed + p.phase);
        const dirSign = Math.sin(elapsed * p.speed + p.phase) >= 0 ? 1 : -1;
        const x = p.ax + (p.bx - p.ax) * pingPong;
        const z = p.az + (p.bz - p.az) * pingPong;
        p.root.position.set(x, KTM_Y + 0.16, z);

        const dx = (p.bx - p.ax) * dirSign;
        const dz = (p.bz - p.az) * dirSign;
        p.root.rotation.y = Math.atan2(dx, dz);

        const stride = Math.sin(elapsed * 7.5 * p.speed + p.phase) * 0.45;
        p.leftLeg.rotation.x = stride;
        p.rightLeg.rotation.x = -stride;
        p.leftArm.rotation.x = -stride * 0.7;
        p.rightArm.rotation.x = stride * 0.7;
      }
    },
    setQuality: (_q: GraphicsQuality) => {
      // Instanced LODs already stay within mobile Android budgets
    },
    dispose: () => {
      for (const g of disposableGeos) g.dispose();
      for (const m of disposableMats) m.dispose();
    },
  };
}

// ===========================================================================
// STREET SURFACE DETAILS: SIDEWALKS, ZEBRA CROSSINGS, DRAINAGE
// ===========================================================================
function buildKathmanduStreetSurfaceDetails(
  group: THREE.Group,
  detailGroup: THREE.Group,
  textures: ProceduralTextureSet,
  sidewalkMat: THREE.Material,
  urbanBaseMat: THREE.Material,
  stoneMat: THREE.Material,
  darkMetalMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  // Continuous paved urban ground district base inside Kathmandu Ring Road (eliminates rural meadow look)
  const urbanBaseGeo = trackGeo(new THREE.CircleGeometry(84, 48));
  urbanBaseGeo.rotateX(-Math.PI / 2);
  const urbanBase = new THREE.Mesh(urbanBaseGeo, urbanBaseMat);
  urbanBase.position.set(0, KTM_Y + 0.04, 20);
  urbanBase.receiveShadow = true;
  group.add(urbanBase);

  // Clean asphalt intersection apron pads at major Kathmandu junctions
  const apronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2b2e33,
      roughness: 0.8,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const apronGeo = trackGeo(new THREE.BoxGeometry(1, 0.06, 1));
  const junctions: Array<[number, number, number, number]> = [
    [0, 20, 12.6, 12.6],
    [0, 78, 12.2, 9.2],
    [0, -34, 11.8, 9.2],
    [0, -56, 12.0, 9.4],
    [-24, 20, 9.4, 11.4],
    [-52, 20, 9.4, 11.4],
    [24, 20, 9.8, 11.4],
    [29, 20, 9.4, 11.4],
    [-24, 62, 9.2, 9.2],
    [24, 54, 9.6, 9.6],
    [-31, -14, 8.8, 8.8],
    [-52, -10, 8.8, 8.8],
    [29, -24, 9.0, 9.0],
  ];
  for (const [jx, jz, jw, jd] of junctions) {
    const pad = new THREE.Mesh(apronGeo, apronMat);
    pad.position.set(jx, KTM_Y + 0.135, jz);
    pad.scale.set(jw, 1, jd);
    pad.receiveShadow = true;
    group.add(pad);
  }

  const swGeo = trackGeo(new THREE.BoxGeometry(1, 0.22, 1));

  // Sidewalks flanking Kathmandu Avenues & Neighborhood Streets
  const sidewalkRuns: Array<{ x: number; z: number; w: number; d: number }> = [
    // Durbar NS South leg (z: 27..92, split around z=78 Kupondole crossing)
    { x: -6.9, z: 50, w: 2.8, d: 44 },
    { x: 6.9, z: 50, w: 2.8, d: 44 },
    { x: -6.9, z: 89, w: 2.8, d: 12 },
    { x: 6.9, z: 89, w: 2.8, d: 12 },
    // Durbar NS North leg (z: -51..13, avoiding -8 Durbar entrance & -34/-56 crossings)
    { x: -6.9, z: -11, w: 2.8, d: 34 },
    { x: 6.9, z: 3, w: 2.8, d: 18 },
    { x: 6.9, z: -26, w: 2.8, d: 9 },
    { x: -6.9, z: -45, w: 2.8, d: 12 },
    { x: 6.9, z: -45, w: 2.8, d: 12 },
    // East-West Ave West leg (x: -72..-9)
    { x: -41, z: 13.5, w: 62, d: 2.6 },
    { x: -41, z: 26.5, w: 62, d: 2.6 },
    // East-West Ave East leg (x: 9..41 & 63..77, leaving Baneshwor roundabout clear)
    { x: 25, z: 13.5, w: 32, d: 2.6 },
    { x: 25, z: 26.5, w: 32, d: 2.6 },
    { x: 70, z: 13.5, w: 14, d: 2.6 },
    { x: 70, z: 26.5, w: 14, d: 2.6 },
    // Kupondole South Ave (z=78)
    { x: -12, z: 73.0, w: 14, d: 2.2 },
    { x: 12, z: 73.0, w: 14, d: 2.2 },
    { x: 0, z: 83.0, w: 40, d: 2.2 },
    // Lazimpat North Ave (z=-56)
    { x: -15, z: -61.2, w: 20, d: 2.2 },
    { x: 15, z: -61.2, w: 20, d: 2.2 },
    // Baneshwor & Patan connector sidewalks
    { x: 39, z: 61.2, w: 24, d: 2.2 },
    { x: -40, z: 57.0, w: 24, d: 2.2 },
  ];

  for (const sw of sidewalkRuns) {
    const mesh = new THREE.Mesh(swGeo, sidewalkMat);
    mesh.position.set(sw.x, KTM_Y + 0.11, sw.z);
    mesh.scale.set(sw.w, 1, sw.d);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Zebra Pedestrian Crossings at Major Intersections
  const zebraGeo = trackGeo(new THREE.PlaneGeometry(8.8, 3.2));
  zebraGeo.rotateX(-Math.PI / 2);
  const zebraMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.zebraMap,
      transparent: true,
      roughness: 0.72,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );

  const crossings: Array<{ x: number; z: number; rotY: number }> = [
    { x: 0, z: 28, rotY: 0 },
    { x: 0, z: 12, rotY: 0 },
    { x: -9, z: 20, rotY: Math.PI / 2 },
    { x: 9, z: 20, rotY: Math.PI / 2 },
    { x: 0, z: -16, rotY: 0 },
    { x: 0, z: 71, rotY: 0 },
    { x: 0, z: -49, rotY: 0 },
    { x: 38, z: 20, rotY: Math.PI / 2 },
    { x: 65, z: 20, rotY: Math.PI / 2 },
  ];
  for (const c of crossings) {
    const zMesh = new THREE.Mesh(zebraGeo, zebraMat);
    zMesh.position.set(c.x, KTM_Y + 0.175, c.z);
    zMesh.rotation.y = c.rotY;
    group.add(zMesh);
  }

  // Roadside Concrete Drainage Grates (Instanced)
  const grateGeo = trackGeo(new THREE.BoxGeometry(0.6, 0.04, 1.3));
  const gratePositions: Array<[number, number]> = [];
  for (let z = -42; z <= 82; z += 14) {
    if (Math.abs(z - 20) < 8) continue;
    gratePositions.push([-5.2, z], [5.2, z]);
  }
  const grates = new THREE.InstancedMesh(grateGeo, darkMetalMat, gratePositions.length);
  const dummy = new THREE.Object3D();
  gratePositions.forEach(([gx, gz], idx) => {
    dummy.position.set(gx, KTM_Y + 0.16, gz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    grates.setMatrixAt(idx, dummy.matrix);
  });
  grates.instanceMatrix.needsUpdate = true;
  grates.computeBoundingSphere();
  detailGroup.add(grates);

  // Roadside Jersey Barriers along Ring Road curve approaches
  const barrierGeo = trackGeo(new THREE.BoxGeometry(2.2, 0.72, 0.48));
  const barrierSpots: Array<[number, number, number]> = [
    [-9.5, 92, 0.1],
    [9.5, 92, -0.1],
    [-9.5, -56, -0.1],
    [9.5, -56, 0.1],
  ];
  const barriers = new THREE.InstancedMesh(barrierGeo, stoneMat, barrierSpots.length);
  barrierSpots.forEach(([bx, bz, ry], idx) => {
    dummy.position.set(bx, KTM_Y + 0.36, bz);
    dummy.rotation.set(0, ry, 0);
    dummy.updateMatrix();
    barriers.setMatrixAt(idx, dummy.matrix);
  });
  barriers.instanceMatrix.needsUpdate = true;
  barriers.computeBoundingSphere();
  detailGroup.add(barriers);
}

// ===========================================================================
// FAMOUS LANDMARKS
// ===========================================================================
function buildDurbarSquareComplex(
  group: THREE.Group,
  brickMat: THREE.Material,
  roofTileMat: THREE.Material,
  carvedWoodMat: THREE.Material,
  stoneMat: THREE.Material,
  plazaStoneMat: THREE.Material,
  whitePalaceMat: THREE.Material,
  goldMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): void {
  // East Plaza: Taleju / Kasthamandap 3-Tier Pagoda + Dabali Stage
  const eastPlaza = new THREE.Group();
  eastPlaza.position.set(15.5, KTM_Y, -14);
  group.add(eastPlaza);

  const paving = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(15, 0.2, 18)), plazaStoneMat);
  paving.position.y = 0.08;
  paving.receiveShadow = true;
  eastPlaza.add(paving);

  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(11.6 - i * 1.8, 0.75, 11.6 - i * 1.8)),
      stoneMat
    );
    step.position.y = 0.38 + i * 0.75;
    step.receiveShadow = true;
    eastPlaza.add(step);
  }

  let curY = 2.4;
  for (let tier = 0; tier < 3; tier++) {
    const s = 8.0 - tier * 1.8;
    const h = 3.1 - tier * 0.35;
    const core = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(s * 0.7, h, s * 0.7)), brickMat);
    core.position.y = curY + h * 0.5;
    core.castShadow = true;
    eastPlaza.add(core);

    // Carved timber struts (tundal) under eaves
    for (const sx of [-s * 0.34, s * 0.34]) {
      const strut = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 1.1, 0.18)), carvedWoodMat);
      strut.position.set(sx, curY + h - 0.35, s * 0.38);
      strut.rotation.x = 0.45;
      eastPlaza.add(strut);
    }

    const roof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(s * 0.88, 1.9, 4)), roofTileMat);
    roof.position.y = curY + h + 0.75;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    eastPlaza.add(roof);
    curY += h + 1.2;
  }

  const gajur = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.55, 2.3, 12)), goldMat);
  gajur.position.y = curY + 1.4;
  eastPlaza.add(gajur);

  // Guardian Stone Lions flanking entrance facing west toward avenue
  for (const lz of [-2.4, 2.4]) {
    const lionBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 1.1, 1.1)), stoneMat);
    lionBase.position.set(-6.3, 0.55, lz);
    eastPlaza.add(lionBase);
    const lionBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.85, 0.9, 0.7)), whitePalaceMat);
    lionBody.position.set(-6.3, 1.5, lz);
    eastPlaza.add(lionBody);
  }

  // West Plaza: White Rana-style Colonnade Palace (Gaddi Baithak inspired)
  const palace = new THREE.Group();
  palace.position.set(-19, KTM_Y, -17);
  group.add(palace);

  const palPlinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(13, 0.8, 18)), stoneMat);
  palPlinth.position.y = 0.4;
  palace.add(palPlinth);

  const palBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(9.5, 8.2, 16)), whitePalaceMat);
  palBody.position.set(-1.0, 4.9, 0);
  palBody.castShadow = true;
  palBody.receiveShadow = true;
  palace.add(palBody);

  // Neoclassical recessed windows on palace walls so it reads crisply at distance
  const palWinGeo = trackGeo(new THREE.BoxGeometry(9.75, 1.85, 1.25));
  for (const wy of [3.2, 6.4]) {
    for (let wz = -5.2; wz <= 5.2; wz += 2.6) {
      const pw = new THREE.Mesh(palWinGeo, stoneMat);
      pw.position.set(-1.0, wy, wz);
      palace.add(pw);
    }
  }
  const endWinGeo = trackGeo(new THREE.BoxGeometry(1.3, 1.85, 16.25));
  for (const wy of [3.2, 6.4]) {
    for (const wx of [-3.4, 1.2]) {
      const ew = new THREE.Mesh(endWinGeo, stoneMat);
      ew.position.set(wx, wy, 0);
      palace.add(ew);
    }
  }

  // Neoclassical colonnade columns facing east toward Durbar Street
  const colGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.34, 7.6, 10));
  for (let z = -6; z <= 6; z += 3) {
    const col = new THREE.Mesh(colGeo, whitePalaceMat);
    col.position.set(4.5, 4.6, z);
    palace.add(col);
  }
  const porticoRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.9, 15.6)), whitePalaceMat);
  porticoRoof.position.set(4.1, 8.6, 0);
  palace.add(porticoRoof);
  const palRoof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(8.5, 2.6, 4)), roofTileMat);
  palRoof.position.set(-0.5, 10.3, 0);
  palRoof.rotation.y = Math.PI / 4;
  palace.add(palRoof);
}

function buildSwayambhuHillComplex(
  group: THREE.Group,
  whitePalaceMat: THREE.Material,
  goldMat: THREE.Material,
  stoneMat: THREE.Material,
  brickMat: THREE.Material,
  prayerFlags: THREE.Mesh[],
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): void {
  const x = -55;
  const z = -35;
  const grp = new THREE.Group();
  grp.position.set(x, getTerrainHeight(x, z) - 0.1, z);
  group.add(grp);

  // Stone base terrace
  const terrace = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(14.5, 16, 2.4, 24)), stoneMat);
  terrace.position.y = 1.1;
  terrace.receiveShadow = true;
  grp.add(terrace);

  // White dome
  const dome = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(9.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)),
    whitePalaceMat
  );
  dome.position.y = 2.2;
  dome.castShadow = true;
  grp.add(dome);

  // Harmika with dark Buddha eyes accent bands
  const harmika = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.8, 2.7, 3.8)), goldMat);
  harmika.position.y = 12.4;
  grp.add(harmika);

  // 13-stage conical spire + umbrella canopy
  const spire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.15, 6.4, 16)), goldMat);
  spire.position.y = 16.9;
  grp.add(spire);
  const canopy = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.1, 1.3, 0.35, 16)), goldMat);
  canopy.position.y = 20.3;
  grp.add(canopy);

  // Eastern Stone Staircase & Mini Chaityas
  for (let s = 0; s < 5; s++) {
    const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 0.4, 4.2)), stoneMat);
    step.position.set(14.5 + s * 1.3, 1.6 - s * 0.35, 0);
    grp.add(step);
  }
  for (const ang of [0.8, 2.3, 4.1, 5.4]) {
    const cx = Math.cos(ang) * 12.6;
    const cz = Math.sin(ang) * 12.6;
    const chaitya = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.7, 1.1, 2.2, 10)), whitePalaceMat);
    chaitya.position.set(cx, 3.2, cz);
    grp.add(chaitya);
    const tip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.45, 1.0, 8)), goldMat);
    tip.position.set(cx, 4.7, cz);
    grp.add(tip);
  }

  // Mani prayer wheel drums along south base
  for (let i = -3; i <= 3; i++) {
    const wheel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.65, 10)), goldMat);
    wheel.position.set(i * 1.4, 2.7, 13.8);
    grp.add(wheel);
  }

  // Brick shrine pavilion beside stupa
  const shrine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.4, 3.2, 3.4)), brickMat);
  shrine.position.set(-12.5, 3.6, 2);
  grp.add(shrine);

  // Fluttering Prayer Flag Spokes
  const flagColors = [0x2563eb, 0xf8fafc, 0xdc2626, 0x16a34a, 0xeab308];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const flag = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(0.95, 0.58)),
      new THREE.MeshBasicMaterial({ color: flagColors[i % flagColors.length], side: THREE.DoubleSide })
    );
    flag.position.set(Math.cos(angle) * 7.2, 11.4, Math.sin(angle) * 7.2);
    flag.rotation.y = angle;
    grp.add(flag);
    prayerFlags.push(flag);
  }
}

function buildPashupatiAndBagmatiGhats(
  group: THREE.Group,
  stoneMat: THREE.Material,
  brickMat: THREE.Material,
  roofTileMat: THREE.Material,
  goldMat: THREE.Material,
  carvedWoodMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  const gx = 37;
  const gz = -37.2;
  const grp = new THREE.Group();
  grp.position.set(gx, KTM_Y, gz);
  group.add(grp);

  // Sacred Bagmati Stream Channel
  const riverMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0e7490,
      roughness: 0.16,
      metalness: 0.25,
      clearcoat: 0.85,
    })
  );
  const river = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14, 0.18, 4.0)), riverMat);
  river.position.set(0, 0.09, -3.2);
  grp.add(river);

  // Stepped Stone Bathing Ghats
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12, 0.35, 0.9)), stoneMat);
    step.position.set(0, 0.2 + s * 0.26, -0.7 + s * 0.8);
    grp.add(step);
  }

  // Stone Footbridge over Bagmati
  const bridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.45, 5.8)), stoneMat);
  bridge.position.set(-4.0, 0.75, -3.2);
  grp.add(bridge);

  // Golden 2-Tier Pashupatinath-Inspired Temple
  const templePlinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.6, 1.1, 8.6)), stoneMat);
  templePlinth.position.set(4.5, 0.55, 5.2);
  grp.add(templePlinth);

  const lowerWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.0, 3.0, 6.0)), brickMat);
  lowerWall.position.set(4.5, 2.6, 5.2);
  lowerWall.castShadow = true;
  grp.add(lowerWall);

  const lowerRoof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(6.4, 1.7, 4)), goldMat);
  lowerRoof.position.set(4.5, 4.7, 5.2);
  lowerRoof.rotation.y = Math.PI / 4;
  grp.add(lowerRoof);

  const upperWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.0, 2.2, 4.0)), carvedWoodMat);
  upperWall.position.set(4.5, 5.9, 5.2);
  grp.add(upperWall);

  const upperRoof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(4.6, 1.6, 4)), goldMat);
  upperRoof.position.set(4.5, 7.6, 5.2);
  upperRoof.rotation.y = Math.PI / 4;
  grp.add(upperRoof);

  const gajur = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.42, 1.7, 10)), goldMat);
  gajur.position.set(4.5, 9.1, 5.2);
  grp.add(gajur);

  // Secondary Courtyard Shelter
  const shelter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.0, 2.8, 3.8)), roofTileMat);
  shelter.position.set(-4.5, 1.4, 5.2);
  grp.add(shelter);
}

function buildPatanHeritageSquare(
  group: THREE.Group,
  stoneMat: THREE.Material,
  plazaStoneMat: THREE.Material,
  brickMat: THREE.Material,
  carvedWoodMat: THREE.Material,
  roofTileMat: THREE.Material,
  goldMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): void {
  const grp = new THREE.Group();
  grp.position.set(-44, KTM_Y, 72.5);
  group.add(grp);

  const plaza = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(15, 0.2, 11.5)), plazaStoneMat);
  plaza.position.y = 0.08;
  plaza.receiveShadow = true;
  grp.add(plaza);

  // Stone Krishna-Mandir-Inspired Shikhara Spire
  const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.2, 1.8, 7.2)), stoneMat);
  base.position.y = 0.9;
  grp.add(base);

  const mid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.2, 3.2, 5.2)), stoneMat);
  mid.position.y = 3.4;
  mid.castShadow = true;
  grp.add(mid);

  const shikhara = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(3.2, 6.2, 4)), stoneMat);
  shikhara.position.y = 8.0;
  shikhara.rotation.y = Math.PI / 4;
  shikhara.castShadow = true;
  grp.add(shikhara);

  const finial = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.45, 1.6, 10)), goldMat);
  finial.position.y = 11.7;
  grp.add(finial);

  // Traditional Patan Carved Courtyard Facade Backdrop
  const patanHall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12, 5.2, 4.4)), brickMat);
  patanHall.position.set(0, 2.6, 8.2);
  grp.add(patanHall);
  const hallBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(12.3, 0.4, 4.7)), carvedWoodMat);
  hallBeam.position.set(0, 5.1, 8.2);
  grp.add(hallBeam);
  const hallRoof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(9.2, 2.2, 4)), roofTileMat);
  hallRoof.position.set(0, 6.3, 8.2);
  hallRoof.rotation.y = Math.PI / 4;
  grp.add(hallRoof);
}

function buildBhaktapurNyatapola(
  group: THREE.Group,
  brickMat: THREE.Material,
  stoneMat: THREE.Material,
  roofTileMat: THREE.Material,
  carvedWoodMat: THREE.Material,
  goldMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T
): void {
  const grp = new THREE.Group();
  grp.position.set(40, KTM_Y, -10);
  group.add(grp);

  // 5-Step Brick & Stone Plinth
  for (let i = 0; i < 5; i++) {
    const s = 12.6 - i * 1.4;
    const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(s, 0.65, s)), i % 2 === 0 ? stoneMat : brickMat);
    step.position.y = 0.32 + i * 0.65;
    grp.add(step);
  }

  let curY = 3.25;
  for (let t = 0; t < 5; t++) {
    const w = 6.2 - t * 0.88;
    const h = 2.0 - t * 0.16;
    const core = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w * 0.72, h, w * 0.72)), t % 2 === 0 ? brickMat : carvedWoodMat);
    core.position.y = curY + h * 0.5;
    core.castShadow = true;
    grp.add(core);

    const roof = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(w * 0.88, 1.25, 4)), roofTileMat);
    roof.position.y = curY + h + 0.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    grp.add(roof);
    curY += h + 0.75;
  }

  const spire = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.45, 2.0, 10)), goldMat);
  spire.position.y = curY + 1.1;
  grp.add(spire);
}

function buildBaneshworRoundaboutAndPark(
  group: THREE.Group,
  stoneMat: THREE.Material,
  plazaStoneMat: THREE.Material,
  goldMat: THREE.Material,
  concreteMat: THREE.Material,
  darkMetalMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  // 1. New Baneshwor Roundabout Center Monument at (52, 20)
  const rbt = new THREE.Group();
  rbt.position.set(52, KTM_Y, 20);
  group.add(rbt);

  const curb = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(4.6, 4.9, 0.45, 20)), stoneMat);
  curb.position.y = 0.22;
  rbt.add(curb);

  const lawn = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(4.1, 4.1, 0.52, 20)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x2e6f34, roughness: 0.9 }))
  );
  lawn.position.y = 0.25;
  rbt.add(lawn);

  const obeliskBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 1.4, 1.8)), concreteMat);
  obeliskBase.position.y = 1.1;
  rbt.add(obeliskBase);

  const obelisk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.35, 0.65, 4.4, 8)), concreteMat);
  obelisk.position.y = 3.9;
  obelisk.castShadow = true;
  rbt.add(obelisk);

  const finial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.45, 10, 10)), goldMat);
  finial.position.y = 6.3;
  rbt.add(finial);

  // 2. Ratna Park Urban Garden Square at (14, 66)
  const park = new THREE.Group();
  park.position.set(14, KTM_Y, 66);
  group.add(park);

  const border = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(14, 0.22, 12)), plazaStoneMat);
  border.position.y = 0.1;
  park.add(border);

  const grass = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(11.5, 0.26, 9.5)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x357a38, roughness: 0.92 }))
  );
  grass.position.y = 0.13;
  park.add(grass);

  // Bus Stop Shelter along Baneshwor Avenue (38, 28)
  const busStop = new THREE.Group();
  busStop.position.set(38, KTM_Y + 0.16, 27.6);
  group.add(busStop);

  const shelterRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.2, 0.18, 2.2)), darkMetalMat);
  shelterRoof.position.set(0, 2.55, 0);
  busStop.add(shelterRoof);
  for (const px of [-2.2, 2.2]) {
    const post = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8)), darkMetalMat);
    post.position.set(px, 1.25, 0.7);
    busStop.add(post);
  }
  const backPanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(4.8, 1.8, 0.1)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }))
  );
  backPanel.position.set(0, 1.35, 0.85);
  busStop.add(backPanel);
  const bench = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.8, 0.45, 0.6)), concreteMat);
  bench.position.set(0, 0.4, 0.2);
  busStop.add(bench);
}

// ===========================================================================
// 3-12 PART COMPOSITE KATHMANDU BUILDINGS WITH THREE.LOD
// ===========================================================================
function buildCityBuildingLOD(
  spec: BuildingSpec,
  ctx: {
    unitBoxGeo: THREE.BoxGeometry;
    unitCylGeo: THREE.CylinderGeometry;
    unitRoofGeo: THREE.ConeGeometry;
    brickMat: THREE.Material;
    plasterMats: THREE.Material[];
    modernMats: THREE.Material[];
    carvedWoodMat: THREE.Material;
    darkMetalMat: THREE.Material;
    shutterMat: THREE.Material;
    warmWindowMat: THREE.Material;
    roofTileMat: THREE.Material;
    stoneMat: THREE.Material;
    concreteMat: THREE.Material;
    solarPanelMat: THREE.Material;
    tankMats: THREE.Material[];
    awningMats: THREE.Material[];
    businessSignMats: THREE.Material[];
    quality: GraphicsQuality;
  }
): THREE.LOD {
  const lod = new THREE.LOD();
  const floorH = spec.kind === 'modern' ? 3.4 : 3.1;
  const totalH = spec.floors * floorH;

  // --- HIGH DETAIL MESH GROUP (Near Camera) ---
  const hi = new THREE.Group();

  // 1. Ground stone plinth
  const plinth = new THREE.Mesh(ctx.unitBoxGeo, ctx.stoneMat);
  plinth.scale.set(spec.w + 0.6, 0.55, spec.d + 0.6);
  plinth.position.y = 0.27;
  plinth.receiveShadow = true;
  hi.add(plinth);

  // 2. Primary building core
  const wallMat =
    spec.kind === 'newari'
      ? ctx.brickMat
      : spec.kind === 'shop'
      ? ctx.plasterMats[spec.tone % ctx.plasterMats.length]
      : ctx.modernMats[spec.tone % ctx.modernMats.length];

  const body = new THREE.Mesh(ctx.unitBoxGeo, wallMat);
  body.scale.set(spec.w, totalH, spec.d);
  body.position.y = 0.55 + totalH * 0.5;
  body.castShadow = ctx.quality !== 'low';
  body.receiveShadow = true;
  hi.add(body);

  // Corner architectural pilasters for rich 3D silhouette
  const pilasterMat = spec.kind === 'newari' ? ctx.carvedWoodMat : ctx.concreteMat;
  for (const px of [-spec.w * 0.49, spec.w * 0.49]) {
    for (const pz of [-spec.d * 0.49, spec.d * 0.49]) {
      const pil = new THREE.Mesh(ctx.unitBoxGeo, pilasterMat);
      pil.scale.set(0.32, totalH, 0.32);
      pil.position.set(px, 0.55 + totalH * 0.5, pz);
      hi.add(pil);
    }
  }

  // 3. Architectural Articulation by Building Category
  if (spec.kind === 'newari' || spec.kind === 'shop') {
    // Timber floor cornice bands & upper-storey 3D window bays
    for (let f = 1; f < spec.floors; f++) {
      const band = new THREE.Mesh(ctx.unitBoxGeo, ctx.carvedWoodMat);
      band.scale.set(spec.w + 0.3, 0.22, spec.d + 0.3);
      band.position.y = 0.55 + f * floorH;
      hi.add(band);

      if (f >= 2) {
        for (const wx of [-spec.w * 0.28, spec.w * 0.28]) {
          const winFrame = new THREE.Mesh(ctx.unitBoxGeo, ctx.carvedWoodMat);
          winFrame.scale.set(1.55, 1.38, 0.22);
          winFrame.position.set(wx, 0.55 + f * floorH + floorH * 0.5, spec.d * 0.5 + 0.08);
          hi.add(winFrame);

          const pane = new THREE.Mesh(ctx.unitBoxGeo, ctx.warmWindowMat);
          pane.scale.set(1.18, 1.0, 0.08);
          pane.position.set(wx, 0.55 + f * floorH + floorH * 0.5, spec.d * 0.5 + 0.18);
          hi.add(pane);
        }
      }
    }

    // Articulated Carved Newari Sajhya Wooden Balcony (sill + lit lattice pane + mullions + mini eave)
    const balcY = 0.55 + floorH * 1.48;
    const balcW = spec.w * 0.54;
    const balcFrame = new THREE.Mesh(ctx.unitBoxGeo, ctx.carvedWoodMat);
    balcFrame.scale.set(balcW, 1.45, 0.68);
    balcFrame.position.set(0, balcY, spec.d * 0.5 + 0.32);
    hi.add(balcFrame);

    const balcPane = new THREE.Mesh(ctx.unitBoxGeo, ctx.warmWindowMat);
    balcPane.scale.set(balcW * 0.8, 0.86, 0.08);
    balcPane.position.set(0, balcY + 0.06, spec.d * 0.5 + 0.66);
    hi.add(balcPane);

    for (const mx of [-balcW * 0.24, 0, balcW * 0.24]) {
      const mullion = new THREE.Mesh(ctx.unitBoxGeo, ctx.carvedWoodMat);
      mullion.scale.set(0.12, 1.0, 0.14);
      mullion.position.set(mx, balcY + 0.04, spec.d * 0.5 + 0.69);
      hi.add(mullion);
    }

    const balcSill = new THREE.Mesh(ctx.unitBoxGeo, ctx.roofTileMat);
    balcSill.scale.set(balcW + 0.5, 0.18, 0.96);
    balcSill.position.set(0, balcY + 0.78, spec.d * 0.5 + 0.42);
    balcSill.rotation.x = 0.18;
    hi.add(balcSill);

    if (spec.kind === 'newari') {
      // Traditional Overhanging Tiled Pagoda / Pitched Roof
      const roof = new THREE.Mesh(ctx.unitRoofGeo, ctx.roofTileMat);
      roof.scale.set(spec.w * 1.18, 2.55, spec.d * 1.18);
      roof.position.y = 0.55 + totalH + 1.25;
      roof.castShadow = ctx.quality !== 'low';
      hi.add(roof);
    } else {
      // Mixed-use Nepali urban flat terrace roof with stair penthouse (chhat) & water tank
      const parapet = new THREE.Mesh(ctx.unitBoxGeo, ctx.concreteMat);
      parapet.scale.set(spec.w + 0.25, 0.65, spec.d + 0.25);
      parapet.position.y = 0.55 + totalH + 0.32;
      hi.add(parapet);

      const stairRoom = new THREE.Mesh(ctx.unitBoxGeo, wallMat);
      stairRoom.scale.set(spec.w * 0.34, 2.3, spec.d * 0.38);
      stairRoom.position.set(-spec.w * 0.24, 0.55 + totalH + 1.15, -spec.d * 0.18);
      hi.add(stairRoom);

      const tank = new THREE.Mesh(
        ctx.unitCylGeo,
        ctx.tankMats[(spec.tone + spec.shopType) % ctx.tankMats.length]
      );
      tank.scale.set(1.45, 1.55, 1.45);
      tank.position.set(spec.w * 0.25, 0.55 + totalH + 1.35, -spec.d * 0.15);
      hi.add(tank);
    }
  } else {
    // Modern Kathmandu Commercial / Apartment / Hotel:
    // Recessed Concrete Slab Balconies + Sunshades + Dark Metal Railings + Flat Parapet + Chhat Penthouse + Solar + Tank
    for (let f = 1; f < spec.floors; f++) {
      const slab = new THREE.Mesh(ctx.unitBoxGeo, ctx.concreteMat);
      slab.scale.set(spec.w + 0.42, 0.24, spec.d + 0.42);
      slab.position.y = 0.55 + f * floorH;
      hi.add(slab);

      if (f % 2 === 1) {
        const balcSlab = new THREE.Mesh(ctx.unitBoxGeo, ctx.concreteMat);
        balcSlab.scale.set(spec.w * 0.56, 0.18, 1.0);
        balcSlab.position.set(0, 0.55 + f * floorH + 0.08, spec.d * 0.5 + 0.48);
        hi.add(balcSlab);

        const rail = new THREE.Mesh(ctx.unitBoxGeo, ctx.darkMetalMat);
        rail.scale.set(spec.w * 0.56, 0.72, 0.09);
        rail.position.set(0, 0.55 + f * floorH + 0.5, spec.d * 0.5 + 0.94);
        hi.add(rail);
      }
    }

    // Flat Rooftop Parapet Wall
    const parapet = new THREE.Mesh(ctx.unitBoxGeo, ctx.concreteMat);
    parapet.scale.set(spec.w + 0.3, 0.68, spec.d + 0.3);
    parapet.position.y = 0.55 + totalH + 0.34;
    hi.add(parapet);

    // Rooftop Stairhouse Penthouse (Chhat)
    const chhat = new THREE.Mesh(ctx.unitBoxGeo, ctx.concreteMat);
    chhat.scale.set(spec.w * 0.38, 2.5, spec.d * 0.42);
    chhat.position.set(-spec.w * 0.22, 0.55 + totalH + 1.25, -spec.d * 0.15);
    hi.add(chhat);

    // Iconic Kathmandu Rooftop Plastic Water Tank (Black or Blue)
    const tank = new THREE.Mesh(
      ctx.unitCylGeo,
      ctx.tankMats[(spec.tone + spec.shopType) % ctx.tankMats.length]
    );
    tank.scale.set(1.65, 1.7, 1.65);
    tank.position.set(spec.w * 0.24, 0.55 + totalH + 1.4, -spec.d * 0.16);
    hi.add(tank);

    // Tilted Rooftop Solar Water Heater Panel
    const solar = new THREE.Mesh(ctx.unitBoxGeo, ctx.solarPanelMat);
    solar.scale.set(2.2, 0.14, 1.45);
    solar.position.set(spec.w * 0.18, 0.55 + totalH + 1.05, spec.d * 0.22);
    solar.rotation.x = 0.42;
    hi.add(solar);
  }

  // 4. Ground-Floor Local Business Shopfront (+Z facing street)
  const shutterFrame = new THREE.Mesh(ctx.unitBoxGeo, ctx.darkMetalMat);
  shutterFrame.scale.set(spec.w * 0.68, 2.65, 0.16);
  shutterFrame.position.set(0, 1.85, spec.d * 0.5 + 0.06);
  hi.add(shutterFrame);

  const shutterDoor = new THREE.Mesh(ctx.unitBoxGeo, ctx.shutterMat);
  shutterDoor.scale.set(spec.w * 0.6, 2.35, 0.2);
  shutterDoor.position.set(0, 1.72, spec.d * 0.5 + 0.1);
  hi.add(shutterDoor);

  const awning = new THREE.Mesh(
    ctx.unitBoxGeo,
    ctx.awningMats[spec.shopType % ctx.awningMats.length]
  );
  awning.scale.set(spec.w * 0.78, 0.2, 1.35);
  awning.position.set(0, 3.15, spec.d * 0.5 + 0.6);
  awning.rotation.x = 0.22;
  hi.add(awning);

  const signBoard = new THREE.Mesh(
    ctx.unitBoxGeo,
    ctx.businessSignMats[spec.shopType % ctx.businessSignMats.length]
  );
  signBoard.scale.set(Math.min(6.4, spec.w * 0.74), 1.15, 0.2);
  signBoard.position.set(0, 3.8, spec.d * 0.5 + 0.15);
  hi.add(signBoard);

  lod.addLevel(hi, 0);

  // --- SIMPLIFIED LOD MESH (Distance > 145m for Android performance) ---
  const low = new THREE.Group();
  const lowBody = new THREE.Mesh(ctx.unitBoxGeo, wallMat);
  lowBody.scale.set(spec.w, totalH + 0.55, spec.d);
  lowBody.position.y = (totalH + 0.55) * 0.5;
  low.add(lowBody);
  if (spec.kind === 'newari') {
    const lowRoof = new THREE.Mesh(ctx.unitRoofGeo, ctx.roofTileMat);
    lowRoof.scale.set(spec.w * 1.15, 2.4, spec.d * 1.15);
    lowRoof.position.y = totalH + 1.65;
    low.add(lowRoof);
  }
  lod.addLevel(low, 145);

  return lod;
}

// ===========================================================================
// THAMEL OVERHEAD FLAGS & CONSTRUCTION ZONE
// ===========================================================================
function buildThamelOverheadBunting(
  detailGroup: THREE.Group,
  prayerFlags: THREE.Mesh[],
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  const ropeMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x1e293b }));
  const flagColors = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e, 0xf8fafc];
  const flagMats = flagColors.map((c) =>
    trackMat(new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }))
  );
  const flagGeo = trackGeo(new THREE.PlaneGeometry(0.55, 0.38));

  const spans: Array<[number, number, number, number]> = [
    [-36, 4, -26, 4],
    [-36, -6, -26, -6],
    [-57, 2, -47, 2],
  ];

  for (let s = 0; s < spans.length; s++) {
    const [x1, z1, x2, z2] = spans[s];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x1, KTM_Y + 6.4, z1),
      new THREE.Vector3((x1 + x2) * 0.5, KTM_Y + 5.7, (z1 + z2) * 0.5),
      new THREE.Vector3(x2, KTM_Y + 6.4, z2),
    ]);
    const rope = new THREE.Mesh(trackGeo(new THREE.TubeGeometry(curve, 10, 0.03, 4, false)), ropeMat);
    detailGroup.add(rope);

    for (let f = 1; f <= 7; f++) {
      const pt = curve.getPoint(f / 8);
      const fl = new THREE.Mesh(flagGeo, flagMats[(f + s) % flagMats.length]);
      fl.position.set(pt.x, pt.y - 0.22, pt.z);
      detailGroup.add(fl);
      prayerFlags.push(fl);
    }
  }
}

function buildRoadsideConstructionZone(
  detailGroup: THREE.Group,
  darkMetalMat: THREE.Material,
  concreteMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  const cx = -13;
  const cz = 78;
  const czGroup = new THREE.Group();
  czGroup.position.set(cx, KTM_Y, cz);
  detailGroup.add(czGroup);

  const coneMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 }));
  const coneGeo = trackGeo(new THREE.ConeGeometry(0.24, 0.72, 8));
  for (let i = -2; i <= 2; i++) {
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(2.4, 0.36, i * 1.6);
    czGroup.add(cone);
  }

  // Sand/gravel pile + bamboo scaffolding frame
  const sand = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(1.9, 1.0, 9)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0x9a8468, roughness: 0.95 }))
  );
  sand.position.set(-0.5, 0.5, 0);
  czGroup.add(sand);

  const barrier = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.9, 4.2)), darkMetalMat);
  barrier.position.set(1.8, 0.55, 0);
  czGroup.add(barrier);

  const mixer = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.65, 0.65, 1.1, 10)), concreteMat);
  mixer.position.set(-1.2, 0.85, 2.2);
  mixer.rotation.z = 0.6;
  czGroup.add(mixer);
}

// ===========================================================================
// ELECTRICITY POLES, OVERHEAD WIRES, STREETLIGHTS, SIGNS, STALLS, BINS, BENCHES
// ===========================================================================
function buildUtilitiesAndStreetClutter(
  group: THREE.Group,
  detailGroup: THREE.Group,
  textures: ProceduralTextureSet,
  concreteMat: THREE.Material,
  darkMetalMat: THREE.Material,
  carvedWoodMat: THREE.Material,
  awningMats: THREE.Material[],
  quality: GraphicsQuality,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  const dummy = new THREE.Object3D();

  // 1. Concrete Utility Poles + Overhead Electrical Wires
  const poleRuns: Array<Array<[number, number]>> = [
    // West side of Durbar NS Ave
    [
      [-7.6, 86],
      [-7.6, 62],
      [-7.6, 38],
      [-7.6, 10],
      [-7.6, -14],
      [-7.6, -38],
    ],
    // North side of East-West Ave
    [
      [-66, 12.6],
      [-42, 12.6],
      [-18, 12.6],
      [18, 12.6],
      [38, 12.6],
      [68, 12.6],
    ],
  ];

  const allPoles = poleRuns.flat();
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.18, 8.6, 7));
  poleGeo.translate(0, 4.3, 0);
  const armGeo = trackGeo(new THREE.BoxGeometry(1.5, 0.14, 0.14));
  armGeo.translate(0, 8.1, 0);

  const poles = new THREE.InstancedMesh(poleGeo, concreteMat, allPoles.length);
  const arms = new THREE.InstancedMesh(armGeo, darkMetalMat, allPoles.length);
  allPoles.forEach(([px, pz], idx) => {
    dummy.position.set(px, KTM_Y, pz);
    dummy.rotation.set(0, px === -7.6 ? Math.PI / 2 : 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(idx, dummy.matrix);
    arms.setMatrixAt(idx, dummy.matrix);
  });
  poles.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  poles.computeBoundingSphere();
  arms.computeBoundingSphere();
  group.add(poles);
  detailGroup.add(arms);

  // Overhead Sagging Electrical Cable Spans
  const wireMat = trackMat(new THREE.LineBasicMaterial({ color: 0x0f172a }));
  for (const run of poleRuns) {
    for (let i = 0; i < run.length - 1; i++) {
      const [ax, az] = run[i];
      const [bx, bz] = run[i + 1];
      for (const offset of [-0.45, 0.45]) {
        const isNs = ax === bx;
        const p1 = new THREE.Vector3(ax + (isNs ? offset : 0), KTM_Y + 8.1, az + (isNs ? 0 : offset));
        const p2 = new THREE.Vector3(bx + (isNs ? offset : 0), KTM_Y + 8.1, bz + (isNs ? 0 : offset));
        const mid = p1.clone().lerp(p2, 0.5);
        mid.y -= 0.72;
        const pts = new THREE.QuadraticBezierCurve3(p1, mid, p2).getPoints(6);
        const lineGeo = trackGeo(new THREE.BufferGeometry().setFromPoints(pts));
        detailGroup.add(new THREE.Line(lineGeo, wireMat));
      }
    }
  }

  // 2. Curved Steel Streetlights on Outer Curb Overhanging the Roadway
  const lampSpots: Array<[number, number, number]> = [
    [5.75, 72, Math.PI],
    [5.75, 48, Math.PI],
    [5.75, 28, Math.PI],
    [5.75, -2, Math.PI],
    [5.75, -28, Math.PI],
    [-54, 25.4, Math.PI / 2],
    [-26, 25.4, Math.PI / 2],
    [26, 25.4, Math.PI / 2],
    [66, 25.4, Math.PI / 2],
  ];
  const lampMastGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.12, 6.2, 6));
  lampMastGeo.translate(0, 3.1, 0);
  const lampArmGeo = trackGeo(new THREE.BoxGeometry(1.45, 0.1, 0.1));
  lampArmGeo.translate(0.72, 6.1, 0);
  const lampHeadMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    })
  );
  const lampHeadGeo = trackGeo(new THREE.BoxGeometry(0.75, 0.14, 0.34));
  lampHeadGeo.translate(1.35, 6.04, 0);

  const masts = new THREE.InstancedMesh(lampMastGeo, darkMetalMat, lampSpots.length);
  const lampArms = new THREE.InstancedMesh(lampArmGeo, darkMetalMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampSpots.length);
  lampSpots.forEach(([lx, lz, ry], idx) => {
    dummy.position.set(lx, KTM_Y + 0.16, lz);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    masts.setMatrixAt(idx, dummy.matrix);
    lampArms.setMatrixAt(idx, dummy.matrix);
    heads.setMatrixAt(idx, dummy.matrix);
  });
  masts.instanceMatrix.needsUpdate = true;
  lampArms.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  masts.computeBoundingSphere();
  lampArms.computeBoundingSphere();
  heads.computeBoundingSphere();
  group.add(masts);
  detailGroup.add(lampArms);
  detailGroup.add(heads);

  // 3. Nepali Directional Highway & City Road Signs
  const roadSigns = [
    { x: -7.5, z: 36, ry: 0.15, np: 'दरबार स्क्वायर ↑', en: 'DURBAR SQUARE · THAMEL', bg: '#065f46', fg: '#ffffff' },
    { x: 11, z: 13.5, ry: -Math.PI / 2, np: 'नयाँ बानेश्वर →', en: 'BANESHWOR · BHAKTAPUR', bg: '#065f46', fg: '#ffffff' },
    { x: -11, z: 26.5, ry: Math.PI / 2, np: '← स्वयम्भू / पोखरा', en: 'SWAYAMBHU · POKHARA', bg: '#065f46', fg: '#ffffff' },
    { x: 15, z: -26, ry: -0.5, np: 'पशुपतिनाथ →', en: 'PASHUPATINATH TEMPLE', bg: '#1e3a8a', fg: '#fde047' },
  ];
  const signPostGeo = trackGeo(new THREE.CylinderGeometry(0.07, 0.08, 3.6, 6));
  const signBoardGeo = trackGeo(new THREE.BoxGeometry(3.2, 1.15, 0.12));

  for (const rs of roadSigns) {
    const sg = new THREE.Group();
    sg.position.set(rs.x, KTM_Y + 0.16, rs.z);
    sg.rotation.y = rs.ry;
    const post = new THREE.Mesh(signPostGeo, darkMetalMat);
    post.position.y = 1.8;
    sg.add(post);

    const smat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.createSignTexture(rs.np, rs.en, rs.bg, rs.fg),
        roughness: 0.4,
      })
    );
    const board = new THREE.Mesh(signBoardGeo, smat);
    board.position.y = 3.4;
    sg.add(board);
    detailGroup.add(sg);
  }

  // 4. Municipal Garbage Bins & Public Benches (Instanced)
  const binSpots: Array<[number, number]> = [
    [-7.6, 50], [7.6, 40], [-7.6, 6], [7.6, -10], [28, 13.5], [-28, 26.2], [14, 60.5],
  ];
  const binGeo = trackGeo(new THREE.CylinderGeometry(0.26, 0.22, 0.78, 8));
  binGeo.translate(0, 0.39, 0);
  const binMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e4d3a, roughness: 0.72 }));
  const bins = new THREE.InstancedMesh(binGeo, binMat, binSpots.length);
  binSpots.forEach(([bx, bz], idx) => {
    dummy.position.set(bx, KTM_Y + 0.22, bz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    bins.setMatrixAt(idx, dummy.matrix);
  });
  bins.instanceMatrix.needsUpdate = true;
  bins.computeBoundingSphere();
  detailGroup.add(bins);

  const benchSpots: Array<[number, number, number]> = [
    [10, 62, 0],
    [18, 62, 0],
    [12, -16, Math.PI / 2],
    [-40, 68, 0],
  ];
  const benchGeo = trackGeo(new THREE.BoxGeometry(1.9, 0.46, 0.65));
  benchGeo.translate(0, 0.23, 0);
  const benches = new THREE.InstancedMesh(benchGeo, carvedWoodMat, benchSpots.length);
  benchSpots.forEach(([bx, bz, ry], idx) => {
    dummy.position.set(bx, KTM_Y + 0.16, bz);
    dummy.rotation.set(0, ry, 0);
    dummy.updateMatrix();
    benches.setMatrixAt(idx, dummy.matrix);
  });
  benches.instanceMatrix.needsUpdate = true;
  benches.computeBoundingSphere();
  detailGroup.add(benches);

  // 5. Roadside Tea Stalls & Street Vendor Carts with Umbrellas
  const stallSpots: Array<[number, number, number, number]> = [
    [-7.8, 52, Math.PI / 2, 0],
    [7.8, 36, -Math.PI / 2, 2],
    [-28, 12.2, 0, 1],
    [29, 27.6, Math.PI, 3],
    [58, -36, 0, 0],
  ];
  const counterGeo = trackGeo(new THREE.BoxGeometry(2.1, 0.95, 1.0));
  const umbrellaGeo = trackGeo(new THREE.ConeGeometry(1.65, 0.65, 8));
  const poleUmbGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6));

  for (const [sx, sz, ry, colIdx] of stallSpots) {
    if (!isClearSpot(sx, sz, 1.1) && Math.abs(sx) > 9) continue;
    const stall = new THREE.Group();
    stall.position.set(sx, KTM_Y + 0.14, sz);
    stall.rotation.y = ry;

    const counter = new THREE.Mesh(counterGeo, carvedWoodMat);
    counter.position.y = 0.48;
    stall.add(counter);

    const pole = new THREE.Mesh(poleUmbGeo, darkMetalMat);
    pole.position.set(0, 1.25, 0);
    stall.add(pole);

    const umb = new THREE.Mesh(umbrellaGeo, awningMats[colIdx % awningMats.length]);
    umb.position.set(0, 2.55, 0);
    umb.castShadow = quality !== 'low';
    stall.add(umb);
    detailGroup.add(stall);
  }
}

// ===========================================================================
// PARKED MOTORCYCLES & CARS ALONG KATHMANDU SHOULDERS
// ===========================================================================
function buildParkedVehicles(
  detailGroup: THREE.Group,
  darkMetalMat: THREE.Material,
  _concreteMat: THREE.Material,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // Parked Motorcycles / Scooters on Asphalt Road Shoulders (clear of raised sidewalks)
  const bikeSpots: Array<[number, number, number, number]> = [
    [-4.85, 46, 0.22, 0xdc2626],
    [-4.85, 44.1, 0.16, 0x2563eb],
    [4.85, 41, -0.22, 0x1e293b],
    [4.85, 39.1, -0.14, 0xd97706],
    [-25, 15.6, Math.PI / 2, 0x059669],
    [-27, 15.6, Math.PI / 2, 0xe11d48],
    [32, 15.6, -Math.PI / 2, 0x0ea5e9],
    [34, 15.6, -Math.PI / 2, 0xf59e0b],
    [48, 49, 0.3, 0x334155],
    [-36, 56, 0.1, 0xdc2626],
  ];

  const bikeBodyGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.28, 1.32));
  bikeBodyGeo.translate(0, 0.56, 0);
  const bikeSeatGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.14, 0.62));
  bikeSeatGeo.translate(0, 0.75, -0.18);
  const bikeFrontGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.34, 0.26));
  bikeFrontGeo.translate(0, 0.82, 0.44);
  const bikeWheelGeo = trackGeo(new THREE.CylinderGeometry(0.25, 0.25, 0.13, 10));
  bikeWheelGeo.rotateZ(Math.PI / 2);

  const bikeBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.4 }));
  const bikeBodies = new THREE.InstancedMesh(bikeBodyGeo, bikeBodyMat, bikeSpots.length);
  const bikeSeats = new THREE.InstancedMesh(bikeSeatGeo, darkMetalMat, bikeSpots.length);
  const bikeFronts = new THREE.InstancedMesh(bikeFrontGeo, darkMetalMat, bikeSpots.length);
  const bikeWheels = new THREE.InstancedMesh(bikeWheelGeo, darkMetalMat, bikeSpots.length * 2);

  bikeSpots.forEach(([bx, bz, ry, hex], idx) => {
    dummy.position.set(bx, KTM_Y + 0.14, bz);
    dummy.rotation.set(0, ry, 0.08);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bikeBodies.setMatrixAt(idx, dummy.matrix);
    bikeSeats.setMatrixAt(idx, dummy.matrix);
    bikeFronts.setMatrixAt(idx, dummy.matrix);
    color.setHex(hex);
    bikeBodies.setColorAt(idx, color);

    for (let w = 0; w < 2; w++) {
      const wz = w === 0 ? 0.46 : -0.46;
      dummy.position.set(
        bx + Math.sin(ry) * wz,
        KTM_Y + 0.39,
        bz + Math.cos(ry) * wz
      );
      dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix();
      bikeWheels.setMatrixAt(idx * 2 + w, dummy.matrix);
    }
  });
  bikeBodies.instanceMatrix.needsUpdate = true;
  bikeSeats.instanceMatrix.needsUpdate = true;
  bikeFronts.instanceMatrix.needsUpdate = true;
  if (bikeBodies.instanceColor) bikeBodies.instanceColor.needsUpdate = true;
  bikeWheels.instanceMatrix.needsUpdate = true;
  bikeBodies.computeBoundingSphere();
  bikeSeats.computeBoundingSphere();
  bikeFronts.computeBoundingSphere();
  bikeWheels.computeBoundingSphere();
  detailGroup.add(bikeBodies);
  detailGroup.add(bikeSeats);
  detailGroup.add(bikeFronts);
  detailGroup.add(bikeWheels);

  // Parked Nepali Hatchbacks & Micro-Taxis Seated on Asphalt Shoulders with 4 Wheels + Glass Cabin
  const carSpots: Array<[number, number, number, number]> = [
    [4.45, 66, Math.PI, 0xf8fafc],
    [-4.45, 29, 0, 0x94a3b8],
    [44, 15.8, Math.PI / 2, 0xeab308],
    [-46, 24.2, -Math.PI / 2, 0x2563eb],
    [28.0, 44, 0, 0xdc2626],
  ];
  const carHullGeo = trackGeo(new THREE.BoxGeometry(1.68, 0.66, 3.65));
  carHullGeo.translate(0, 0.62, 0);
  const carCabinGeo = trackGeo(new THREE.BoxGeometry(1.42, 0.52, 1.95));
  carCabinGeo.translate(0, 1.18, -0.1);
  const carWheelGeo = trackGeo(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10));
  carWheelGeo.rotateZ(Math.PI / 2);

  const carMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.38 }));
  const carGlassMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.16, metalness: 0.72 }));

  const carHulls = new THREE.InstancedMesh(carHullGeo, carMat, carSpots.length);
  const carCabins = new THREE.InstancedMesh(carCabinGeo, carGlassMat, carSpots.length);
  const carWheels = new THREE.InstancedMesh(carWheelGeo, darkMetalMat, carSpots.length * 4);

  const wheelOffsets: Array<[number, number]> = [
    [-0.78, 1.1],
    [0.78, 1.1],
    [-0.78, -1.1],
    [0.78, -1.1],
  ];

  carSpots.forEach(([cx, cz, ry, hex], idx) => {
    dummy.position.set(cx, KTM_Y + 0.14, cz);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    carHulls.setMatrixAt(idx, dummy.matrix);
    carCabins.setMatrixAt(idx, dummy.matrix);
    color.setHex(hex);
    carHulls.setColorAt(idx, color);

    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    wheelOffsets.forEach(([wx, wz], wIdx) => {
      dummy.position.set(
        cx + wx * cosY + wz * sinY,
        KTM_Y + 0.44,
        cz - wx * sinY + wz * cosY
      );
      dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix();
      carWheels.setMatrixAt(idx * 4 + wIdx, dummy.matrix);
    });
  });
  carHulls.instanceMatrix.needsUpdate = true;
  carCabins.instanceMatrix.needsUpdate = true;
  carWheels.instanceMatrix.needsUpdate = true;
  if (carHulls.instanceColor) carHulls.instanceColor.needsUpdate = true;
  carHulls.computeBoundingSphere();
  carCabins.computeBoundingSphere();
  carWheels.computeBoundingSphere();
  detailGroup.add(carHulls);
  detailGroup.add(carCabins);
  detailGroup.add(carWheels);
}

// ===========================================================================
// URBAN KATHMANDU VEGETATION (PIPAL, JACARANDA, SHRUBS)
// ===========================================================================
function buildKathmanduVegetation(
  group: THREE.Group,
  detailGroup: THREE.Group,
  stoneMat: THREE.Material,
  quality: GraphicsQuality,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  const trunkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 }));
  const pipalMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x2d6a3e, roughness: 0.84 }));
  const jacarandaMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.78 }));

  // Hero Urban Trees (Pipal / Jacaranda) placed organically in parks, squares, and sidewalks
  const urbanTrees: Array<{ x: number; z: number; scale: number; jacaranda: boolean }> = [
    { x: 11, z: 66, scale: 1.25, jacaranda: false }, // Ratna Park Pipal
    { x: 18, z: 68, scale: 1.05, jacaranda: true },  // Ratna Park Jacaranda
    { x: 10, z: -23, scale: 1.15, jacaranda: false }, // Durbar courtyard Pipal
    { x: -11, z: -26, scale: 1.0, jacaranda: true },
    { x: 52, z: -38, scale: 1.2, jacaranda: false },  // Pashupati riverbank tree
    { x: -34, z: 72, scale: 1.1, jacaranda: true },   // Patan square tree
    { x: -58, z: 48, scale: 1.05, jacaranda: false },
    { x: 32, z: 62, scale: 1.0, jacaranda: true },
    { x: 76, z: -4, scale: 1.15, jacaranda: false },
    { x: -72, z: -14, scale: 1.1, jacaranda: false },
    { x: 74, z: 54, scale: 1.15, jacaranda: true },
  ];

  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.28, 0.46, 3.2, 7));
  const crownGeo = trackGeo(new THREE.IcosahedronGeometry(2.15, 1));

  for (const t of urbanTrees) {
    if (!isClearSpot(t.x, t.z, 2.2)) continue;
    const tree = new THREE.Group();
    tree.position.set(t.x, getTerrainHeight(t.x, t.z), t.z);
    tree.scale.setScalar(t.scale);

    // Optional stone chautara (Nepali tree platform) around larger Pipal trees
    if (!t.jacaranda) {
      const chautara = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.5, 1.65, 0.55, 8)), stoneMat);
      chautara.position.y = 0.27;
      tree.add(chautara);
    }

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.6;
    trunk.castShadow = quality !== 'low';
    tree.add(trunk);

    const cMat = t.jacaranda ? jacarandaMat : pipalMat;
    const c1 = new THREE.Mesh(crownGeo, cMat);
    c1.position.set(0, 4.3, 0);
    c1.scale.set(1.08, 0.85, 1.08);
    c1.castShadow = quality !== 'low';
    tree.add(c1);

    const c2 = new THREE.Mesh(crownGeo, cMat);
    c2.scale.set(0.76, 0.72, 0.76);
    c2.position.set(1.15, 3.75, 0.65);
    tree.add(c2);

    const c3 = new THREE.Mesh(crownGeo, cMat);
    c3.scale.set(0.72, 0.7, 0.72);
    c3.position.set(-1.05, 3.85, -0.55);
    tree.add(c3);

    const c4 = new THREE.Mesh(crownGeo, cMat);
    c4.scale.set(0.64, 0.68, 0.64);
    c4.position.set(0.35, 4.9, -0.7);
    tree.add(c4);

    group.add(tree);
  }

  // Instanced Shrubs & Planters (Smooth rounded greenery inside stone planter curbs)
  const shrubSpots: Array<[number, number]> = [
    [9.5, 62], [18.5, 62], [9.5, 70], [18.5, 70],
    [52, 16.5], [52, 23.5], [48.5, 20], [55.5, 20],
    [-12, -10], [12, -6], [-38, 66], [42, -2],
    [-8, 38], [8, 38], [-8, 50], [8, 50],
    [-8, 84], [8, 84], [-18, -30], [18, -30],
  ];
  const shrubGeo = trackGeo(new THREE.IcosahedronGeometry(0.56, 1));
  shrubGeo.scale(1.18, 0.78, 1.18);
  shrubGeo.translate(0, 0.44, 0);
  const planterGeo = trackGeo(new THREE.CylinderGeometry(0.76, 0.82, 0.28, 8));
  planterGeo.translate(0, 0.14, 0);
  const shrubMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3a7426, roughness: 0.88 }));
  const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubSpots.length);
  const planters = new THREE.InstancedMesh(planterGeo, stoneMat, shrubSpots.length);
  const dummy = new THREE.Object3D();
  shrubSpots.forEach(([sx, sz], idx) => {
    dummy.position.set(sx, KTM_Y + 0.14, sz);
    dummy.rotation.set(0, idx * 0.8, 0);
    dummy.scale.set(1, 0.85 + (idx % 3) * 0.15, 1);
    dummy.updateMatrix();
    shrubs.setMatrixAt(idx, dummy.matrix);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    planters.setMatrixAt(idx, dummy.matrix);
  });
  shrubs.instanceMatrix.needsUpdate = true;
  planters.instanceMatrix.needsUpdate = true;
  shrubs.computeBoundingSphere();
  planters.computeBoundingSphere();
  detailGroup.add(planters);
  detailGroup.add(shrubs);
}

// ===========================================================================
// DISTANT KATHMANDU VALLEY URBAN DENSITY (INSTANCED OUTSKIRT SETTLEMENTS)
// ===========================================================================
function buildDistantValleyUrbanRing(
  group: THREE.Group,
  textures: ProceduralTextureSet,
  quality: GraphicsQuality,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): void {
  const count = quality === 'low' ? 140 : 250;
  const boxGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  boxGeo.translate(0, 0.5, 0);
  const capGeo = trackGeo(new THREE.BoxGeometry(0.45, 0.22, 0.45));
  capGeo.translate(0, 1.11, 0);

  const outskirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.plasterFacadeMap,
      color: 0xffffff,
      roughness: 0.86,
    })
  );
  const capMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.82 }));

  const inst = new THREE.InstancedMesh(boxGeo, outskirtMat, count);
  const caps = new THREE.InstancedMesh(capGeo, capMat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0xbca88e, 0xa85840, 0x9aa6b5, 0xc49566, 0x8ea398, 0xb09e8c];

  let placed = 0;
  let attempt = 0;
  while (placed < count && attempt < count * 7) {
    attempt++;
    const angle = attempt * 2.39996;
    const rad = 112 + ((attempt * 23) % 120);
    const x = Math.cos(angle) * rad;
    const z = 20 + Math.sin(angle) * rad;

    const road = getRoadSample(x, z);
    if (road.dist < road.width * 0.5 + 9.5) continue;

    const y = getTerrainHeight(x, z);
    if (y > 25) continue;

    const w = 7.5 + (attempt % 4) * 1.8;
    const d = 6.8 + ((attempt + 2) % 3) * 1.6;
    const h = 7.5 + (attempt % 5) * 2.8;

    dummy.position.set(x, y - 0.35, z);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    inst.setMatrixAt(placed, dummy.matrix);
    caps.setMatrixAt(placed, dummy.matrix);

    color.setHex(palette[placed % palette.length]);
    inst.setColorAt(placed, color);
    placed++;
  }
  inst.count = placed;
  caps.count = placed;
  inst.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.computeBoundingSphere();
  caps.computeBoundingSphere();
  group.add(inst);
  group.add(caps);
}

// ===========================================================================
// OPTIMIZED SIDEWALK PEDESTRIANS & SHOP/BUS-STOP ACTIVITY
// ===========================================================================
function buildPedestrians(
  pedestrianGroup: THREE.Group,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): PedestrianAgent[] {
  const agents: PedestrianAgent[] = [];
  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xc68b59, roughness: 0.72 }));
  const trouserMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 }));
  const shirtPalette = [0xdc2626, 0x2563eb, 0xd97706, 0x059669, 0x7c3aed, 0xf8fafc, 0xdb2777];
  const shirtMats = shirtPalette.map((hex) =>
    trackMat(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 }))
  );

  const headGeo = trackGeo(new THREE.SphereGeometry(0.16, 8, 8));
  const torsoGeo = trackGeo(new THREE.BoxGeometry(0.38, 0.54, 0.22));
  const limbGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.48, 0.12));
  limbGeo.translate(0, -0.24, 0);

  const routes: Array<{ ax: number; az: number; bx: number; bz: number; speed: number; stationary?: boolean }> = [
    // Durbar NS Sidewalks
    { ax: -6.8, az: 34, bx: -6.8, bz: 62, speed: 0.35 },
    { ax: 6.8, az: 58, bx: 6.8, bz: 30, speed: 0.32 },
    { ax: -6.8, az: 6, bx: -6.8, bz: -26, speed: 0.3 },
    { ax: 6.8, az: -12, bx: 6.8, bz: 8, speed: 0.28 },
    // Thamel Bazaar
    { ax: -44, az: 13.6, bx: -18, bz: 13.6, speed: 0.34 },
    { ax: -35, az: 16, bx: -35, bz: -2, speed: 0.32 },
    { ax: -47, az: -6, bx: -36, bz: -9, speed: 0.28 },
    // Baneshwor & Bus Stop
    { ax: 20, az: 13.6, bx: 40, bz: 13.6, speed: 0.3 },
    { ax: 26, az: 26.4, bx: 42, bz: 26.4, speed: 0.35 },
    { ax: 37.2, az: 27.3, bx: 37.2, bz: 27.3, speed: 0, stationary: true },
    { ax: 38.8, az: 27.4, bx: 38.8, bz: 27.4, speed: 0, stationary: true },
    // Tea Stall & Shop Customers
    { ax: -7.1, az: 52.8, bx: -7.1, bz: 52.8, speed: 0, stationary: true },
    { ax: 7.1, az: 36.8, bx: 7.1, bz: 36.8, speed: 0, stationary: true },
    { ax: 12, az: 63, bx: 18, bz: 63, speed: 0.26 },
    // Patan & Swayambhu
    { ax: -34, az: 68, bx: -50, bz: 68, speed: 0.3 },
    { ax: -42, az: -32, bx: -42, bz: -22, speed: 0.28 },
  ];

  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    const pRoot = new THREE.Group();
    pRoot.position.set(r.ax, KTM_Y + 0.16, r.az);

    const torso = new THREE.Mesh(torsoGeo, shirtMats[i % shirtMats.length]);
    torso.position.y = 0.85;
    pRoot.add(torso);

    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.3;
    pRoot.add(head);

    const leftLeg = new THREE.Mesh(limbGeo, trouserMat);
    leftLeg.position.set(-0.1, 0.56, 0);
    pRoot.add(leftLeg);

    const rightLeg = new THREE.Mesh(limbGeo, trouserMat);
    rightLeg.position.set(0.1, 0.56, 0);
    pRoot.add(rightLeg);

    const leftArm = new THREE.Mesh(limbGeo, shirtMats[i % shirtMats.length]);
    leftArm.position.set(-0.26, 1.08, 0);
    pRoot.add(leftArm);

    const rightArm = new THREE.Mesh(limbGeo, shirtMats[i % shirtMats.length]);
    rightArm.position.set(0.26, 1.08, 0);
    pRoot.add(rightArm);

    pedestrianGroup.add(pRoot);
    agents.push({
      root: pRoot,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      ax: r.ax,
      az: r.az,
      bx: r.bx,
      bz: r.bz,
      speed: r.speed,
      phase: i * 1.3,
      stationary: Boolean(r.stationary),
    });
  }

  return agents;
}
