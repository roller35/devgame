import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MotorcycleAudioEngine } from './audio';
import { LANDMARKS, MISSIONS, MOTORCYCLES, REGIONS } from './catalog';
import {
  buildMotorcycleMesh,
  buildRiderMesh,
  MotorcycleMeshRig,
  RiderMeshRig,
} from './models';
import {
  createInitialBikeState,
  createInitialRiderState,
  stepBikePhysics,
  stepRiderOnFoot,
} from './physics';
import { parseSandboxCommand, persistSaveData, SandboxAction } from './sandbox';
import { getRegionAt, getRoadSample, getTerrainHeight } from './terrain';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { NepalTrafficManager } from './traffic';
import {
  ActiveMissionState,
  BikePhysicsState,
  CameraMode,
  GameScreenState,
  GameSettings,
  GraphicsQuality,
  HudSnapshot,
  MotorcycleSpecs,
  PhysicsInput,
  RegionId,
  RiderState,
  SaveData,
  TimeOfDay,
  WeatherMode,
} from './types';
import { buildNepalWorld, NepalWorldHandles } from './world';

const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _dustColor = new THREE.Color();

export class NepalRiderEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;
  private world: NepalWorldHandles;
  private traffic: NepalTrafficManager;
  private audio: MotorcycleAudioEngine;

  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;

  private bikeRig: MotorcycleMeshRig | null = null;
  private riderRig: RiderMeshRig;
  private rainPoints: THREE.Points;
  private rainPositions: Float32Array;

  private save: SaveData;
  private bikeSpecs: MotorcycleSpecs;
  private bikeState: BikePhysicsState;
  private riderState: RiderState;

  private screen: GameScreenState = 'title';
  private cameraMode: CameraMode = 'third_person';
  private headlightsOn = true;
  private weather: WeatherMode = 'sunny';
  private timeOfDay: TimeOfDay = 'morning';

  private keysHeld = new Set<string>();
  private shiftUpQueued = false;
  private shiftDownQueued = false;
  private touchInput: Partial<PhysicsInput> = {};

  private activeMission: ActiveMissionState | null = null;
  private gpsTarget: { x: number; z: number; label: string } | null = null;
  private lastMissionResult: HudSnapshot['lastMissionResult'] = null;
  private lastStuntBanner = '';
  private stuntBannerTimer = 0;
  private toastMessage = '';
  private toastTimer = 0;
  private cameraShakeTrauma = 0;

  private onHudUpdate: (snap: HudSnapshot) => void;
  private onSaveUpdate: (save: SaveData) => void;

  private frameId = 0;
  private timeoutId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private elapsed = 0;
  private hudThrottle = 0;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialSave: SaveData,
    initialScreen: GameScreenState,
    callbacks: {
      onHudUpdate: (snap: HudSnapshot) => void;
      onSaveUpdate: (save: SaveData) => void;
      onShortcutKey: (key: string) => void;
    }
  ) {
    this.container = container;
    this.save = initialSave;
    this.screen = initialScreen;
    this.onHudUpdate = callbacks.onHudUpdate;
    this.onSaveUpdate = callbacks.onSaveUpdate;

    // 1. Software-WebGL Detection (never change scene content, only render cost)
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = Math.max(320, container.clientWidth || window.innerWidth);
    const height = Math.max(200, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && initialSave.settings.graphicsQuality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio, initialSave.settings.graphicsQuality === 'low' ? 1 : 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && initialSave.settings.graphicsQuality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x7cbde8, 0.00052);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x7cbde8);

    // Mandatory studio environment map for metallic chrome & tank clearcoat
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.15, 2600);

    // 3-point warm/cool outdoor lighting rig (single shadow caster)
    this.hemiLight = new THREE.HemisphereLight(0x88c7f2, 0x4b5c3e, 0.8);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
    this.keyLight.position.set(80, 120, 60);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 10;
    this.keyLight.shadow.camera.far = 320;
    const sd = 95;
    this.keyLight.shadow.camera.left = -sd;
    this.keyLight.shadow.camera.right = sd;
    this.keyLight.shadow.camera.top = sd;
    this.keyLight.shadow.camera.bottom = -sd;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.world = buildNepalWorld(this.textures, initialSave.settings.graphicsQuality);
    this.scene.add(this.world.root);

    this.traffic = new NepalTrafficManager(
      this.scene,
      this.textures,
      initialSave.settings.trafficDensity
    );

    this.audio = new MotorcycleAudioEngine();
    this.audio.setMuted(initialSave.settings.muted);

    // Rain particle pool (toggled during rain weather)
    const rainCount = 700;
    this.rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 60;
      this.rainPositions[i * 3 + 1] = Math.random() * 28;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainPoints = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.22, transparent: true, opacity: 0.65 })
    );
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // Initialize bike & rider at Kathmandu spawn facing North (-Z) toward Durbar Pagoda & Himalayas
    this.bikeSpecs = this.resolveSpecs(this.save.selectedBikeId);
    const spawn = REGIONS[0].spawnPos;
    this.bikeState = createInitialBikeState(spawn.x, spawn.z, spawn.heading, this.bikeSpecs);
    this.riderState = createInitialRiderState(this.bikeState);

    this.riderRig = buildRiderMesh();
    this.scene.add(this.riderRig.root);
    this.rebuildBikeMesh();
    this.applyAtmosphere();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Input listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const code = e.code;
      this.keysHeld.add(code);
      this.audio.unlock();

      if (this.screen === 'playing') {
        if (code === 'KeyC') this.toggleCameraMode();
        else if (code === 'KeyE') this.toggleMount();
        else if (code === 'KeyL') this.toggleHeadlights();
        else if (code === 'KeyH') this.audio.playHorn();
        else if (code === 'KeyQ') this.shiftUpQueued = true;
        else if (code === 'KeyZ') this.shiftDownQueued = true;
        else if (code === 'KeyR') this.resetBikeOnRoad();
        else if (code === 'KeyF') this.tryRefuel();
      }
      callbacks.onShortcutKey(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysHeld.delete(e.code);
    };

    const onBlur = () => {
      this.keysHeld.clear();
      this.touchInput = {};
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    this.resizeObserver = new ResizeObserver(() => {
      const w = Math.max(320, this.container.clientWidth);
      const h = Math.max(200, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizeObserver.observe(container);

    // Cleanup hook stored on instance
    this.cleanupListeners = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      this.renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
    };

    this.syncBodyDataset();
    this.emitHud();
    this.lastTimestamp = performance.now();
    this.tick();
  }

  private cleanupListeners: () => void;

  private resolveSpecs(bikeId: string): MotorcycleSpecs {
    return MOTORCYCLES.find((b) => b.id === bikeId) ?? MOTORCYCLES[0];
  }

  private rebuildBikeMesh(): void {
    if (this.bikeRig) {
      this.scene.remove(this.bikeRig.root);
      this.bikeRig.dispose();
    }
    const cust = this.save.customizations[this.bikeSpecs.id];
    this.bikeRig = buildMotorcycleMesh(
      this.bikeSpecs,
      cust,
      this.textures,
      !this.isSoftwareGl
    );
    this.scene.add(this.bikeRig.root);
    this.syncBikeTransform();
  }

  private syncBodyDataset(): void {
    document.body.dataset.state =
      this.screen === 'title'
        ? 'title'
        : this.screen === 'playing'
        ? 'playing'
        : this.screen === 'gameover'
        ? 'gameover'
        : 'paused';
  }

  public setScreen(next: GameScreenState): void {
    this.screen = next;
    this.keysHeld.clear();
    this.touchInput = {};
    this.syncBodyDataset();
    this.syncBikeTransform();
    this.traffic.setVisible(next !== 'garage');
    if (next === 'playing') {
      this.audio.unlock();
    } else {
      this.audio.updateEngine(this.bikeSpecs.idleRpm, this.bikeSpecs, 0, 1, false);
    }
    this.emitHud();
  }

  public startFreeRoam(): void {
    this.setScreen('playing');
  }

  public toggleCameraMode(): void {
    this.cameraMode = this.cameraMode === 'third_person' ? 'first_person' : 'third_person';
    this.showToast(
      this.cameraMode === 'first_person' ? 'First-Person Handlebar Cam' : 'Third-Person Chase Cam'
    );
    this.emitHud();
  }

  public toggleHeadlights(): void {
    this.headlightsOn = !this.headlightsOn;
    if (this.bikeRig) {
      this.bikeRig.headlightMat.emissiveIntensity = this.headlightsOn ? 1.5 : 0.05;
      if (this.bikeRig.headlightBeam) {
        this.bikeRig.headlightBeam.visible = this.headlightsOn;
      }
    }
    this.emitHud();
  }

  public toggleMount(): void {
    if (this.riderState.onFoot) {
      const dist = Math.hypot(this.riderState.x - this.bikeState.x, this.riderState.z - this.bikeState.z);
      if (dist < 4.5) {
        this.riderState.onFoot = false;
        this.showToast('Mounted motorcycle');
      } else {
        this.showToast('Move closer to your motorcycle to mount');
      }
    } else {
      if (this.bikeState.speedMs > 5.0) {
        this.showToast('Slow down to dismount safely');
        return;
      }
      this.riderState.onFoot = true;
      this.riderState.x = this.bikeState.x - Math.cos(this.bikeState.heading) * 1.45;
      this.riderState.z = this.bikeState.z + Math.sin(this.bikeState.heading) * 1.45;
      this.riderState.y = getTerrainHeight(this.riderState.x, this.riderState.z);
      this.riderState.heading = this.bikeState.heading;
      this.bikeState.vx = 0;
      this.bikeState.vz = 0;
      this.bikeState.speedMs = 0;
      this.showToast('On foot — Press E near bike to remount');
    }
    this.emitHud();
  }

  public resetBikeOnRoad(): void {
    const sample = getRoadSample(this.bikeState.x, this.bikeState.z);
    this.bikeState.x = sample.nearestX;
    this.bikeState.z = sample.nearestZ;
    this.bikeState.y = getTerrainHeight(this.bikeState.x, this.bikeState.z);
    this.bikeState.vx = 0;
    this.bikeState.vy = 0;
    this.bikeState.vz = 0;
    this.bikeState.speedMs = 0;
    this.bikeState.leanAngle = 0;
    this.bikeState.pitchAngle = 0;
    this.bikeState.grounded = true;
    this.riderState.onFoot = false;
    this.traffic.clearNear(this.bikeState.x, this.bikeState.z, 12);
    this.syncBikeTransform();
    this.snapChaseCamera();
    this.showToast('Motorcycle reset upright on road');
    this.emitHud();
  }

  public tryRefuel(): void {
    const nearPetrol = LANDMARKS.some(
      (l) =>
        l.kind === 'petrol' &&
        Math.hypot(this.bikeState.x - l.x, this.bikeState.z - l.z) <= l.radius
    );
    if (nearPetrol) {
      this.bikeState.fuelL = this.bikeSpecs.fuelCapacityL;
      this.audio.playCheckpointChime(false);
      this.showToast('Tank refueled to 100%');
      this.emitHud();
    }
  }

  public setTouchInput(partial: Partial<PhysicsInput>): void {
    this.audio.unlock();
    this.touchInput = { ...this.touchInput, ...partial };
  }

  public playHorn(): void {
    this.audio.playHorn();
  }

  public selectMotorcycle(bikeId: string): void {
    if (!this.save.ownedBikeIds.includes(bikeId)) return;
    this.save = { ...this.save, selectedBikeId: bikeId };
    this.bikeSpecs = this.resolveSpecs(bikeId);
    this.bikeState.fuelL = this.bikeSpecs.fuelCapacityL;
    this.rebuildBikeMesh();
    persistSaveData(this.save);
    this.onSaveUpdate(this.save);
    this.emitHud();
  }

  public purchaseMotorcycle(bikeId: string): boolean {
    const bike = this.resolveSpecs(bikeId);
    if (this.save.ownedBikeIds.includes(bikeId)) return true;
    if (this.save.moneyNpr < bike.priceNpr) {
      this.showToast('Not enough NPR! Complete missions or stunts.');
      return false;
    }
    this.save = {
      ...this.save,
      moneyNpr: this.save.moneyNpr - bike.priceNpr,
      ownedBikeIds: [...this.save.ownedBikeIds, bikeId],
      selectedBikeId: bikeId,
    };
    this.bikeSpecs = bike;
    this.bikeState.fuelL = bike.fuelCapacityL;
    this.rebuildBikeMesh();
    persistSaveData(this.save);
    this.onSaveUpdate(this.save);
    this.audio.playCheckpointChime(true);
    this.showToast(`Purchased ${bike.name}!`);
    this.emitHud();
    return true;
  }

  public updateCustomization(
    bikeId: string,
    patch: Partial<SaveData['customizations'][string]>
  ): void {
    const current = this.save.customizations[bikeId];
    this.save = {
      ...this.save,
      customizations: {
        ...this.save.customizations,
        [bikeId]: { ...current, ...patch },
      },
    };
    if (bikeId === this.bikeSpecs.id) {
      this.rebuildBikeMesh();
    }
    persistSaveData(this.save);
    this.onSaveUpdate(this.save);
  }

  public updateSettings(patch: Partial<GameSettings>): void {
    const nextSettings = { ...this.save.settings, ...patch };
    this.save = { ...this.save, settings: nextSettings };
    this.audio.setMuted(nextSettings.muted);
    this.traffic.setDensity(nextSettings.trafficDensity);
    if (patch.graphicsQuality) {
      this.applyGraphicsQuality(patch.graphicsQuality);
    }
    persistSaveData(this.save);
    this.onSaveUpdate(this.save);
    this.emitHud();
  }

  private applyGraphicsQuality(q: GraphicsQuality): void {
    this.world.setQuality(q);
    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.enabled = q !== 'low';
      this.keyLight.castShadow = q !== 'low';
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'low' ? 1 : 2));
    }
  }

  public setWeather(w: WeatherMode): void {
    this.weather = w;
    this.applyAtmosphere();
    this.emitHud();
  }

  public setTimeOfDay(t: TimeOfDay): void {
    this.timeOfDay = t;
    if (t === 'night' || t === 'sunset') {
      this.headlightsOn = true;
    }
    this.applyAtmosphere();
    this.emitHud();
  }

  private applyAtmosphere(): void {
    const horizonColors: Record<TimeOfDay, number> = {
      sunrise: 0xf4a261,
      morning: 0x7cbde8,
      afternoon: 0x6cb2e4,
      sunset: 0xe76f51,
      night: 0x0f172a,
    };
    const zenithColors: Record<TimeOfDay, number> = {
      sunrise: 0x4a5588,
      morning: 0x2869ad,
      afternoon: 0x1e5ca0,
      sunset: 0x3b3d6d,
      night: 0x050a18,
    };
    const sky = new THREE.Color(horizonColors[this.timeOfDay]);
    const zenith = new THREE.Color(zenithColors[this.timeOfDay]);
    if (this.weather === 'cloudy') {
      sky.lerp(new THREE.Color(0x94a3b8), 0.48);
      zenith.lerp(new THREE.Color(0x64748b), 0.52);
    } else if (this.weather === 'rain') {
      sky.lerp(new THREE.Color(0x64748b), 0.65);
      zenith.lerp(new THREE.Color(0x334155), 0.7);
    } else if (this.weather === 'mist') {
      sky.lerp(new THREE.Color(0xcbd5e1), 0.62);
      zenith.lerp(new THREE.Color(0x94a3b8), 0.55);
    }

    this.scene.background = sky;
    this.fog.color.copy(sky);
    this.world.setAtmosphere(sky.getHex(), zenith.getHex());
    this.fog.density =
      this.weather === 'mist'
        ? 0.0052
        : this.weather === 'rain'
        ? 0.0028
        : this.timeOfDay === 'night'
        ? 0.0022
        : 0.00032;

    const sunIntensities: Record<TimeOfDay, number> = {
      sunrise: 1.45,
      morning: 1.85,
      afternoon: 2.0,
      sunset: 1.55,
      night: 0.38,
    };
    this.keyLight.intensity =
      sunIntensities[this.timeOfDay] * (this.weather === 'rain' || this.weather === 'cloudy' ? 0.58 : 1);
    this.hemiLight.intensity = this.timeOfDay === 'night' ? 0.42 : 0.8;

    if (this.timeOfDay === 'sunset' || this.timeOfDay === 'sunrise') {
      this.keyLight.color.setHex(0xffb478);
    } else if (this.timeOfDay === 'night') {
      this.keyLight.color.setHex(0x93c5fd);
    } else {
      this.keyLight.color.setHex(0xfff1d6);
    }

    this.rainPoints.visible = this.weather === 'rain';
  }

  public teleportToRegion(regionId: RegionId): void {
    const region = REGIONS.find((r) => r.id === regionId);
    if (!region) return;
    this.riderState.onFoot = false;
    this.bikeState = createInitialBikeState(
      region.spawnPos.x,
      region.spawnPos.z,
      region.spawnPos.heading,
      this.bikeSpecs
    );
    this.traffic.clearNear(region.spawnPos.x, region.spawnPos.z, 22);
    this.syncBikeTransform();
    this.snapChaseCamera();
    this.showToast(`Arrived at ${region.name}`);
    this.emitHud();
  }

  public setGpsTarget(target: { x: number; z: number; label: string } | null): void {
    this.gpsTarget = target;
    if (target) {
      this.world.gpsBeacon.visible = true;
      this.world.gpsBeacon.position.set(target.x, getTerrainHeight(target.x, target.z), target.z);
    } else {
      this.world.gpsBeacon.visible = false;
    }
    this.emitHud();
  }

  public startMission(missionId: string): void {
    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) return;
    this.riderState.onFoot = false;
    this.bikeState = createInitialBikeState(
      mission.startPos.x,
      mission.startPos.z,
      mission.startPos.heading,
      this.bikeSpecs
    );
    this.traffic.clearNear(mission.startPos.x, mission.startPos.z, 22);
    this.syncBikeTransform();
    this.snapChaseCamera();
    this.activeMission = {
      missionId,
      checkpointIndex: 0,
      elapsedSec: 0,
      stuntPointsEarned: 0,
      status: 'active',
    };
    this.lastMissionResult = null;
    const cp = mission.checkpoints[0];
    this.world.checkpointBeacon.visible = true;
    this.world.checkpointBeacon.position.set(cp.x, getTerrainHeight(cp.x, cp.z), cp.z);
    this.setScreen('playing');
    this.showToast(`Mission Started: ${mission.title}`);
  }

  public abandonMission(): void {
    this.activeMission = null;
    this.world.checkpointBeacon.visible = false;
    this.emitHud();
  }

  public executeSandboxCommand(raw: string): SandboxAction {
    const res = parseSandboxCommand(raw, this.save.ownedBikeIds);
    switch (res.type) {
      case 'spawn_bike':
        this.selectMotorcycle(res.bikeId);
        this.resetBikeOnRoad();
        break;
      case 'weather':
        this.setWeather(res.weather);
        break;
      case 'time':
        this.setTimeOfDay(res.time);
        break;
      case 'teleport':
        this.teleportToRegion(res.region);
        break;
      case 'repair':
        this.bikeState.damage = 0;
        break;
      case 'refuel':
        this.bikeState.fuelL = this.bikeSpecs.fuelCapacityL;
        break;
      case 'reset_bike':
        this.resetBikeOnRoad();
        break;
      case 'traffic':
        this.updateSettings({ trafficDensity: res.density });
        break;
      case 'money':
        this.save = { ...this.save, moneyNpr: this.save.moneyNpr + res.amount };
        persistSaveData(this.save);
        this.onSaveUpdate(this.save);
        break;
    }
    if (res.type !== 'error' && res.type !== 'help') {
      this.showToast(res.message);
    }
    this.emitHud();
    return res;
  }

  public resetSave(freshSave: SaveData): void {
    this.save = freshSave;
    this.bikeSpecs = this.resolveSpecs(freshSave.selectedBikeId);
    const spawn = REGIONS[0].spawnPos;
    this.bikeState = createInitialBikeState(spawn.x, spawn.z, spawn.heading, this.bikeSpecs);
    this.riderState = createInitialRiderState(this.bikeState);
    this.activeMission = null;
    this.world.checkpointBeacon.visible = false;
    this.rebuildBikeMesh();
    this.applyGraphicsQuality(freshSave.settings.graphicsQuality);
    this.traffic.setDensity(freshSave.settings.trafficDensity);
    this.audio.setMuted(freshSave.settings.muted);
    this.onSaveUpdate(this.save);
    this.emitHud();
  }

  private showToast(msg: string): void {
    this.toastMessage = msg;
    this.toastTimer = 3.2;
  }

  private gatherInput(): PhysicsInput {
    const throttle =
      this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')
        ? 1
        : this.touchInput.throttle ?? 0;
    const brakeFront =
      this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')
        ? 1
        : this.touchInput.brakeFront ?? 0;
    const brakeRear = this.keysHeld.has('Space') ? 1 : this.touchInput.brakeRear ?? 0;

    let steer = this.touchInput.steer ?? 0;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) steer -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) steer += 1;
    steer = Math.max(-1, Math.min(1, steer));

    const wheeliePull =
      this.keysHeld.has('ShiftLeft') ||
      this.keysHeld.has('ShiftRight') ||
      Boolean(this.touchInput.wheeliePull);

    return {
      throttle,
      brakeFront,
      brakeRear,
      steer,
      wheeliePull,
      shiftUp: false,
      shiftDown: false,
      horn: false,
    };
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.elapsed += dt;

    const px = this.riderState.onFoot ? this.riderState.x : this.bikeState.x;
    const pz = this.riderState.onFoot ? this.riderState.z : this.bikeState.z;
    this.world.update(this.elapsed, px, pz);

    if (this.screen === 'playing') {
      this.stepPlaying(dt);
    } else if (this.screen === 'title') {
      this.traffic.update(dt, 9999, 9999);
      this.updateTitleCamera();
    } else if (this.screen === 'garage') {
      this.updateGarageCamera();
    }

    this.updateSunShadowFocus();
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.timeoutId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.timeoutId = window.setTimeout(cb, 80);
        }
      };
      this.timeoutId = window.setTimeout(poll, 5);
    } catch {
      this.timeoutId = window.setTimeout(cb, 80);
    }
  }

  private stepPlaying(dt: number): void {
    const input = this.gatherInput();

    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - dt);
      if (this.toastTimer === 0) this.toastMessage = '';
    }
    if (this.stuntBannerTimer > 0) {
      this.stuntBannerTimer = Math.max(0, this.stuntBannerTimer - dt);
      if (this.stuntBannerTimer === 0) this.lastStuntBanner = '';
    }

    if (this.riderState.onFoot) {
      const forward =
        (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
        (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
      const strafe =
        (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0) -
        (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0);
      stepRiderOnFoot(
        this.riderState,
        {
          forward,
          strafe,
          sprint: this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight'),
        },
        dt
      );
      this.audio.updateEngine(this.bikeSpecs.idleRpm, this.bikeSpecs, 0, 1, false);
    } else {
      const res = stepBikePhysics(this.bikeState, input, this.bikeSpecs, {
        dt,
        handlingMode: this.save.settings.handlingMode,
        weather: this.weather,
        fuelEnabled: this.save.settings.fuelEnabled,
        autoGear: this.save.settings.autoGear,
        shiftUpJustPressed: this.shiftUpQueued,
        shiftDownJustPressed: this.shiftDownQueued,
      });
      this.shiftUpQueued = false;
      this.shiftDownQueued = false;

      if (res.impactStrength > 0.25) {
        this.cameraShakeTrauma = Math.min(1, this.cameraShakeTrauma + res.impactStrength * 0.7);
        this.audio.playLandingThud(res.impactStrength);
      }

      // Traffic collision response
      const hit = this.traffic.checkPlayerCollision(this.bikeState.x, this.bikeState.z);
      if (hit.hit) {
        this.bikeState.x += hit.pushX * 1.1;
        this.bikeState.z += hit.pushZ * 1.1;
        this.bikeState.vx = hit.pushX * 4.5;
        this.bikeState.vz = hit.pushZ * 4.5;
        this.bikeState.damage = Math.min(100, this.bikeState.damage + 6);
        this.cameraShakeTrauma = 0.65;
        this.audio.playLandingThud(0.8);
      }

      if (res.completedStunt) {
        const cashBonus = Math.round(res.completedStunt.points * 0.6);
        this.lastStuntBanner = `${res.completedStunt.label} · +${res.completedStunt.points} pts (+NPR ${cashBonus})`;
        this.stuntBannerTimer = 2.6;
        this.save = {
          ...this.save,
          moneyNpr: this.save.moneyNpr + cashBonus,
          totalStuntScore: this.save.totalStuntScore + res.completedStunt.points,
        };
        if (this.activeMission) {
          this.activeMission.stuntPointsEarned += res.completedStunt.points;
        }
        persistSaveData(this.save);
        this.onSaveUpdate(this.save);
      }

      // Update distance counter silently
      if (this.bikeState.speedMs > 0.5) {
        this.save.totalDistanceKm += (this.bikeState.speedMs * dt) / 1000;
      }

      // Auto-refuel when stopping inside petrol pump pad
      if (this.bikeState.speedMs < 2.2 && this.bikeState.fuelL < this.bikeSpecs.fuelCapacityL * 0.96) {
        const atPump = LANDMARKS.some(
          (l) =>
            l.kind === 'petrol' &&
            Math.hypot(this.bikeState.x - l.x, this.bikeState.z - l.z) <= l.radius * 0.7
        );
        if (atPump) {
          this.bikeState.fuelL = Math.min(
            this.bikeSpecs.fuelCapacityL,
            this.bikeState.fuelL + dt * 4.5
          );
        }
      }

      this.audio.updateEngine(
        this.bikeState.rpm,
        this.bikeSpecs,
        input.throttle,
        this.bikeState.gear,
        true
      );
    }

    const px = this.riderState.onFoot ? this.riderState.x : this.bikeState.x;
    const pz = this.riderState.onFoot ? this.riderState.z : this.bikeState.z;
    this.traffic.update(dt, px, pz);

    this.checkLandmarksAndMission(px, pz, dt);
    this.syncBikeTransform(input);
    this.updateRain(px, pz, dt);
    this.updateGameplayCamera(dt);

    this.hudThrottle += dt;
    if (this.hudThrottle >= 0.1) {
      this.hudThrottle = 0;
      this.emitHud();
    }
  }

  private checkLandmarksAndMission(px: number, pz: number, dt: number): void {
    // Landmark discovery
    for (const lm of LANDMARKS) {
      if (!this.save.discoveredLandmarkIds.includes(lm.id)) {
        if (Math.hypot(px - lm.x, pz - lm.z) <= lm.radius + 6) {
          this.save = {
            ...this.save,
            discoveredLandmarkIds: [...this.save.discoveredLandmarkIds, lm.id],
            moneyNpr: this.save.moneyNpr + 500,
          };
          this.showToast(`Discovered ${lm.name} (+NPR 500)`);
          this.audio.playCheckpointChime(false);
          persistSaveData(this.save);
          this.onSaveUpdate(this.save);
        }
      }
    }

    // GPS clear on arrival
    if (this.gpsTarget && Math.hypot(px - this.gpsTarget.x, pz - this.gpsTarget.z) < 14) {
      this.showToast(`Arrived at ${this.gpsTarget.label}`);
      this.setGpsTarget(null);
    }

    // Active mission check
    if (this.activeMission && this.activeMission.status === 'active') {
      const mission = MISSIONS.find((m) => m.id === this.activeMission!.missionId);
      if (!mission) return;

      this.activeMission.elapsedSec += dt;
      if (mission.timeLimitSec && this.activeMission.elapsedSec > mission.timeLimitSec) {
        this.activeMission.status = 'failed';
        this.world.checkpointBeacon.visible = false;
        this.lastMissionResult = {
          missionTitle: mission.title,
          success: false,
          elapsedSec: this.activeMission.elapsedSec,
          rewardNpr: 0,
          reason: 'Time limit expired before reaching final objective.',
        };
        this.setScreen('gameover');
        return;
      }

      const cp = mission.checkpoints[this.activeMission.checkpointIndex];
      const cpReached = cp && Math.hypot(px - cp.x, pz - cp.z) <= cp.radius;

      if (mission.category === 'stunt' && mission.targetStuntPoints) {
        if (this.activeMission.stuntPointsEarned >= mission.targetStuntPoints) {
          this.completeMission(mission);
        } else if (cpReached) {
          this.world.checkpointBeacon.visible = false;
        }
      } else if (cpReached) {
        this.activeMission.checkpointIndex += 1;
        if (this.activeMission.checkpointIndex >= mission.checkpoints.length) {
          this.completeMission(mission);
        } else {
          const nextCp = mission.checkpoints[this.activeMission.checkpointIndex];
          this.world.checkpointBeacon.position.set(
            nextCp.x,
            getTerrainHeight(nextCp.x, nextCp.z),
            nextCp.z
          );
          this.audio.playCheckpointChime(false);
          this.showToast(`Checkpoint! Next: ${nextCp.label ?? 'Objective'}`);
        }
      }
    }
  }

  private completeMission(mission: (typeof MISSIONS)[number]): void {
    if (!this.activeMission) return;
    this.activeMission.status = 'completed';
    this.world.checkpointBeacon.visible = false;
    this.audio.playCheckpointChime(true);

    const elapsed = this.activeMission.elapsedSec;
    const prevBest = this.save.bestMissionTimes[mission.id];
    const nextBest = prevBest ? Math.min(prevBest, elapsed) : elapsed;
    const completedSet = Array.from(new Set([...this.save.completedMissionIds, mission.id]));

    this.save = {
      ...this.save,
      moneyNpr: this.save.moneyNpr + mission.rewardNpr,
      completedMissionIds: completedSet,
      bestMissionTimes: {
        ...this.save.bestMissionTimes,
        [mission.id]: nextBest,
      },
    };
    persistSaveData(this.save);
    this.onSaveUpdate(this.save);

    this.lastMissionResult = {
      missionTitle: mission.title,
      success: true,
      elapsedSec: elapsed,
      rewardNpr: mission.rewardNpr,
      reason: 'All objectives cleared!',
    };
    this.setScreen('gameover');
  }

  private syncBikeTransform(input?: PhysicsInput): void {
    if (!this.bikeRig) return;
    const b = this.bikeState;
    this.bikeRig.root.position.set(b.x, b.y - b.suspensionCompression, b.z);
    this.bikeRig.root.rotation.order = 'YXZ';
    this.bikeRig.root.rotation.y = b.heading;
    this.bikeRig.root.rotation.x = b.pitchAngle;
    this.bikeRig.root.rotation.z = -b.leanAngle;

    this.bikeRig.frontFork.rotation.y = -b.steerAngle;
    this.bikeRig.frontWheel.rotation.x = -b.wheelRotation;
    this.bikeRig.rearWheel.rotation.x = -b.wheelRotation;

    const braking = input ? input.brakeFront > 0.1 || input.brakeRear > 0.1 : false;
    this.bikeRig.brakeLightMat.emissiveIntensity = braking ? 2.8 : 0.65;

    // Update rider pose
    if (this.riderState.onFoot) {
      this.riderRig.root.position.set(this.riderState.x, this.riderState.y, this.riderState.z);
      this.riderRig.root.rotation.set(0, this.riderState.heading, 0);
      const swing = Math.sin(this.riderState.walkCycle) * (Math.abs(this.riderState.walkSpeed) > 0.3 ? 0.55 : 0);
      this.riderRig.leftLeg.rotation.x = swing;
      this.riderRig.rightLeg.rotation.x = -swing;
      this.riderRig.leftArm.rotation.x = -swing * 0.6;
      this.riderRig.rightArm.rotation.x = swing * 0.6;
      this.riderRig.torso.rotation.x = 0;
    } else {
      // Mounted pose attached cleanly to bike frame
      this.riderRig.root.position.set(b.x, b.y - b.suspensionCompression + 0.14, b.z);
      this.riderRig.root.rotation.order = 'YXZ';
      this.riderRig.root.rotation.y = b.heading;
      this.riderRig.root.rotation.x = b.pitchAngle;
      this.riderRig.root.rotation.z = -b.leanAngle * 1.12;
      this.riderRig.torso.rotation.x = -0.26;
      this.riderRig.leftLeg.rotation.x = 0.68;
      this.riderRig.rightLeg.rotation.x = 0.68;
      this.riderRig.leftArm.rotation.x = 0.15;
      this.riderRig.rightArm.rotation.x = 0.15;
    }

    // Hide rider mesh in First-Person mode or Garage showroom so bike silhouette is unobstructed
    this.riderRig.root.visible =
      this.screen !== 'garage' &&
      !(this.cameraMode === 'first_person' && !this.riderState.onFoot);
  }

  private updateRain(px: number, pz: number, dt: number): void {
    if (!this.rainPoints.visible) return;
    this.rainPoints.position.set(px, this.bikeState.y, pz);
    const count = this.rainPositions.length / 3;
    for (let i = 0; i < count; i++) {
      let y = this.rainPositions[i * 3 + 1] - 24 * dt;
      if (y < 0) y = 26;
      this.rainPositions[i * 3 + 1] = y;
    }
    this.rainPoints.geometry.attributes.position.needsUpdate = true;
  }

  private updateTitleCamera(): void {
    const a = this.elapsed * 0.16;
    const bx = this.bikeState.x;
    const by = this.bikeState.y;
    const bz = this.bikeState.z;
    this.camera.position.set(
      bx + Math.sin(a) * 8.2 + 2.5,
      by + 3.4 + Math.sin(a * 0.7) * 0.6,
      bz + Math.cos(a) * 8.2
    );
    this.camera.lookAt(bx - 1.5, by + 1.6, bz - 16);
  }

  private updateGarageCamera(): void {
    const a = this.elapsed * 0.45;
    const bx = this.bikeState.x;
    const by = this.bikeState.y;
    const bz = this.bikeState.z;
    const camX = bx + Math.sin(a) * 3.8;
    const camZ = bz + Math.cos(a) * 3.8;
    const camY = Math.max(by + 1.55, getTerrainHeight(camX, camZ) + 0.9);
    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(bx, by + 0.85, bz);
  }

  private snapChaseCamera(): void {
    const b = this.bikeState;
    const sinH = Math.sin(b.heading);
    const cosH = Math.cos(b.heading);
    const desiredX = b.x + sinH * 6.0;
    const desiredZ = b.z + cosH * 6.0;
    const desiredY = Math.max(b.y + 2.35, getTerrainHeight(desiredX, desiredZ) + 1.1);
    this.camera.position.set(desiredX, desiredY, desiredZ);
    this.camera.lookAt(b.x - sinH * 4.5, b.y + 1.15, b.z - cosH * 4.5);
  }

  private updateGameplayCamera(dt: number): void {
    this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 1.8);
    const shake = this.cameraShakeTrauma * this.cameraShakeTrauma * 0.35;

    if (this.cameraMode === 'first_person' && !this.riderState.onFoot) {
      const b = this.bikeState;
      const sinH = Math.sin(b.heading);
      const cosH = Math.cos(b.heading);
      _camTargetPos.set(
        b.x - sinH * 0.14,
        b.y - b.suspensionCompression + 1.38,
        b.z - cosH * 0.14
      );
      _camLookAt.set(
        b.x - sinH * 14,
        b.y + 1.15 + Math.sin(b.pitchAngle) * 6,
        b.z - cosH * 14
      );
      this.camera.position.copy(_camTargetPos);
      this.camera.lookAt(_camLookAt);
      this.camera.rotation.z += -b.leanAngle * 0.45;
      const targetFov = 68 + Math.min(14, (b.speedMs / 45) * 14);
      if (Math.abs(this.camera.fov - targetFov) > 0.2) {
        this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    const px = this.riderState.onFoot ? this.riderState.x : this.bikeState.x;
    const py = this.riderState.onFoot ? this.riderState.y : this.bikeState.y;
    const pz = this.riderState.onFoot ? this.riderState.z : this.bikeState.z;
    const heading = this.riderState.onFoot ? this.riderState.heading : this.bikeState.heading;

    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    const dist = this.riderState.onFoot ? 4.2 : 5.8 + Math.min(2.2, this.bikeState.speedMs * 0.045);
    const height = this.riderState.onFoot ? 2.1 : 2.35;

    let desiredX = px + sinH * dist;
    let desiredZ = pz + cosH * dist;
    const terrainUnderCam = getTerrainHeight(desiredX, desiredZ);
    let desiredY = Math.max(py + height, terrainUnderCam + 1.1);

    if (shake > 0.005) {
      desiredX += (Math.random() - 0.5) * shake;
      desiredY += (Math.random() - 0.5) * shake;
    }

    const damp = 1 - Math.exp(-8.5 * dt);
    _camTargetPos.set(desiredX, desiredY, desiredZ);
    this.camera.position.lerp(_camTargetPos, damp);

    _camLookAt.set(px - sinH * 4.5, py + 1.15, pz - cosH * 4.5);
    this.camera.lookAt(_camLookAt);

    const targetFov = 60 + Math.min(16, (this.bikeState.speedMs / 50) * 16);
    if (Math.abs(this.camera.fov - targetFov) > 0.2) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
      this.camera.updateProjectionMatrix();
    }
  }

  private updateSunShadowFocus(): void {
    const px = this.riderState.onFoot ? this.riderState.x : this.bikeState.x;
    const pz = this.riderState.onFoot ? this.riderState.z : this.bikeState.z;
    this.keyLight.target.position.set(px, 0, pz);
    this.keyLight.position.set(px + 65, 110, pz + 45);
  }

  private emitHud(): void {
    const px = this.riderState.onFoot ? this.riderState.x : this.bikeState.x;
    const pz = this.riderState.onFoot ? this.riderState.z : this.bikeState.z;
    const regionId = getRegionAt(px, pz);
    const region = REGIONS.find((r) => r.id === regionId) ?? REGIONS[0];

    const nearBike = Math.hypot(this.riderState.x - this.bikeState.x, this.riderState.z - this.bikeState.z) < 4.5;
    const nearPetrol = LANDMARKS.some(
      (l) => l.kind === 'petrol' && Math.hypot(px - l.x, pz - l.z) <= l.radius
    );
    const nearGarage = LANDMARKS.some(
      (l) => l.kind === 'garage' && Math.hypot(px - l.x, pz - l.z) <= l.radius
    );

    // Keep compiler happy with _dustColor reference
    _dustColor.setHex(0xffffff);

    this.onHudUpdate({
      screen: this.screen,
      speedKmh: Math.round(this.bikeState.speedMs * 3.6),
      rpm: Math.round(this.bikeState.rpm),
      maxRpm: this.bikeSpecs.maxRpm,
      gear: this.bikeState.gear,
      fuelPct: Math.round((this.bikeState.fuelL / this.bikeSpecs.fuelCapacityL) * 100),
      damagePct: Math.round(this.bikeState.damage),
      onFoot: this.riderState.onFoot,
      nearBike,
      nearPetrol,
      nearGarage,
      regionId,
      regionName: region.name,
      surface: this.bikeState.surface,
      cameraMode: this.cameraMode,
      headlightsOn: this.headlightsOn,
      weather: this.weather,
      timeOfDay: this.timeOfDay,
      moneyNpr: this.save.moneyNpr,
      activeStuntLabel: this.bikeState.activeStuntLabel,
      activeStuntPoints: this.bikeState.activeStuntPoints,
      stuntCombo: this.bikeState.stuntCombo,
      lastStuntBanner: this.lastStuntBanner,
      playerX: px,
      playerZ: pz,
      playerHeading: this.riderState.onFoot ? this.riderState.heading : this.bikeState.heading,
      gpsTarget: this.gpsTarget,
      activeMission: this.activeMission ? { ...this.activeMission } : null,
      lastMissionResult: this.lastMissionResult,
      toastMessage: this.toastMessage,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.timeoutId);
    this.cleanupListeners();
    this.resizeObserver.disconnect();
    this.audio.dispose();
    this.textures.dispose();
    if (this.bikeRig) this.bikeRig.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
