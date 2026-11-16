import { useCallback, useEffect, useRef, useState } from 'react';
import { GarageModal } from './components/GarageModal';
import { HudOverlay } from './components/HudOverlay';
import { MissionsModal } from './components/MissionsModal';
import { PauseSettingsModal } from './components/PauseSettingsModal';
import { SandboxConsole } from './components/SandboxConsole';
import { TitleOverlay } from './components/TitleOverlay';
import { WorldMapModal } from './components/WorldMapModal';
import { MOTORCYCLES, REGIONS } from './game/catalog';
import { NepalRiderEngine } from './game/engine';
import { loadSaveData, persistSaveData } from './game/sandbox';
import { GameScreenState, HudSnapshot, SaveData } from './game/types';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NepalRiderEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );

  useEffect(() => {
    const syncOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);
    return () => {
      window.removeEventListener('resize', syncOrientation);
      window.removeEventListener('orientationchange', syncOrientation);
    };
  }, []);

  const tryLockLandscape = useCallback(() => {
    try {
      const orientation = window.screen?.orientation as
        | (ScreenOrientation & { lock?: (mode: string) => Promise<void> })
        | undefined;
      if (orientation?.lock) {
        orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Browser does not allow programmatic orientation lock outside fullscreen
    }
  }, []);

  const autostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const initialScreen: GameScreenState = autostart ? 'playing' : 'title';

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    screen: initialScreen,
    speedKmh: 0,
    rpm: 1200,
    maxRpm: 7500,
    gear: 1,
    fuelPct: 100,
    damagePct: 0,
    onFoot: false,
    nearBike: true,
    nearPetrol: false,
    nearGarage: false,
    regionId: 'kathmandu',
    regionName: REGIONS[0].name,
    surface: 'asphalt',
    cameraMode: 'third_person',
    headlightsOn: true,
    weather: 'sunny',
    timeOfDay: 'morning',
    moneyNpr: save.moneyNpr,
    activeStuntLabel: '',
    activeStuntPoints: 0,
    stuntCombo: 1,
    lastStuntBanner: '',
    playerX: REGIONS[0].spawnPos.x,
    playerZ: REGIONS[0].spawnPos.z,
    playerHeading: 0,
    gpsTarget: null,
    activeMission: null,
    lastMissionResult: null,
    toastMessage: '',
  }));

  const screenRef = useRef<GameScreenState>(initialScreen);
  screenRef.current = hud.screen;

  const sandboxOpenRef = useRef(false);
  sandboxOpenRef.current = sandboxOpen;

  const handleShortcut = useCallback((code: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (screenRef.current === 'title') {
      if (code === 'Enter' || code === 'Space') {
        tryLockLandscape();
        engine.startFreeRoam();
      }
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      if (sandboxOpenRef.current) {
        setSandboxOpen(false);
      } else if (screenRef.current === 'playing') {
        engine.setScreen('paused');
      } else if (
        screenRef.current === 'paused' ||
        screenRef.current === 'garage' ||
        screenRef.current === 'map' ||
        screenRef.current === 'missions'
      ) {
        engine.setScreen('playing');
      }
    } else if (code === 'KeyG' && screenRef.current === 'playing') {
      engine.setScreen('garage');
    } else if (code === 'Tab') {
      if (screenRef.current === 'playing') {
        engine.setScreen('map');
      } else if (screenRef.current === 'map') {
        engine.setScreen('playing');
      }
    } else if (code === 'KeyJ' && screenRef.current === 'playing') {
      engine.setScreen('missions');
    } else if (code === 'Slash' && screenRef.current === 'playing') {
      setSandboxOpen((v) => !v);
    } else if (code === 'KeyM' && screenRef.current === 'playing') {
      setSave((prev) => {
        const nextMuted = !prev.settings.muted;
        engine.updateSettings({ muted: nextMuted });
        return { ...prev, settings: { ...prev.settings, muted: nextMuted } };
      });
    }
  }, [tryLockLandscape]);

  // Mount Three.js engine once
  useEffect(() => {
    const el = canvasMountRef.current;
    if (!el) return;

    const initialSaveData = loadSaveData();
    const engine = new NepalRiderEngine(el, initialSaveData, initialScreen, {
      onHudUpdate: (snap) => setHud(snap),
      onSaveUpdate: (nextSave) => setSave(nextSave),
      onShortcutKey: handleShortcut,
    });
    engineRef.current = engine;

    const preventTabScroll = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && screenRef.current !== 'title') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', preventTabScroll);

    return () => {
      window.removeEventListener('keydown', preventTabScroll);
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleShortcut, initialScreen]);

  const selectedBike = MOTORCYCLES.find((b) => b.id === save.selectedBikeId) ?? MOTORCYCLES[0];

  const landscapeStageStyle: React.CSSProperties = isPortrait
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100dvh',
        height: '100dvw',
        transform: 'translateX(100dvw) rotate(90deg)',
        transformOrigin: 'top left',
      }
    : {
        position: 'relative',
        width: '100vw',
        height: '100dvh',
      };

  return (
    <div className="w-screen h-screen overflow-hidden bg-stone-950">
      <div
        data-testid="landscape-stage"
        data-orientation="landscape"
        style={landscapeStageStyle}
        className="overflow-hidden bg-stone-950"
      >
        {/* Dedicated isolated WebGL canvas container */}
        <div
          ref={canvasMountRef}
          data-testid="game-canvas-container"
          className="absolute inset-0 w-full h-full"
        />

        {/* Title Screen */}
        {hud.screen === 'title' && (
          <TitleOverlay
            moneyNpr={save.moneyNpr}
            selectedBikeName={selectedBike.name}
            onStartFreeRoam={() => {
              tryLockLandscape();
              engineRef.current?.startFreeRoam();
            }}
            onOpenGarage={() => engineRef.current?.setScreen('garage')}
            onOpenMissions={() => engineRef.current?.setScreen('missions')}
          />
        )}

        {/* Playing HUD */}
        {hud.screen === 'playing' && (
          <HudOverlay
            hud={hud}
            muted={save.settings.muted}
            touchControlsEnabled={save.settings.touchControlsEnabled}
            fuelEnabled={save.settings.fuelEnabled}
            onToggleCamera={() => engineRef.current?.toggleCameraMode()}
            onResetBike={() => engineRef.current?.resetBikeOnRoad()}
            onToggleMute={() =>
              engineRef.current?.updateSettings({ muted: !save.settings.muted })
            }
            onOpenPause={() => engineRef.current?.setScreen('paused')}
            onOpenGarage={() => engineRef.current?.setScreen('garage')}
            onOpenMap={() => engineRef.current?.setScreen('map')}
            onOpenMissions={() => engineRef.current?.setScreen('missions')}
            onOpenSandbox={() => setSandboxOpen(true)}
            onMountToggle={() => engineRef.current?.toggleMount()}
            onRefuel={() => engineRef.current?.tryRefuel()}
            onHorn={() => engineRef.current?.playHorn()}
            onTouchInput={(p) => engineRef.current?.setTouchInput(p)}
          />
        )}

      {/* Garage Showroom */}
      {hud.screen === 'garage' && (
        <GarageModal
          save={save}
          onSelectBike={(id) => engineRef.current?.selectMotorcycle(id)}
          onBuyBike={(id) => engineRef.current?.purchaseMotorcycle(id)}
          onUpdateCustomization={(id, patch) =>
            engineRef.current?.updateCustomization(id, patch)
          }
          onClose={() => engineRef.current?.setScreen('playing')}
        />
      )}

      {/* Interactive World Map */}
      {hud.screen === 'map' && (
        <WorldMapModal
          hud={hud}
          save={save}
          onSetGps={(t) => engineRef.current?.setGpsTarget(t)}
          onTeleportRegion={(r) => engineRef.current?.teleportToRegion(r)}
          onClose={() => engineRef.current?.setScreen('playing')}
        />
      )}

      {/* Missions Modal */}
      {hud.screen === 'missions' && (
        <MissionsModal
          save={save}
          activeMission={hud.activeMission}
          onStartMission={(id) => engineRef.current?.startMission(id)}
          onAbandonMission={() => engineRef.current?.abandonMission()}
          onClose={() => engineRef.current?.setScreen('playing')}
        />
      )}

      {/* Sandbox Console Overlay */}
      {sandboxOpen && hud.screen === 'playing' && (
        <SandboxConsole
          onExecute={(cmd) => engineRef.current!.executeSandboxCommand(cmd)}
          onClose={() => setSandboxOpen(false)}
        />
      )}

      {/* Pause / Settings / Mission Completion Modal */}
      {(hud.screen === 'paused' || hud.screen === 'gameover') && (
        <PauseSettingsModal
          mode={hud.screen}
          hud={hud}
          settings={save.settings}
          onResume={() => engineRef.current?.setScreen('playing')}
          onRestartRoad={() => engineRef.current?.resetBikeOnRoad()}
          onReplayMission={() => {
            if (hud.activeMission) {
              engineRef.current?.startMission(hud.activeMission.missionId);
            } else {
              engineRef.current?.setScreen('missions');
            }
          }}
          onMainMenu={() => engineRef.current?.setScreen('title')}
          onUpdateSettings={(patch) => engineRef.current?.updateSettings(patch)}
          onSetWeather={(w) => engineRef.current?.setWeather(w)}
          onSetTime={(t) => engineRef.current?.setTimeOfDay(t)}
          onResetSave={(fresh) => {
            persistSaveData(fresh);
            engineRef.current?.resetSave(fresh);
          }}
        />
      )}
      </div>
    </div>
  );
}
