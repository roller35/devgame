import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  gravelMap: THREE.CanvasTexture;
  terrainMap: THREE.CanvasTexture;
  brickMap: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  modernFacadeMap: THREE.CanvasTexture;
  plasterFacadeMap: THREE.CanvasTexture;
  roofTileMap: THREE.CanvasTexture;
  shutterMap: THREE.CanvasTexture;
  zebraMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  createSignTexture: (nepali: string, english: string, bgHex: string, accentHex: string) => THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));
  const extraTextures: THREE.CanvasTexture[] = [];

  // 1. Nepali Asphalt Road (with centerline dashes & edge lines)
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#2b2e33';
  actx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 34 + Math.floor(Math.random() * 32);
    actx.fillStyle = `rgb(${v},${v},${v + 3})`;
    actx.fillRect(x, y, 2, 2);
  }
  actx.fillStyle = 'rgba(18, 20, 24, 0.28)';
  actx.fillRect(108, 0, 74, 512);
  actx.fillRect(330, 0, 74, 512);
  actx.fillStyle = '#e5e7eb';
  actx.fillRect(20, 0, 10, 512);
  actx.fillRect(482, 0, 10, 512);
  actx.fillStyle = '#facc15';
  actx.fillRect(250, 24, 12, 180);
  actx.fillRect(250, 280, 12, 180);

  const asphaltMap = new THREE.CanvasTexture(asphaltCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.anisotropy = aniso;

  // 2. Asphalt Micro-relief Bump Map (linear space)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4500; i++) {
    const g = 90 + Math.floor(Math.random() * 80);
    bctx.fillStyle = `rgb(${g},${g},${g})`;
    bctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const asphaltBump = new THREE.CanvasTexture(bumpCanvas);
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.anisotropy = aniso;

  // 3. Gravel / Mountain Dirt Track
  const gravelCanvas = document.createElement('canvas');
  gravelCanvas.width = 256;
  gravelCanvas.height = 256;
  const gctx = gravelCanvas.getContext('2d')!;
  gctx.fillStyle = '#7c6652';
  gctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3600; i++) {
    const r = 95 + Math.floor(Math.random() * 55);
    const g = Math.floor(r * 0.82);
    const b = Math.floor(r * 0.65);
    gctx.fillStyle = `rgb(${r},${g},${b})`;
    gctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const gravelMap = new THREE.CanvasTexture(gravelCanvas);
  gravelMap.colorSpace = THREE.SRGBColorSpace;
  gravelMap.wrapS = THREE.RepeatWrapping;
  gravelMap.wrapT = THREE.RepeatWrapping;
  gravelMap.anisotropy = aniso;

  // 3b. Natural Terrain Surface Grain (tileable grass, earth & rock micro-texture for vertex-colored terrain)
  const terrCanvas = document.createElement('canvas');
  terrCanvas.width = 256;
  terrCanvas.height = 256;
  const tctx = terrCanvas.getContext('2d')!;
  tctx.fillStyle = '#babba8';
  tctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const shade = 135 + Math.floor(Math.random() * 68);
    tctx.fillStyle = `rgb(${shade},${shade + 5},${shade - 8})`;
    tctx.fillRect(x, y, 3, 3);
  }
  for (let i = 0; i < 800; i++) {
    tctx.fillStyle = i % 2 === 0 ? 'rgba(42, 58, 32, 0.22)' : 'rgba(110, 95, 70, 0.16)';
    tctx.fillRect(Math.random() * 256, Math.random() * 256, 8, 4);
  }
  const terrainMap = new THREE.CanvasTexture(terrCanvas);
  terrainMap.colorSpace = THREE.SRGBColorSpace;
  terrainMap.wrapS = THREE.RepeatWrapping;
  terrainMap.wrapT = THREE.RepeatWrapping;
  terrainMap.repeat.set(56, 56);
  terrainMap.anisotropy = aniso;

  // 4. Newari Terracotta Brick (Dachi Appa style with crisp courses and weathering)
  const brickCanvas = document.createElement('canvas');
  brickCanvas.width = 256;
  brickCanvas.height = 256;
  const brctx = brickCanvas.getContext('2d')!;
  brctx.fillStyle = '#8b3a29';
  brctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 20; row++) {
    const y = row * 12.8;
    brctx.fillStyle = '#522218';
    brctx.fillRect(0, y, 256, 2);
    const offset = (row % 2) * 16;
    for (let col = -1; col < 9; col++) {
      const x = col * 32 + offset;
      const shade = (row * 7 + col * 13) % 5;
      brctx.fillStyle =
        shade === 0 ? '#a14431' : shade === 1 ? '#782f22' : shade === 2 ? '#923a29' : '#853526';
      brctx.fillRect(x + 1.5, y + 1.5, 29, 9.8);
    }
  }
  for (let i = 0; i < 1100; i++) {
    brctx.fillStyle = i % 2 === 0 ? 'rgba(35,15,10,0.18)' : 'rgba(215,155,125,0.08)';
    brctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const brickMap = new THREE.CanvasTexture(brickCanvas);
  brickMap.colorSpace = THREE.SRGBColorSpace;
  brickMap.wrapS = THREE.RepeatWrapping;
  brickMap.wrapT = THREE.RepeatWrapping;
  brickMap.anisotropy = aniso;

  // 5. Kathmandu Interlocking Sidewalk & Curb Pavers
  const sidewalkCanvas = document.createElement('canvas');
  sidewalkCanvas.width = 256;
  sidewalkCanvas.height = 256;
  const swctx = sidewalkCanvas.getContext('2d')!;
  swctx.fillStyle = '#808892';
  swctx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const alt = (r + c) % 4 === 0;
      swctx.fillStyle = alt ? '#855a49' : (r + c) % 2 === 0 ? '#9ca3af' : '#8f98a6';
      swctx.fillRect(c * 32 + 2, r * 32 + 2, 28, 28);
    }
  }
  const sidewalkMap = new THREE.CanvasTexture(sidewalkCanvas);
  sidewalkMap.colorSpace = THREE.SRGBColorSpace;
  sidewalkMap.wrapS = THREE.RepeatWrapping;
  sidewalkMap.wrapT = THREE.RepeatWrapping;
  sidewalkMap.repeat.set(2, 2);
  sidewalkMap.anisotropy = aniso;

  // 6. Modern Kathmandu Commercial Curtain-Wall & Concrete Spandrel Grid (512x512)
  const modCanvas = document.createElement('canvas');
  modCanvas.width = 512;
  modCanvas.height = 512;
  const mctx = modCanvas.getContext('2d')!;
  mctx.fillStyle = '#9aa5b4';
  mctx.fillRect(0, 0, 512, 512);
  for (let floor = 0; floor < 4; floor++) {
    const fy = floor * 128;
    // Spandrel concrete band + shadow drip lip
    mctx.fillStyle = '#7c8798';
    mctx.fillRect(0, fy, 512, 26);
    mctx.fillStyle = '#475569';
    mctx.fillRect(0, fy + 24, 512, 5);
    for (let bay = 0; bay < 4; bay++) {
      const bx = bay * 128 + 10;
      mctx.fillStyle = '#1e293b';
      mctx.fillRect(bx - 3, fy + 28, 114, 92);
      const grad = mctx.createLinearGradient(bx, fy + 32, bx + 108, fy + 116);
      grad.addColorStop(0, '#0f2744');
      grad.addColorStop(0.45, '#1d4b6e');
      grad.addColorStop(1, '#0b1b30');
      mctx.fillStyle = grad;
      mctx.fillRect(bx, fy + 32, 108, 84);
      // Aluminum mullions
      mctx.fillStyle = '#64748b';
      mctx.fillRect(bx + 52, fy + 32, 4, 84);
      mctx.fillRect(bx, fy + 74, 108, 3);
      // Interior blinds / warm office glow variation
      if ((floor * 3 + bay) % 3 === 0) {
        mctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
        mctx.fillRect(bx + 6, fy + 36, 42, 34);
      } else if ((floor + bay) % 2 === 0) {
        mctx.fillStyle = 'rgba(186, 230, 253, 0.16)';
        mctx.fillRect(bx + 58, fy + 36, 44, 24);
      }
    }
  }
  const modernFacadeMap = new THREE.CanvasTexture(modCanvas);
  modernFacadeMap.colorSpace = THREE.SRGBColorSpace;
  modernFacadeMap.wrapS = THREE.RepeatWrapping;
  modernFacadeMap.wrapT = THREE.RepeatWrapping;
  modernFacadeMap.anisotropy = aniso;

  // 7. Plaster Residential & Mixed-Use Facade with Framed Shuttered Windows (512x512)
  const plasterCanvas = document.createElement('canvas');
  plasterCanvas.width = 512;
  plasterCanvas.height = 512;
  const pctx = plasterCanvas.getContext('2d')!;
  pctx.fillStyle = '#cbbca4';
  pctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2400; i++) {
    pctx.fillStyle = i % 2 === 0 ? 'rgba(95,78,60,0.12)' : 'rgba(255,255,255,0.07)';
    pctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
  }
  for (let row = 0; row < 2; row++) {
    const wy = row * 256 + 48;
    // Floor molding band
    pctx.fillStyle = '#8b4e1e';
    pctx.fillRect(0, row * 256, 512, 16);
    for (let col = 0; col < 3; col++) {
      const wx = col * 170 + 28;
      // Timber/concrete window lintel + frame
      pctx.fillStyle = '#4a2e19';
      pctx.fillRect(wx - 6, wy - 10, 122, 12);
      pctx.fillStyle = '#362113';
      pctx.fillRect(wx, wy, 110, 148);
      pctx.fillStyle = '#132030';
      pctx.fillRect(wx + 10, wy + 10, 90, 128);
      if ((row + col) % 2 === 0) {
        pctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
        pctx.fillRect(wx + 14, wy + 16, 36, 52);
      }
      pctx.fillStyle = '#6b4226';
      pctx.fillRect(wx + 53, wy + 10, 5, 128);
      pctx.fillRect(wx + 10, wy + 70, 90, 5);
      // Sill
      pctx.fillStyle = '#7c8591';
      pctx.fillRect(wx - 4, wy + 148, 118, 10);
    }
  }
  const plasterFacadeMap = new THREE.CanvasTexture(plasterCanvas);
  plasterFacadeMap.colorSpace = THREE.SRGBColorSpace;
  plasterFacadeMap.wrapS = THREE.RepeatWrapping;
  plasterFacadeMap.wrapT = THREE.RepeatWrapping;
  plasterFacadeMap.anisotropy = aniso;

  // 8. Traditional Terracotta Jhingati Roof Tile Pattern
  const roofCanvas = document.createElement('canvas');
  roofCanvas.width = 256;
  roofCanvas.height = 256;
  const rctx = roofCanvas.getContext('2d')!;
  rctx.fillStyle = '#6d2817';
  rctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    const y = row * 16;
    rctx.fillStyle = '#43160c';
    rctx.fillRect(0, y, 256, 3);
    for (let col = 0; col < 16; col++) {
      rctx.fillStyle = col % 2 === 0 ? '#7c2d12' : '#652310';
      rctx.fillRect(col * 16 + 1, y + 3, 13, 13);
    }
  }
  const roofTileMap = new THREE.CanvasTexture(roofCanvas);
  roofTileMap.colorSpace = THREE.SRGBColorSpace;
  roofTileMap.wrapS = THREE.RepeatWrapping;
  roofTileMap.wrapT = THREE.RepeatWrapping;
  roofTileMap.anisotropy = aniso;

  // 8b. Nepali Corrugated Metal Rolling Shop Shutter
  const shutCanvas = document.createElement('canvas');
  shutCanvas.width = 256;
  shutCanvas.height = 256;
  const shctx = shutCanvas.getContext('2d')!;
  shctx.fillStyle = '#475569';
  shctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 12) {
    shctx.fillStyle = '#64748b';
    shctx.fillRect(0, y, 256, 6);
    shctx.fillStyle = '#334155';
    shctx.fillRect(0, y + 6, 256, 4);
    shctx.fillStyle = '#1e293b';
    shctx.fillRect(0, y + 10, 256, 2);
  }
  shctx.fillStyle = '#1e293b';
  shctx.fillRect(124, 0, 8, 256);
  shctx.fillStyle = '#94a3b8';
  shctx.fillRect(0, 232, 256, 24);
  const shutterMap = new THREE.CanvasTexture(shutCanvas);
  shutterMap.colorSpace = THREE.SRGBColorSpace;
  shutterMap.wrapS = THREE.RepeatWrapping;
  shutterMap.wrapT = THREE.RepeatWrapping;
  shutterMap.anisotropy = aniso;

  // 9. Zebra Pedestrian Crossing Decal
  const zebraCanvas = document.createElement('canvas');
  zebraCanvas.width = 256;
  zebraCanvas.height = 128;
  const zctx = zebraCanvas.getContext('2d')!;
  zctx.clearRect(0, 0, 256, 128);
  zctx.fillStyle = '#f8fafc';
  for (let i = 0; i < 6; i++) {
    zctx.fillRect(i * 42 + 8, 10, 24, 108);
  }
  const zebraMap = new THREE.CanvasTexture(zebraCanvas);
  zebraMap.colorSpace = THREE.SRGBColorSpace;
  zebraMap.anisotropy = aniso;

  // 10. Soft Radial Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);

  const createSignTexture = (
    nepali: string,
    english: string,
    bgHex: string,
    accentHex: string
  ): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 176);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(nepali, 256, 68);

    ctx.fillStyle = accentHex;
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(english, 256, 134);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    extraTextures.push(tex);
    return tex;
  };

  return {
    asphaltMap,
    asphaltBump,
    gravelMap,
    terrainMap,
    brickMap,
    sidewalkMap,
    modernFacadeMap,
    plasterFacadeMap,
    roofTileMap,
    shutterMap,
    zebraMap,
    contactShadowMap,
    createSignTexture,
    dispose: () => {
      asphaltMap.dispose();
      asphaltBump.dispose();
      gravelMap.dispose();
      terrainMap.dispose();
      brickMap.dispose();
      sidewalkMap.dispose();
      modernFacadeMap.dispose();
      plasterFacadeMap.dispose();
      roofTileMap.dispose();
      shutterMap.dispose();
      zebraMap.dispose();
      contactShadowMap.dispose();
      for (const tex of extraTextures) tex.dispose();
    },
  };
}

export function createNumberPlateTexture(plateText: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  // Nepali red private motorcycle plate
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 240, 112);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const clean = plateText.trim().slice(0, 16) || 'BA 24 PA 4812';
  const mid = Math.ceil(clean.length / 2);
  const parts = clean.split(' ');
  if (parts.length >= 3) {
    ctx.fillText(parts.slice(0, 2).join(' '), 128, 44);
    ctx.fillText(parts.slice(2).join(' '), 128, 86);
  } else {
    ctx.fillText(clean.slice(0, mid), 128, 44);
    ctx.fillText(clean.slice(mid), 128, 86);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
