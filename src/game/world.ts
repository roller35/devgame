import * as THREE from 'three';
import { LANDMARKS } from './catalog';
import { buildKathmanduCity } from './kathmandu';
import {
  getRoadSample,
  getTerrainHeight,
  PHEWA_LAKE_CENTER,
  PHEWA_LAKE_RADIUS,
  PHEWA_WATER_Y,
  ROAD_NETWORK,
  STUNT_RAMPS,
  WORLD_HALF_EXTENT,
} from './terrain';
import { ProceduralTextureSet } from './textures';
import { GraphicsQuality } from './types';

export interface NepalWorldHandles {
  root: THREE.Group;
  checkpointBeacon: THREE.Group;
  gpsBeacon: THREE.Group;
  prayerFlags: THREE.Mesh[];
  waterMesh: THREE.Mesh;
  setAtmosphere: (horizonHex: number, zenithHex: number) => void;
  update: (elapsed: number, playerX?: number, playerZ?: number) => void;
  setQuality: (q: GraphicsQuality) => void;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function outerMountainHeight(x: number, z: number): number {
  const edgeMax = Math.max(Math.abs(x), Math.abs(z));
  const clampedX = clamp(x, -536, 536);
  const clampedZ = clamp(z, -536, 536);
  const edgeY = getTerrainHeight(clampedX, clampedZ);

  if (edgeMax <= 536) {
    // Sit slightly beneath playable terrain inside the overlap seam
    return edgeY - 0.35;
  }

  const outDist = edgeMax - 536;
  const riseFactor = smoothstep(0, 1420, outDist);
  const foothillRise = smoothstep(0, 440, outDist);

  // Sharp multi-octave ridged Himalayan silhouette (craggy peaks & valleys, never smooth mounds)
  const r1 = 1 - Math.abs(Math.sin(x * 0.0033 + 0.4) * Math.cos(z * 0.0029 - 0.3));
  const r2 = 1 - Math.abs(Math.sin(x * 0.0085 - 1.1) + Math.cos(z * 0.0089 + 0.9)) * 0.5;
  const r3 = 1 - Math.abs(Math.sin(x * 0.019 + z * 0.012));
  const ridgeVal = Math.pow(r1 * 0.56 + r2 * 0.3 + r3 * 0.14, 1.35);

  // Taller Himalayan massif to the North (z < -220), greener Mahabharat hills South/East/West
  const northBoost = smoothstep(100, -900, z);
  const southFlat = smoothstep(220, 700, z) * 0.55;

  const ridgeScale = (160 + northBoost * 420) * (1 - southFlat * 0.45);
  const extraHeight =
    foothillRise * (30 + northBoost * 55) +
    riseFactor * ridgeVal * ridgeScale;

  return edgeY + extraHeight;
}

export function buildNepalWorld(
  textures: ProceduralTextureSet,
  quality: GraphicsQuality
): NepalWorldHandles {
  const root = new THREE.Group();
  const prayerFlags: THREE.Mesh[] = [];

  // 0. Atmospheric Gradient Sky Dome (replaces flat fog void on horizon)
  const skyUniforms = {
    uZenithColor: { value: new THREE.Color(0x2b6cb0) },
    uHorizonColor: { value: new THREE.Color(0x8ec5eb) },
    uGroundColor: { value: new THREE.Color(0x4a6340) },
  };
  const skyGeo = new THREE.SphereGeometry(2350, 28, 16);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        vec3 col = mix(uHorizonColor, uZenithColor, pow(max(h, 0.0), 0.55));
        if (h < 0.0) {
          col = mix(uHorizonColor, uGroundColor, min(1.0, -h * 4.5));
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  root.add(skyDome);

  // 1. Continuous Nepal Playable Terrain Mesh with Textured Earth/Grass & Natural Vertex Coloring
  const segs = quality === 'low' ? 128 : 184;
  const size = WORLD_HALF_EXTENT * 2;
  const terrainGeo = new THREE.PlaneGeometry(size, size, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);

  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const graniteCol = new THREE.Color(0x4b5560);
  const darkSlateCol = new THREE.Color(0x3a434d);
  const snowAccentCol = new THREE.Color(0xd2dce6);
  const shoulderCol = new THREE.Color(0x52493b);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);

    const macroTone = Math.sin(x * 0.032) * Math.cos(z * 0.032);

    if (y > 76) {
      // High foothill ridges: deep pine forest transitioning to dark granite/slate (never white domes)
      const rockMix = Math.min(0.85, (y - 76) / 65);
      c.setHex(0x264820).lerp(darkSlateCol, rockMix);
    } else if (y > 46) {
      // Mid-alpine slopes: pine forest & granite outcrops
      const rockMix = Math.min(0.45, (y - 46) / 40);
      c.setHex(macroTone > 0 ? 0x2e5325 : 0x24441d).lerp(graniteCol, rockMix);
    } else if (y > 26) {
      // Mountain forest slope
      c.setHex(macroTone > 0 ? 0x355c2a : 0x284920);
    } else if (z > 180) {
      // Terai golden-green rice paddies
      const paddy = (Math.sin(x * 0.08) * Math.cos(z * 0.08)) > 0;
      c.setHex(paddy ? 0x567f1e : 0x436918);
    } else if (x < -140) {
      // Pokhara lush lakeside green
      c.setHex(macroTone > 0 ? 0x32612b : 0x295223);
    } else if (x > 135) {
      // Hill village terraced green
      const terrace = (Math.floor(y * 0.8) % 2) === 0;
      c.setHex(terrace ? 0x416b28 : 0x335720);
    } else {
      // Kathmandu valley rich earth & meadow
      c.setHex(macroTone > 0.1 ? 0x4b6131 : 0x3d5228);
    }

    // Warm soil/gravel blend along road shoulders
    const road = getRoadSample(x, z);
    if (road.dist < road.width * 0.98) {
      c.lerp(shoulderCol, 0.52);
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.terrainMap,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.01,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // 1b. Seamless 360° Outer Valley Foothills & Layered Mountain Horizon Ring (495m -> 2000m)
  const outerGeo = new THREE.RingGeometry(495, 2000, 192, 44);
  outerGeo.rotateX(-Math.PI / 2);
  const oPos = outerGeo.attributes.position;
  const oUv = outerGeo.attributes.uv;
  const oColors = new Float32Array(oPos.count * 3);
  const forestLow = new THREE.Color(0x284d25);
  const forestHigh = new THREE.Color(0x33562d);
  const ridgeStone = new THREE.Color(0x454f5b);
  const ridgeSnow = new THREE.Color(0xd2dce6);

  for (let i = 0; i < oPos.count; i++) {
    const x = oPos.getX(i);
    const z = oPos.getZ(i);
    const y = outerMountainHeight(x, z);
    oPos.setY(i, y);
    oUv.setXY(i, x * 0.012, z * 0.012);

    const tone = Math.sin(x * 0.008) * Math.cos(z * 0.008);
    const dist = Math.hypot(x, z);
    if (y > 445 && dist > 1200) {
      const sMix = clamp((y - 445) / 170, 0, 0.85);
      c.copy(ridgeStone).lerp(ridgeSnow, sMix);
    } else if (y > 260) {
      const rMix = clamp((y - 260) / 160, 0, 1);
      c.copy(forestHigh).lerp(ridgeStone, rMix);
    } else {
      c.copy(tone > 0 ? forestHigh : forestLow);
    }
    oColors[i * 3] = c.r;
    oColors[i * 3 + 1] = c.g;
    oColors[i * 3 + 2] = c.b;
  }
  outerGeo.setAttribute('color', new THREE.BufferAttribute(oColors, 3));
  outerGeo.computeVertexNormals();

  const outerTerrainMat = new THREE.MeshStandardMaterial({
    map: textures.terrainMap,
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.01,
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerTerrainMat);
  root.add(outerMesh);

  // 2. Phewa Lake Water Plane (Pokhara)
  const waterGeo = new THREE.CircleGeometry(PHEWA_LAKE_RADIUS - 3, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e7490,
    roughness: 0.14,
    metalness: 0.25,
    clearcoat: 0.9,
    transparent: true,
    opacity: 0.88,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(PHEWA_LAKE_CENTER.x, PHEWA_WATER_Y, PHEWA_LAKE_CENTER.z);
  root.add(waterMesh);

  // Colorful Pokhara wooden boats on Phewa Lake
  const boatColors = [0xdc2626, 0x2563eb, 0xeab308, 0x059669];
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.42, 3.6),
      new THREE.MeshStandardMaterial({ color: boatColors[i % boatColors.length], roughness: 0.55 })
    );
    boat.add(hull);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.08, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 })
    );
    canopy.position.y = 0.7;
    boat.add(canopy);
    const angle = 0.4 + i * 0.6;
    const rad = 28 + (i % 3) * 18;
    boat.position.set(
      PHEWA_LAKE_CENTER.x + Math.cos(angle) * rad,
      PHEWA_WATER_Y + 0.14,
      PHEWA_LAKE_CENTER.z + Math.sin(angle) * rad
    );
    boat.rotation.y = angle + Math.PI / 2;
    root.add(boat);
  }

  // 3. Connected Road Ribbons with Grounded Shoulder Embankment Skirts (Zero Floating Roads)
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltMap,
    bumpMap: textures.asphaltBump,
    bumpScale: 0.04,
    roughness: 0.78,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const gravelMat = new THREE.MeshStandardMaterial({
    map: textures.gravelMap,
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const bridgeMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    roughness: 0.85,
  });
  const embankmentMat = new THREE.MeshStandardMaterial({
    color: 0x4b4336,
    roughness: 0.95,
    metalness: 0.01,
  });

  for (const road of ROAD_NETWORK) {
    const nodes = road.nodes;
    const segCount = road.closed ? nodes.length : nodes.length - 1;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const skirtPos: number[] = [];
    const skirtIdx: number[] = [];
    let vertOffset = 0;
    let skirtOffset = 0;

    for (let s = 0; s < segCount; s++) {
      const a = nodes[s];
      const b = nodes[(s + 1) % nodes.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;

      const subSteps = Math.max(2, Math.ceil(len / 3.5));
      const nx = -dz / len;
      const nz = dx / len;
      const hw = road.width * 0.5;
      const skirtOut = hw + 1.15;

      for (let k = 0; k <= subSteps; k++) {
        const t = k / subSteps;
        const cx = a.x + dx * t;
        const cz = a.z + dz * t;
        const cy = a.y + (b.y - a.y) * t + 0.14;
        const vCoord = (t * len) / 14;

        const lx = cx - nx * hw;
        const lz = cz - nz * hw;
        const rx = cx + nx * hw;
        const rz = cz + nz * hw;

        positions.push(lx, cy, lz);
        positions.push(rx, cy, rz);
        uvs.push(0, vCoord, 1, vCoord);

        if (k < subSteps) {
          const base = vertOffset + k * 2;
          indices.push(base, base + 1, base + 2);
          indices.push(base + 1, base + 3, base + 2);
        }

        if (road.surface !== 'bridge') {
          const slx = cx - nx * skirtOut;
          const slz = cz - nz * skirtOut;
          const srx = cx + nx * skirtOut;
          const srz = cz + nz * skirtOut;
          skirtPos.push(slx, cy - 0.65, slz);
          skirtPos.push(lx, cy - 0.01, lz);
          skirtPos.push(rx, cy - 0.01, rz);
          skirtPos.push(srx, cy - 0.65, srz);

          if (k < subSteps) {
            const sb = skirtOffset + k * 4;
            skirtIdx.push(sb, sb + 1, sb + 4, sb + 1, sb + 5, sb + 4);
            skirtIdx.push(sb + 2, sb + 3, sb + 6, sb + 3, sb + 7, sb + 6);
          }
        }
      }
      vertOffset += (subSteps + 1) * 2;
      if (road.surface !== 'bridge') {
        skirtOffset += (subSteps + 1) * 4;
      }
    }

    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    rGeo.setIndex(indices);
    rGeo.computeVertexNormals();

    const mat =
      road.surface === 'asphalt'
        ? asphaltMat
        : road.surface === 'bridge'
        ? bridgeMat
        : gravelMat;
    const rMesh = new THREE.Mesh(rGeo, mat);
    rMesh.receiveShadow = true;
    root.add(rMesh);

    if (skirtPos.length > 0) {
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
      sGeo.setIndex(skirtIdx);
      sGeo.computeVertexNormals();
      const sMesh = new THREE.Mesh(sGeo, embankmentMat);
      sMesh.receiveShadow = true;
      root.add(sMesh);
    }
  }

  // 4. Stunt Ramps
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.55 });
  const rampTrimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
  for (const ramp of STUNT_RAMPS) {
    const grp = new THREE.Group();
    const baseY = getTerrainHeight(ramp.x, ramp.z) - ramp.height * 0.25;
    grp.position.set(ramp.x, Math.max(0, baseY), ramp.z);
    grp.rotation.y = ramp.heading;

    const slopeLen = Math.hypot(ramp.length, ramp.height);
    const angle = Math.atan2(ramp.height, ramp.length);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(ramp.width, 0.3, slopeLen), rampMat);
    deck.position.set(0, ramp.height * 0.42, 0);
    deck.rotation.x = angle;
    deck.castShadow = true;
    deck.receiveShadow = true;
    grp.add(deck);

    const lip = new THREE.Mesh(new THREE.BoxGeometry(ramp.width + 0.2, 0.35, 0.45), rampTrimMat);
    lip.position.set(0, ramp.height * 0.86, -ramp.length * 0.48);
    grp.add(lip);
    root.add(grp);
  }

  // 5. Iconic Nepal Architecture & Landmarks
  const kathmandu = buildKathmanduCity(root, textures, quality, prayerFlags);
  buildSuspensionBridge(root);
  buildHimalayanGateway(root, 0, -290, prayerFlags);
  buildSummitChorten(root, 18, -395, prayerFlags);

  // Petrol stations & Garages
  for (const lm of LANDMARKS) {
    if (lm.kind === 'petrol') {
      buildPetrolStation(root, lm.x, lm.z);
    } else if (lm.kind === 'garage') {
      buildGarageBay(root, lm.x, lm.z);
    }
  }

  // Terai & Hill Village houses
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.72 });
  const plasterMat = new THREE.MeshStandardMaterial({ color: 0xe7d8c5, roughness: 0.88 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
  const ruralSpots = [
    [42, 260], [-36, 260], [115, 298], [-165, 260], [250, -56], [278, -28], [308, -68], [-212, 42], [-212, 8],
  ];
  for (let i = 0; i < ruralSpots.length; i++) {
    const [hx, hz] = ruralSpots[i];
    const hy = getTerrainHeight(hx, hz);
    const house = new THREE.Group();
    house.position.set(hx, hy, hz);
    const wallMat = hx > 150 ? stoneMat : plasterMat;
    const base = new THREE.Mesh(new THREE.BoxGeometry(7, 4.2, 6), wallMat);
    base.position.y = 2.1;
    base.castShadow = true;
    house.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.2, 4), roofMat);
    roof.position.y = 5.2;
    roof.rotation.y = Math.PI / 4;
    house.add(roof);
    root.add(house);
  }

  // 6. Multi-Layered 3D Pine & Broadleaf Trees + Wild Shrubs (NO Black Triangle Cones)
  const pineCount = quality === 'low' ? 95 : 190;
  const broadleafCount = quality === 'low' ? 75 : 150;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.92 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84 });

  // Pine / Himalayan Deodar: trunk + 3 overlapping sculpted foliage clusters
  const pineTrunkGeo = new THREE.CylinderGeometry(0.18, 0.36, 3.6, 7);
  pineTrunkGeo.translate(0, 1.8, 0);
  const pineTier1Geo = new THREE.IcosahedronGeometry(1.75, 1);
  pineTier1Geo.scale(1.1, 0.72, 1.1);
  pineTier1Geo.translate(0, 3.5, 0);
  const pineTier2Geo = new THREE.IcosahedronGeometry(1.32, 1);
  pineTier2Geo.scale(1.05, 0.78, 1.05);
  pineTier2Geo.translate(0.12, 4.95, -0.08);
  const pineTier3Geo = new THREE.IcosahedronGeometry(0.85, 1);
  pineTier3Geo.scale(0.95, 0.9, 0.95);
  pineTier3Geo.translate(-0.08, 6.2, 0.08);

  const pineTrunks = new THREE.InstancedMesh(pineTrunkGeo, trunkMat, pineCount);
  const pineTier1 = new THREE.InstancedMesh(pineTier1Geo, foliageMat, pineCount);
  const pineTier2 = new THREE.InstancedMesh(pineTier2Geo, foliageMat, pineCount);
  const pineTier3 = new THREE.InstancedMesh(pineTier3Geo, foliageMat, pineCount);
  pineTrunks.castShadow = quality === 'high';
  pineTier1.castShadow = quality !== 'low';
  pineTier2.castShadow = quality !== 'low';

  // Broadleaf Sal / Banyan: trunk + 3 organic asymmetric canopy lobes
  const broadTrunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 2.8, 7);
  broadTrunkGeo.translate(0, 1.4, 0);
  const broadLobe1Geo = new THREE.IcosahedronGeometry(1.9, 1);
  broadLobe1Geo.scale(1.15, 0.85, 1.1);
  broadLobe1Geo.translate(0, 3.9, 0);
  const broadLobe2Geo = new THREE.IcosahedronGeometry(1.4, 1);
  broadLobe2Geo.translate(1.0, 3.45, 0.55);
  const broadLobe3Geo = new THREE.IcosahedronGeometry(1.32, 1);
  broadLobe3Geo.translate(-0.95, 3.55, -0.5);

  const broadTrunks = new THREE.InstancedMesh(broadTrunkGeo, trunkMat, broadleafCount);
  const broadLobe1 = new THREE.InstancedMesh(broadLobe1Geo, foliageMat, broadleafCount);
  const broadLobe2 = new THREE.InstancedMesh(broadLobe2Geo, foliageMat, broadleafCount);
  const broadLobe3 = new THREE.InstancedMesh(broadLobe3Geo, foliageMat, broadleafCount);
  broadTrunks.castShadow = quality === 'high';
  broadLobe1.castShadow = quality !== 'low';

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const pinePalette = [0x2a663b, 0x337241, 0x3b7c47, 0x2f693e];
  const broadPalette = [0x3b7a3c, 0x498842, 0x356c36, 0x528d45];

  let pPlaced = 0;
  let bPlaced = 0;
  let attempt = 0;
  const maxAttempts = (pineCount + broadleafCount) * 8;
  while ((pPlaced < pineCount || bPlaced < broadleafCount) && attempt < maxAttempts) {
    attempt++;
    const s1 = Math.sin(attempt * 12.9898) * 43758.5453;
    const s2 = Math.sin(attempt * 78.233) * 43758.5453;
    const rx = ((s1 - Math.floor(s1)) * 2 - 1) * 460;
    const rz = ((s2 - Math.floor(s2)) * 2 - 1) * 460;

    const road = getRoadSample(rx, rz);
    if (road.dist < road.width * 0.95 + 4.2) continue;
    // Kathmandu has its own dedicated urban trees & chautaras
    if (Math.hypot(rx, rz - 20) < 126) continue;
    const lakeDist = Math.hypot(rx - PHEWA_LAKE_CENTER.x, rz - PHEWA_LAKE_CENTER.z);
    if (lakeDist < PHEWA_LAKE_RADIUS + 7) continue;

    const y = getTerrainHeight(rx, rz);
    if (y > 54) continue;

    const isMountainPine = y > 18 || rz < -80;
    const scale = 0.85 + ((attempt % 7) * 0.085);
    dummy.position.set(rx, y - 0.14, rz);
    dummy.rotation.set(0, attempt * 0.7, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();

    if (isMountainPine && pPlaced < pineCount) {
      pineTrunks.setMatrixAt(pPlaced, dummy.matrix);
      pineTier1.setMatrixAt(pPlaced, dummy.matrix);
      pineTier2.setMatrixAt(pPlaced, dummy.matrix);
      pineTier3.setMatrixAt(pPlaced, dummy.matrix);
      tint.setHex(pinePalette[pPlaced % pinePalette.length]);
      pineTier1.setColorAt(pPlaced, tint);
      tint.offsetHSL(0, 0.02, 0.04);
      pineTier2.setColorAt(pPlaced, tint);
      tint.offsetHSL(0, 0.02, 0.04);
      pineTier3.setColorAt(pPlaced, tint);
      pPlaced++;
    } else if (!isMountainPine && bPlaced < broadleafCount) {
      broadTrunks.setMatrixAt(bPlaced, dummy.matrix);
      broadLobe1.setMatrixAt(bPlaced, dummy.matrix);
      broadLobe2.setMatrixAt(bPlaced, dummy.matrix);
      broadLobe3.setMatrixAt(bPlaced, dummy.matrix);
      tint.setHex(broadPalette[bPlaced % broadPalette.length]);
      broadLobe1.setColorAt(bPlaced, tint);
      tint.offsetHSL(0.01, 0, 0.03);
      broadLobe2.setColorAt(bPlaced, tint);
      tint.offsetHSL(-0.01, 0, -0.02);
      broadLobe3.setColorAt(bPlaced, tint);
      bPlaced++;
    } else if (pPlaced < pineCount) {
      pineTrunks.setMatrixAt(pPlaced, dummy.matrix);
      pineTier1.setMatrixAt(pPlaced, dummy.matrix);
      pineTier2.setMatrixAt(pPlaced, dummy.matrix);
      pineTier3.setMatrixAt(pPlaced, dummy.matrix);
      tint.setHex(pinePalette[pPlaced % pinePalette.length]);
      pineTier1.setColorAt(pPlaced, tint);
      pineTier2.setColorAt(pPlaced, tint);
      pineTier3.setColorAt(pPlaced, tint);
      pPlaced++;
    }
  }

  pineTrunks.count = pPlaced;
  pineTier1.count = pPlaced;
  pineTier2.count = pPlaced;
  pineTier3.count = pPlaced;
  for (const m of [pineTrunks, pineTier1, pineTier2, pineTier3]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    root.add(m);
  }

  broadTrunks.count = bPlaced;
  broadLobe1.count = bPlaced;
  broadLobe2.count = bPlaced;
  broadLobe3.count = bPlaced;
  for (const m of [broadTrunks, broadLobe1, broadLobe2, broadLobe3]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    root.add(m);
  }

  // Natural Countryside Shrubs & Hillside Bushes
  const shrubCount = quality === 'low' ? 140 : 280;
  const wildShrubGeo = new THREE.IcosahedronGeometry(0.75, 0);
  wildShrubGeo.scale(1.2, 0.72, 1.2);
  wildShrubGeo.translate(0, 0.4, 0);
  const wildShrubs = new THREE.InstancedMesh(wildShrubGeo, foliageMat, shrubCount);
  let sPlaced = 0;
  let sAttempt = 0;
  while (sPlaced < shrubCount && sAttempt < shrubCount * 6) {
    sAttempt++;
    const s1 = Math.sin(sAttempt * 31.415) * 43758.5453;
    const s2 = Math.sin(sAttempt * 93.133) * 43758.5453;
    const sx = ((s1 - Math.floor(s1)) * 2 - 1) * 440;
    const sz = ((s2 - Math.floor(s2)) * 2 - 1) * 440;
    const road = getRoadSample(sx, sz);
    if (road.dist < road.width * 0.7 + 2.2) continue;
    if (Math.hypot(sx, sz - 20) < 120) continue;
    if (Math.hypot(sx - PHEWA_LAKE_CENTER.x, sz - PHEWA_LAKE_CENTER.z) < PHEWA_LAKE_RADIUS + 4) continue;
    const y = getTerrainHeight(sx, sz);
    if (y > 62) continue;

    dummy.position.set(sx, y - 0.08, sz);
    dummy.rotation.set(0, sAttempt * 1.1, 0);
    dummy.scale.setScalar(0.75 + (sAttempt % 5) * 0.22);
    dummy.updateMatrix();
    wildShrubs.setMatrixAt(sPlaced, dummy.matrix);
    tint.setHex(sPlaced % 2 === 0 ? 0x457d32 : 0x528839);
    wildShrubs.setColorAt(sPlaced, tint);
    sPlaced++;
  }
  wildShrubs.count = sPlaced;
  wildShrubs.instanceMatrix.needsUpdate = true;
  if (wildShrubs.instanceColor) wildShrubs.instanceColor.needsUpdate = true;
  wildShrubs.computeBoundingSphere();
  root.add(wildShrubs);

  // 7. Mission Checkpoint & GPS Beacons
  const checkpointBeacon = createBeaconGroup(0xf59e0b, 6.5);
  checkpointBeacon.visible = false;
  root.add(checkpointBeacon);

  const gpsBeacon = createBeaconGroup(0x06b6d4, 4.2);
  gpsBeacon.visible = false;
  root.add(gpsBeacon);

  return {
    root,
    checkpointBeacon,
    gpsBeacon,
    prayerFlags,
    waterMesh,
    setAtmosphere: (horizonHex: number, zenithHex: number) => {
      skyUniforms.uHorizonColor.value.setHex(horizonHex);
      skyUniforms.uZenithColor.value.setHex(zenithHex);
    },
    update: (elapsed: number, playerX = 0, playerZ = 54) => {
      kathmandu.update(elapsed, playerX, playerZ);
      for (let i = 0; i < prayerFlags.length; i++) {
        prayerFlags[i].rotation.z = Math.sin(elapsed * 3.2 + i) * 0.16;
      }
      if (checkpointBeacon.visible) {
        checkpointBeacon.children[0].rotation.y = elapsed * 2.2;
      }
      if (gpsBeacon.visible) {
        gpsBeacon.children[0].rotation.y = -elapsed * 1.8;
      }
    },
    setQuality: (q: GraphicsQuality) => {
      kathmandu.setQuality(q);
      pineTier1.castShadow = q !== 'low';
      pineTier2.castShadow = q !== 'low';
      broadLobe1.castShadow = q !== 'low';
      pineTrunks.castShadow = q === 'high';
      broadTrunks.castShadow = q === 'high';
    },
  };
}

function createBeaconGroup(colorHex: number, radius: number): THREE.Group {
  const grp = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.28, 10, 32),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.6;
  grp.add(ring);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 1.4, 32, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beam.position.y = 16;
  grp.add(beam);
  return grp;
}


function buildSuspensionBridge(root: THREE.Group): void {
  const grp = new THREE.Group();
  const ax = 192;
  const az = -28;
  const bx = 222;
  const bz = -33;
  const deckY = 18.8;

  const towerMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.6, roughness: 0.4 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.35 });

  for (const [tx, tz] of [
    [ax, az],
    [bx, bz],
  ]) {
    for (const side of [-3.8, 3.8]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.5, 0.5), towerMat);
      pylon.position.set(tx, deckY + 3.8, tz + side);
      pylon.castShadow = true;
      grp.add(pylon);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 8.2), towerMat);
    cross.position.set(tx, deckY + 7.8, tz);
    grp.add(cross);
  }

  for (const side of [-3.8, 3.8]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ax, deckY + 7.6, az + side),
      new THREE.Vector3((ax + bx) * 0.5, deckY + 3.2, (az + bz) * 0.5 + side),
      new THREE.Vector3(bx, deckY + 7.6, bz + side),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.12, 6, false), cableMat);
    grp.add(cable);
  }

  root.add(grp);
}

function buildHimalayanGateway(
  root: THREE.Group,
  x: number,
  z: number,
  prayerFlags: THREE.Mesh[]
): void {
  const grp = new THREE.Group();
  grp.position.set(x, getTerrainHeight(x, z), z);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.92 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });

  for (const sx of [-6.2, 6.2]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.8, 2.2), stoneMat);
    pillar.position.set(sx, 3.4, 0);
    pillar.castShadow = true;
    grp.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(15.2, 1.6, 2.6), trimMat);
  lintel.position.set(0, 7.2, 0);
  lintel.castShadow = true;
  grp.add(lintel);

  const flagColors = [0x2563eb, 0xf8fafc, 0xdc2626, 0x16a34a, 0xeab308];
  for (let i = -4; i <= 4; i++) {
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.45),
      new THREE.MeshBasicMaterial({ color: flagColors[(i + 5) % 5], side: THREE.DoubleSide })
    );
    flag.position.set(i * 1.1, 6.1, 0);
    grp.add(flag);
    prayerFlags.push(flag);
  }

  root.add(grp);
}

function buildSummitChorten(
  root: THREE.Group,
  x: number,
  z: number,
  prayerFlags: THREE.Mesh[]
): void {
  const grp = new THREE.Group();
  grp.position.set(x + 11, getTerrainHeight(x + 11, z), z);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.2, 4.6), stoneMat);
  plinth.position.y = 1.1;
  grp.add(plinth);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.2, 12), stoneMat);
  dome.position.y = 3.2;
  grp.add(dome);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 10), goldMat);
  spire.position.y = 5.4;
  grp.add(spire);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xdc2626, side: THREE.DoubleSide })
  );
  flag.position.set(0, 6.6, 0);
  grp.add(flag);
  prayerFlags.push(flag);
  root.add(grp);
}

function buildPetrolStation(root: THREE.Group, x: number, z: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, getTerrainHeight(x, z), z);

  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.22, 10),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 })
  );
  pad.position.y = 0.11;
  grp.add(pad);

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 })
  );
  canopy.position.y = 4.6;
  canopy.castShadow = true;
  grp.add(canopy);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  for (const px of [-4.2, 4.2]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.4, 10), pillarMat);
    p.position.set(px, 2.3, 0);
    grp.add(p);
  }

  const pumpMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3 });
  for (const px of [-1.8, 1.8]) {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.7, 0.65), pumpMat);
    pump.position.set(px, 1.05, 0);
    grp.add(pump);
  }

  root.add(grp);
}

function buildGarageBay(root: THREE.Group, x: number, z: number): void {
  const grp = new THREE.Group();
  grp.position.set(x, getTerrainHeight(x, z), z);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78 });
  const brickBaseMat = new THREE.MeshStandardMaterial({ color: 0x7c3f2c, roughness: 0.84 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.6 });
  const winMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.25, metalness: 0.35 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45 });

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.35, 9.6), trimMat);
  plinth.position.y = 0.17;
  grp.add(plinth);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(11, 5.2, 0.6), wallMat);
  backWall.position.set(0, 2.6, -4.5);
  grp.add(backWall);

  for (const sx of [-5.2, 5.2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5.2, 9), wallMat);
    side.position.set(sx, 2.6, 0);
    grp.add(side);

    const dado = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.35, 9.06), brickBaseMat);
    dado.position.set(sx, 0.9, 0);
    grp.add(dado);

    const sideBand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.38, 9.1), trimMat);
    sideBand.position.set(sx, 1.65, 0);
    grp.add(sideBand);

    for (const wz of [-2.4, 0, 2.4]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.25, 1.5), winMat);
      win.position.set(sx, 3.25, wz);
      grp.add(win);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.5, 9.6), roofMat);
  roof.position.y = 5.3;
  roof.castShadow = true;
  grp.add(roof);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 1.1, 0.25),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.6 })
  );
  sign.position.set(0, 4.9, 4.8);
  grp.add(sign);

  root.add(grp);
}
