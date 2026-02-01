import { Engine } from './core/Engine';
import { Clock } from './core/Clock';
import { InputManager, P1_KEYS, P2_KEYS } from './core/InputManager';
import { AudioManager } from './core/AudioManager';
import { CameraController } from './scene/CameraController';
import { RaceManager } from './race/RaceManager';
import { PostProcessing } from './fx/PostProcessing';
import { SpeedLines } from './fx/SpeedLines';
import { LightningFlash } from './fx/LightningFlash';
import { ScreenShake } from './fx/ScreenShake';
import { HUD } from './ui/HUD';
import { CountdownOverlay } from './ui/CountdownOverlay';
import { Minimap } from './ui/Minimap';
import { MenuScreen, MenuResult } from './ui/MenuScreen';
import { ResultsScreen } from './ui/ResultsScreen';
import { PauseScreen } from './ui/PauseScreen';
import { TrackConfig } from './track/TrackDefinition';
import { CircuitMeadow } from './track/tracks/CircuitMeadow';
import { VolcanoPass } from './track/tracks/VolcanoPass';
import { CoastalDrift } from './track/tracks/CoastalDrift';
import { FrozenPeaks } from './track/tracks/FrozenPeaks';
import { StarlightHighway } from './track/tracks/StarlightHighway';
import { Debug } from './utils/Debug';
import { KART_MAX_SPEED, TOTAL_LAPS } from './constants';

type GameState = 'menu' | 'racing' | 'results';

export class Game {
  private engine: Engine;
  private clock: Clock;
  private input: InputManager;
  private audio: AudioManager;
  private camera: CameraController;
  private raceManager: RaceManager;
  private postProcessing!: PostProcessing;
  private speedLines: SpeedLines;
  private lightningFlash: LightningFlash;
  private screenShake: ScreenShake;

  // UI
  private hud: HUD;
  private countdown: CountdownOverlay;
  private minimap: Minimap;
  private menu: MenuScreen;
  private results: ResultsScreen;
  private pause: PauseScreen;
  private debug: Debug;

  // Split screen
  private isSplitScreen = false;
  private input2: InputManager | null = null;
  private camera2: CameraController | null = null;
  private hud2: HUD | null = null;
  private screenShake2: ScreenShake | null = null;
  private splitDivider: HTMLDivElement | null = null;

  // State
  private gameState: GameState = 'menu';
  private paused = false;
  private tracks: TrackConfig[] = [CircuitMeadow, VolcanoPass, CoastalDrift, FrozenPeaks, StarlightHighway];
  private lastBoostDuration = 0;
  private lastBoostDuration2 = 0;
  private raceBgmStarted = false;

  constructor() {
    this.engine = new Engine();
    this.clock = new Clock();
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.camera = new CameraController(this.engine.aspect);
    this.raceManager = new RaceManager(this.audio);
    this.speedLines = new SpeedLines();
    this.lightningFlash = new LightningFlash();
    this.screenShake = new ScreenShake();

    this.hud = new HUD();
    this.countdown = new CountdownOverlay();
    this.minimap = new Minimap();
    this.menu = new MenuScreen(this.tracks, this.audio);
    this.results = new ResultsScreen();
    this.pause = new PauseScreen();
    this.debug = new Debug();

    // Resize handler
    window.addEventListener('resize', () => {
      if (this.isSplitScreen) {
        this.camera.resize(this.engine.aspect * 0.5);
        this.camera2?.resize(this.engine.aspect * 0.5);
      } else {
        this.camera.resize(this.engine.aspect);
        if (this.postProcessing) {
          this.postProcessing.setSize(this.engine.width, this.engine.height);
        }
      }
    });
  }

  async start(): Promise<void> {
    this.hud.hide();
    this.countdown.hide();
    this.engine.container.style.display = 'none';

    // Game loop
    this.engine.start((time) => {
      try {
        this.gameLoop(time);
      } catch (e) {
        console.error('Game loop error:', e);
      }
    });

    // Show menu
    this.showMenu();
  }

  private async showMenu(): Promise<void> {
    this.gameState = 'menu';
    this.hud.hide();
    this.countdown.hide();
    this.engine.container.style.display = 'none';
    this.cleanupSplitScreen();

    if (this.audio.isReady) {
      this.audio.playBGM('/bgm/menu.mp3');
    } else {
      const startMenuBGM = async () => {
        document.removeEventListener('click', startMenuBGM);
        document.removeEventListener('keydown', startMenuBGM);
        await this.audio.init();
        if (this.gameState === 'menu') {
          this.audio.playBGM('/bgm/menu.mp3');
        }
      };
      document.addEventListener('click', startMenuBGM, { once: false });
      document.addEventListener('keydown', startMenuBGM, { once: false });
    }

    const result = await this.menu.show();
    await this.startRace(result);
  }

  private async startRace(menuResult: MenuResult): Promise<void> {
    this.gameState = 'racing';
    this.engine.container.style.display = '';

    this.isSplitScreen = menuResult.mode === '2player';

    // Init audio on user interaction
    await this.audio.init();
    this.audio.stopBGM(0.3);

    // Init race
    const playerCount = this.isSplitScreen ? 2 : 1;
    await this.raceManager.init(menuResult.track, playerCount);

    if (this.isSplitScreen) {
      this.setupSplitScreen();
    } else {
      // Setup post processing (1P only)
      this.postProcessing = new PostProcessing(
        this.engine.renderer,
        this.raceManager.sceneManager.scene,
        this.camera.camera,
      );
      this.postProcessing.setSize(this.engine.width, this.engine.height);
      this.camera.resize(this.engine.aspect);
    }

    // Reset camera(s)
    const player1 = this.raceManager.getPlayerKart(0);
    this.camera.reset(player1.state.position, player1.forward);

    if (this.isSplitScreen && this.camera2) {
      const player2 = this.raceManager.getPlayerKart(1);
      this.camera2.reset(player2.state.position, player2.forward);
    }

    // Setup minimap (hide in 2P)
    if (!this.isSplitScreen) {
      this.minimap.buildTrackPath(this.raceManager.getTrackSpline());
    }

    // Show HUD
    this.hud.show();
    if (this.hud2) this.hud2.show();
    this.countdown.show(this.raceManager.countdownTimer);
    this.clock.reset();
    this.lastBoostDuration = 0;
    this.lastBoostDuration2 = 0;
    this.raceBgmStarted = false;
  }

  private setupSplitScreen(): void {
    // Destroy old single-player HUD and create split HUDs
    // P2 on left, P1 on right
    this.hud.destroy();
    this.hud = new HUD('right');

    this.hud2 = new HUD('left');
    this.screenShake2 = new ScreenShake();

    // Create P1/P2 input managers with specific bindings
    this.input = new InputManager(P1_KEYS);
    this.input2 = new InputManager(P2_KEYS);

    // Camera for P2
    this.camera2 = new CameraController(this.engine.aspect * 0.5);
    this.camera.resize(this.engine.aspect * 0.5);

    // Hide minimap in split screen
    this.minimap.destroy();
    this.minimap = new Minimap();
    // Don't build or show it

    // Create split divider
    this.splitDivider = document.createElement('div');
    this.splitDivider.className = 'split-divider';
    document.getElementById('ui-overlay')!.appendChild(this.splitDivider);
  }

  private cleanupSplitScreen(): void {
    if (this.hud2) {
      this.hud2.destroy();
      this.hud2 = null;
    }
    if (this.splitDivider) {
      this.splitDivider.remove();
      this.splitDivider = null;
    }
    this.input2 = null;
    this.camera2 = null;
    this.screenShake2 = null;
    this.isSplitScreen = false;

    // Recreate default input and HUD for menu/1P
    this.hud.destroy();
    this.hud = new HUD();
    this.input = new InputManager();

    // Recreate minimap
    this.minimap.destroy();
    this.minimap = new Minimap();
  }

  private gameLoop(time: number): void {
    if (this.gameState !== 'racing') return;

    const input1 = this.input.poll();
    const input2 = this.input2?.poll();

    // Pause toggle — either player can pause
    const pausePressed = input1.pause || (input2?.pause ?? false);
    if (pausePressed && !this.paused && this.raceManager.state === 'racing') {
      this.paused = true;
      this.audio.setMuted(true);
      this.pause.show(
        () => {
          // Resume
          this.paused = false;
          this.audio.setMuted(false);
          this.clock.reset();
        },
        () => {
          // Quit to menu
          this.paused = false;
          this.audio.setMuted(false);
          this.audio.stopBGM(0);
          this.raceManager.dispose();
          this.showMenu();
        },
      );
      return;
    }
    if (this.paused) return;

    // Physics at fixed timestep
    this.clock.tick(time, (dt) => {
      this.raceManager.updatePhysics(dt, input1, input2);
    });

    // Get player states
    const player1 = this.raceManager.getPlayerKart(0);
    const isBoosting1 = player1.state.boostTimer > 0;
    const driftStage1 = this.raceManager.getPlayerDriftStage(0);
    const events1 = this.raceManager.getFrameEvents(0);

    // Process P1 events
    this.processPlayerEvents(events1, player1, 0);

    // Track boost duration for HUD
    if (isBoosting1) {
      if (player1.state.boostTimer > this.lastBoostDuration) {
        this.lastBoostDuration = player1.state.boostTimer;
      }
    } else {
      this.lastBoostDuration = 0;
    }

    // Query track surface for camera slope following
    const playerSurface1 = this.raceManager.getTrackCollider().query(player1.state.position, 0);
    const trackNormal1 = playerSurface1?.normal;

    // Camera P1
    this.camera.update(
      player1.renderPosition,
      player1.forward,
      1 / 60,
      isBoosting1,
      input1.lookBack,
      trackNormal1 ?? undefined,
    );
    this.screenShake.update(1 / 60, this.camera.camera);

    // Render interpolation
    this.raceManager.updateRender(this.clock.alpha, this.camera.camera);

    if (this.isSplitScreen) {
      this.renderSplitScreen(input1, input2!);
    } else {
      this.renderSinglePlayer(input1, player1, isBoosting1, driftStage1, events1);
    }

    // Countdown overlay
    if (this.raceManager.state === 'countdown') {
      this.countdown.show(this.raceManager.countdownTimer);
    } else {
      this.countdown.hide();
      if (!this.raceBgmStarted && this.raceManager.state === 'racing') {
        this.raceBgmStarted = true;
        const bgmUrl = AudioManager.trackBgmUrl(this.raceManager.trackName);
        this.audio.playBGM(bgmUrl, 0.3);
      }
    }

    // Debug
    this.debug.set('FPS', Math.round(1000 / (time - (this as any)._lastTime || time)));
    (this as any)._lastTime = time;
    this.debug.set('Speed', Math.abs(player1.state.speed).toFixed(1));
    this.debug.set('Position', player1.racePosition);
    this.debug.set('Lap', player1.currentLap);
    this.debug.set('State', this.raceManager.state);
    this.debug.update();

    // Race finished check
    if (this.raceManager.state === 'finished' && this.gameState === 'racing') {
      this.onRaceFinished();
    }
  }

  private processPlayerEvents(events: ReturnType<typeof this.raceManager.getFrameEvents>, player: ReturnType<typeof this.raceManager.getPlayerKart>, playerIdx: number): void {
    const hud = playerIdx === 0 ? this.hud : this.hud2;
    if (!hud) return;

    if (events.playerHit) {
      if (playerIdx === 0) {
        this.screenShake.trigger(1.2);
        this.speedLines.triggerHit();
        if (!this.isSplitScreen) this.postProcessing.triggerHit();
      } else {
        this.screenShake2?.trigger(1.2);
      }
      hud.showHit();
    }

    if (events.playerItemGet) {
      hud.showItemGet();
    }

    if (events.playerUsedMushroom) {
      if (playerIdx === 0) {
        this.screenShake.trigger(0.3);
      } else {
        this.screenShake2?.trigger(0.3);
      }
    }

    if (events.playerUsedStar) {
      if (!this.isSplitScreen) this.postProcessing.triggerStar();
    }

    if (events.playerUsedLightning) {
      this.lightningFlash.trigger();
      if (playerIdx === 0) {
        this.screenShake.trigger(0.5);
      } else {
        this.screenShake2?.trigger(0.5);
      }
    }

    if (events.lapCompleted > 0) {
      const isFinal = events.lapCompleted >= TOTAL_LAPS;
      hud.showLapNotification(events.lapCompleted, isFinal);
    }
  }

  private renderSinglePlayer(
    input: { lookBack: boolean },
    player: ReturnType<typeof this.raceManager.getPlayerKart>,
    isBoosting: boolean,
    driftStage: ReturnType<typeof this.raceManager.getPlayerDriftStage>,
    events: ReturnType<typeof this.raceManager.getFrameEvents>,
  ): void {
    // Speed lines
    this.speedLines.update(1 / 60, isBoosting);

    // Star tint for speed lines
    if (player.state.starTimer > 0) {
      const hue = (Date.now() * 0.003) % 1;
      const c = { r: 0, g: 0, b: 0 };
      const h = hue * 6;
      const f = h - Math.floor(h);
      if (h < 1) { c.r = 1; c.g = f; c.b = 0; }
      else if (h < 2) { c.r = 1 - f; c.g = 1; c.b = 0; }
      else if (h < 3) { c.r = 0; c.g = 1; c.b = f; }
      else if (h < 4) { c.r = 0; c.g = 1 - f; c.b = 1; }
      else if (h < 5) { c.r = f; c.g = 0; c.b = 1; }
      else { c.r = 1; c.g = 0; c.b = 1 - f; }
      this.speedLines.setTint(c.r, c.g, c.b);
    } else {
      this.speedLines.setTint(1, 1, 1);
    }

    // Post processing
    this.postProcessing.setBoostMode(isBoosting || player.state.starTimer > 0);
    this.lightningFlash.update(1 / 60);

    // Render
    this.postProcessing.render(1 / 60);

    // HUD updates
    this.hud.update(
      player,
      this.raceManager.getPlayerItemSlot(0),
      this.raceManager.getRaceTime(),
      driftStage,
      player.state.boostTimer,
      this.lastBoostDuration || 1,
      events.isPlayerTargeted,
    );

    this.minimap.update(this.raceManager.karts);
  }

  private renderSplitScreen(input1: { lookBack: boolean }, input2: { lookBack: boolean }): void {
    const renderer = this.engine.renderer;
    const w = this.engine.width;
    const h = this.engine.height;
    const halfW = Math.floor(w / 2);

    // P2 camera update
    const player2 = this.raceManager.getPlayerKart(1);
    const isBoosting2 = player2.state.boostTimer > 0;
    const playerSurface2 = this.raceManager.getTrackCollider().query(player2.state.position, 1);
    const trackNormal2 = playerSurface2?.normal;

    this.camera2!.update(
      player2.renderPosition,
      player2.forward,
      1 / 60,
      isBoosting2,
      input2.lookBack,
      trackNormal2 ?? undefined,
    );
    this.screenShake2!.update(1 / 60, this.camera2!.camera);

    const scene = this.raceManager.sceneManager.scene;

    // Lightning flash
    this.lightningFlash.update(1 / 60);

    // Enable scissor test
    renderer.setScissorTest(true);

    // Left half — P2
    renderer.setViewport(0, 0, halfW, h);
    renderer.setScissor(0, 0, halfW, h);
    renderer.render(scene, this.camera2!.camera);

    // Right half — P1
    renderer.setViewport(halfW, 0, w - halfW, h);
    renderer.setScissor(halfW, 0, w - halfW, h);
    renderer.render(scene, this.camera.camera);

    // Reset
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);

    // Process P2 events
    const events2 = this.raceManager.getFrameEvents(1);
    this.processPlayerEvents(events2, player2, 1);

    // Track P2 boost duration
    if (isBoosting2) {
      if (player2.state.boostTimer > this.lastBoostDuration2) {
        this.lastBoostDuration2 = player2.state.boostTimer;
      }
    } else {
      this.lastBoostDuration2 = 0;
    }

    // HUD updates — P1
    const player1 = this.raceManager.getPlayerKart(0);
    const driftStage1 = this.raceManager.getPlayerDriftStage(0);
    const events1 = this.raceManager.getFrameEvents(0);
    this.hud.update(
      player1,
      this.raceManager.getPlayerItemSlot(0),
      this.raceManager.getRaceTime(),
      driftStage1,
      player1.state.boostTimer,
      this.lastBoostDuration || 1,
      events1.isPlayerTargeted,
    );

    // HUD updates — P2
    const driftStage2 = this.raceManager.getPlayerDriftStage(1);
    this.hud2!.update(
      player2,
      this.raceManager.getPlayerItemSlot(1),
      this.raceManager.getRaceTime(),
      driftStage2,
      player2.state.boostTimer,
      this.lastBoostDuration2 || 1,
      events2.isPlayerTargeted,
    );

    // Speed lines (P1 only in split screen)
    const isBoosting1 = player1.state.boostTimer > 0;
    this.speedLines.update(1 / 60, isBoosting1);
  }

  private async onRaceFinished(): Promise<void> {
    this.gameState = 'results';
    this.hud.hide();
    this.hud2?.hide();
    this.countdown.hide();

    // Stop race BGM, play finish fanfare, then start results BGM
    this.audio.stopBGM(0.5);
    const fanfareDuration = this.audio.playFinish();

    // Start results BGM after the fanfare fades
    setTimeout(() => {
      if (this.gameState === 'results') {
        this.audio.playBGM('/bgm/results.mp3');
      }
    }, 1000);

    await this.results.show(this.raceManager.karts, this.raceManager.getRaceTime());

    this.raceManager.dispose();
    this.showMenu();
  }
}
