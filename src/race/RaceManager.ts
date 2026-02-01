import * as THREE from 'three';
import { Kart } from '../kart/Kart';
import { KartController } from '../kart/KartController';
import { KartAnimator } from '../kart/KartAnimator';
import { KartAI } from '../kart/KartAI';
import { DriftSystem, DriftStage } from '../kart/DriftSystem';
import { updateKartPhysics, resolveKartCollision, SurfaceInfo, applyBoost } from '../kart/KartPhysics';
import { TrackSpline } from '../track/TrackSpline';
import { TrackCollider } from '../track/TrackCollider';
import { TrackMeshBuilder } from '../track/TrackMeshBuilder';
import { TrackEnvironment } from '../track/TrackEnvironment';
import { CheckpointSystem } from '../track/CheckpointSystem';
import { TrackConfig } from '../track/TrackDefinition';
import { ItemBox } from '../items/ItemBox';
import { ItemSlot } from '../items/ItemSlot';
import { ItemType } from '../items/ItemDistribution';
import { BananaEntity, createBanana, checkBananaCollision } from '../items/behaviors/Banana';
import { ShellEntity, createGreenShell, updateGreenShell, checkGreenShellCollision, bounceGreenShell } from '../items/behaviors/GreenShell';
import { RedShellEntity, createRedShell, updateRedShell, checkRedShellCollision } from '../items/behaviors/RedShell';
import { useMushroom } from '../items/behaviors/Mushroom';
import { useStar, updateStar } from '../items/behaviors/Star';
import { useLightning } from '../items/behaviors/Lightning';
import { ParticlePool } from '../particles/ParticlePool';
import { DriftSparks } from '../particles/DriftSparks';
import { BoostFlame } from '../particles/BoostFlame';
import { DustTrail } from '../particles/DustTrail';
import { ItemExplosion } from '../particles/ItemExplosion';
import { StarSparkle } from '../particles/StarSparkle';
import { ShellTrail } from '../particles/ShellTrail';
import { SpeedSparks } from '../particles/SpeedSparks';
import { MushroomBurst } from '../particles/MushroomBurst';
import { SnowEffect } from '../particles/SnowEffect';
import { VolcanoEffect } from '../particles/VolcanoEffect';
import { MeteorShowerEffect } from '../particles/MeteorShowerEffect';
import { LoopFireworks } from '../particles/LoopFireworks';
import { LightningStrike } from '../particles/LightningStrike';
import { MeadowCows } from '../entities/MeadowCow';
import { BeachHouses } from '../entities/BeachHouse';
import { CoastalPedestrians } from '../entities/CoastalPedestrian';
import { PositionTracker } from './PositionTracker';
import { LapTracker } from './LapTracker';
import { RaceTimer } from './RaceTimer';
import { RubberBanding } from './RubberBanding';
import { InputState } from '../core/InputManager';
import { AudioManager } from '../core/AudioManager';
import { SceneManager } from '../scene/SceneManager';
import { SkyBox } from '../scene/SkyBox';
import { Lighting } from '../scene/Lighting';
import { KART_COLORS, TOTAL_RACERS, COUNTDOWN_DURATION, KART_MAX_SPEED, BOOST_PAD_SPEED_BONUS, BOOST_PAD_DURATION } from '../constants';

export type RaceState = 'countdown' | 'racing' | 'finished';

export interface RaceEvents {
  playerHit: boolean;
  playerItemGet: boolean;
  playerUsedMushroom: boolean;
  playerUsedStar: boolean;
  playerUsedLightning: boolean;
  lapCompleted: number; // lap number, 0 = no change
  isPlayerTargeted: boolean;
}

function createEmptyEvents(): RaceEvents {
  return {
    playerHit: false,
    playerItemGet: false,
    playerUsedMushroom: false,
    playerUsedStar: false,
    playerUsedLightning: false,
    lapCompleted: 0,
    isPlayerTargeted: false,
  };
}

export class RaceManager {
  // Core
  readonly sceneManager: SceneManager;
  readonly karts: Kart[] = [];
  private playerKarts: Kart[] = [];
  private trackSpline!: TrackSpline;
  private trackCollider!: TrackCollider;
  private checkpointSystem!: CheckpointSystem;

  // Player count
  playerCount = 1;

  // Systems
  private controller = new KartController();
  private animator = new KartAnimator();
  private playerDrifts: DriftSystem[] = [new DriftSystem()];
  private aiControllers: KartAI[] = [];
  private positionTracker = new PositionTracker();
  private lapTracker!: LapTracker;
  private raceTimer = new RaceTimer();
  private rubberBanding = new RubberBanding();

  // Items
  private itemBoxes: ItemBox[] = [];
  private itemSlots = new Map<number, ItemSlot>();
  private bananas: BananaEntity[] = [];
  private greenShells: ShellEntity[] = [];
  private redShells: RedShellEntity[] = [];

  // Particles
  readonly particlePool = new ParticlePool();
  private driftSparks = new DriftSparks();
  private boostFlame = new BoostFlame();
  private dustTrail = new DustTrail();
  private starSparkle = new StarSparkle();
  private shellTrail = new ShellTrail();
  private speedSparks = new SpeedSparks();
  private snowEffect: SnowEffect | null = null;
  private volcanoEffect: VolcanoEffect | null = null;
  private meteorShowerEffect: MeteorShowerEffect | null = null;
  private loopFireworks: LoopFireworks | null = null;
  private lightningStrike = new LightningStrike();
  private meadowCows: MeadowCows | null = null;
  private beachHouses: BeachHouses | null = null;
  private coastalPedestrians: CoastalPedestrians | null = null;

  // Environment
  private skyBox!: SkyBox;
  private lighting!: Lighting;
  private trackEnv = new TrackEnvironment();

  // State
  state: RaceState = 'countdown';
  countdownTimer = COUNTDOWN_DURATION;
  trackName = '';
  private audio: AudioManager;
  private lastCountdownBeep = COUNTDOWN_DURATION;
  private lastPlayerLaps: number[] = [0];

  // Events for this frame — one per player
  private frameEventsArr: RaceEvents[] = [createEmptyEvents()];

  constructor(audio: AudioManager) {
    this.sceneManager = new SceneManager();
    this.audio = audio;
  }

  async init(trackConfig: TrackConfig, playerCount = 1): Promise<void> {
    this.playerCount = playerCount;
    this.trackName = trackConfig.name;
    this.sceneManager.clear();
    this.karts.length = 0;
    this.bananas.length = 0;
    this.greenShells.length = 0;
    this.redShells.length = 0;

    // Build track
    this.trackSpline = new TrackSpline(trackConfig.controlPoints);
    this.trackCollider = new TrackCollider(this.trackSpline);
    this.checkpointSystem = new CheckpointSystem(
      this.trackSpline,
      trackConfig.checkpointIndices,
      trackConfig.controlPoints.length,
    );
    this.lapTracker = new LapTracker(this.checkpointSystem);

    // Track mesh
    const { road, offroad } = TrackMeshBuilder.build(this.trackSpline, trackConfig.environment);
    this.sceneManager.add(road);
    this.sceneManager.add(offroad);
    this.sceneManager.add(TrackMeshBuilder.buildStartLine(this.trackSpline));

    // Environment
    this.trackEnv.build(this.trackSpline, trackConfig.environment);
    this.sceneManager.add(this.trackEnv.group);

    // Sky & lighting (environment-specific)
    this.sceneManager.setEnvironment(trackConfig.environment);
    this.skyBox = new SkyBox(trackConfig.environment);
    this.sceneManager.add(this.skyBox.mesh);
    this.lighting = new Lighting(trackConfig.environment);
    this.lighting.addTo(this.sceneManager.scene);

    // Item boxes
    this.itemBoxes = [];
    if (trackConfig.itemBoxPositions) {
      for (const pos of trackConfig.itemBoxPositions) {
        const box = new ItemBox(new THREE.Vector3(pos[0], pos[1], pos[2]));
        this.itemBoxes.push(box);
        this.sceneManager.add(box.mesh);
      }
    }

    // Create karts — first `playerCount` are players, rest are AI
    for (let i = 0; i < TOTAL_RACERS; i++) {
      const isPlayer = i < playerCount;
      const kart = new Kart(i, KART_COLORS[i], isPlayer);
      this.karts.push(kart);
      kart.addToScene(this.sceneManager.scene);
      this.itemSlots.set(i, new ItemSlot());
    }
    this.playerKarts = this.karts.slice(0, playerCount);

    // Drift systems — one per player
    this.playerDrifts = [];
    for (let i = 0; i < playerCount; i++) {
      this.playerDrifts.push(new DriftSystem());
    }

    // AI controllers — start after player karts
    this.aiControllers = [];
    for (let i = playerCount; i < TOTAL_RACERS; i++) {
      const difficulty = 0.3 + (i / TOTAL_RACERS) * 0.5;
      this.aiControllers.push(new KartAI(difficulty));
    }

    // Particles
    this.sceneManager.add(this.particlePool.mesh);

    // Snow effect for frozen environment
    if (trackConfig.environment === 'frozen') {
      this.snowEffect = new SnowEffect();
      this.sceneManager.add(this.snowEffect.points);
    } else {
      this.snowEffect = null;
    }

    if (trackConfig.environment === 'volcano') {
      this.volcanoEffect = new VolcanoEffect();
      this.sceneManager.add(this.volcanoEffect.emberPoints);
      this.sceneManager.add(this.volcanoEffect.ashPoints);
    } else {
      this.volcanoEffect = null;
    }

    if (trackConfig.environment === 'night') {
      this.meteorShowerEffect = new MeteorShowerEffect();
      this.sceneManager.add(this.meteorShowerEffect.points);
    } else {
      this.meteorShowerEffect = null;
    }

    // Loop fireworks (Starlight Highway)
    if (trackConfig.name === 'Starlight Highway') {
      this.loopFireworks = new LoopFireworks();
      this.sceneManager.add(this.loopFireworks.points);
    } else {
      this.loopFireworks = null;
    }

    // Meadow cows
    if (trackConfig.environment === 'meadow') {
      this.meadowCows = new MeadowCows();
      this.meadowCows.setAudio(this.audio);
      this.meadowCows.spawn(this.trackSpline);
      this.sceneManager.add(this.meadowCows.group);
    } else {
      this.meadowCows = null;
    }

    // Beach houses (coastal)
    if (trackConfig.environment === 'coastal') {
      this.beachHouses = new BeachHouses();
      this.beachHouses.spawn();
      this.sceneManager.add(this.beachHouses.group);

      this.coastalPedestrians = new CoastalPedestrians();
      this.coastalPedestrians.spawn(this.trackSpline);
      this.sceneManager.add(this.coastalPedestrians.group);
    } else {
      this.beachHouses = null;
      this.coastalPedestrians = null;
    }

    // Position karts at start
    this.positionKartsAtStart(trackConfig.startHeading);

    // Reset state
    this.state = 'countdown';
    this.countdownTimer = COUNTDOWN_DURATION;
    this.lastCountdownBeep = COUNTDOWN_DURATION;
    this.raceTimer.reset();
    this.lapTracker.reset();
    for (const drift of this.playerDrifts) drift.reset();
    this.lastPlayerLaps = new Array(playerCount).fill(0);
    this.frameEventsArr = [];
    for (let i = 0; i < playerCount; i++) {
      this.frameEventsArr.push(createEmptyEvents());
    }
  }

  private positionKartsAtStart(heading: number): void {
    const startPoint = this.trackSpline.getPointAt(0);
    const right = startPoint.binormal;
    const fwd = startPoint.tangent;

    for (let i = 0; i < this.karts.length; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const pos = startPoint.position.clone()
        .add(fwd.clone().multiplyScalar(row * -4 - 2))
        .add(right.clone().multiplyScalar((col - 0.5) * 3));
      pos.y += 0.5;

      this.karts[i].setStartPosition(pos, heading);
    }
  }

  updatePhysics(dt: number, input: InputState, input2?: InputState): void {
    // Reset frame events
    for (let i = 0; i < this.frameEventsArr.length; i++) {
      this.frameEventsArr[i] = createEmptyEvents();
    }

    // Countdown
    if (this.state === 'countdown') {
      this.countdownTimer -= dt;

      const sec = Math.ceil(this.countdownTimer);
      if (sec < this.lastCountdownBeep && sec >= 0) {
        this.lastCountdownBeep = sec;
        this.audio.playCountdown(sec === 0);
      }

      if (this.countdownTimer <= 0) {
        this.state = 'racing';
        this.raceTimer.start();
        this.audio.startEngine();
      }
      return;
    }

    if (this.state === 'finished') return;

    this.raceTimer.update(dt);

    // Player updates
    const inputs = [input];
    if (input2 && this.playerCount >= 2) inputs.push(input2);

    for (let p = 0; p < this.playerCount; p++) {
      const pInput = inputs[p];
      if (!pInput) continue;
      const kart = this.playerKarts[p];
      if (kart.finished) continue;

      this.playerDrifts[p].update(kart.state, pInput.steer, pInput.drift, dt);
      this.controller.update(kart, pInput, dt, (pos, t?) => t !== undefined ? this.trackCollider.queryAtT(t, kart.index) : this.trackCollider.query(pos, kart.index));

      const surface = this.trackCollider.query(kart.state.position, kart.index);
      if (surface?.surfaceType === 'boost') {
        applyBoost(kart.state, BOOST_PAD_SPEED_BONUS, BOOST_PAD_DURATION);
      }

      // Item use
      if (pInput.useItem) {
        const slot = this.itemSlots.get(kart.index)!;
        const item = slot.useItem();
        if (item) {
          this.executeItem(kart, item, p);
        }
      }

      // Audio only for P1
      if (p === 0) {
        this.audio.updateEngine(
          Math.abs(kart.state.speed) / KART_MAX_SPEED,
          kart.state.shrinkTimer > 0,
        );

        if (this.playerDrifts[p].active) {
          if (this.playerDrifts[p].stage > DriftStage.None) {
            this.audio.startDrift();
            this.audio.updateDrift(this.playerDrifts[p].charge / 2);
          }
        } else {
          this.audio.stopDrift();
        }
      }
    }

    // AI updates
    for (let i = 0; i < this.aiControllers.length; i++) {
      const kartIndex = this.playerCount + i;
      const kart = this.karts[kartIndex];
      if (kart.finished) continue;

      const aiResult = this.aiControllers[i].update(
        kart, this.trackSpline, dt,
        (pos, t?) => t !== undefined ? this.trackCollider.queryAtT(t, kart.index) : this.trackCollider.query(pos, kart.index),
        this.karts,
      );

      if (aiResult.useItem && aiResult.itemType) {
        this.executeItem(kart, aiResult.itemType);
      }
    }

    // Kart-to-kart collisions
    for (let i = 0; i < this.karts.length; i++) {
      for (let j = i + 1; j < this.karts.length; j++) {
        resolveKartCollision(this.karts[i].state, this.karts[j].state);
      }
    }

    // Item box collisions
    for (const box of this.itemBoxes) {
      box.update(dt);
      for (const kart of this.karts) {
        if (box.checkCollision(kart.state.position)) {
          const slot = this.itemSlots.get(kart.index)!;
          if (!slot.hasItem() && !slot.isRolling) {
            box.collect();
            slot.startRoll(kart.racePosition - 1);
            if (kart.isPlayer) {
              const pIdx = this.getPlayerIndex(kart);
              if (pIdx === 0) this.audio.playItemGet();
              this.frameEventsArr[pIdx].playerItemGet = true;
            }
          }
        }
      }
    }

    // Update item slots
    for (const [, slot] of this.itemSlots) {
      slot.update(dt);
    }

    // Assign rolled items to AI karts
    for (let i = this.playerCount; i < TOTAL_RACERS; i++) {
      const slot = this.itemSlots.get(i)!;
      if (slot.currentItem && !this.karts[i].heldItem) {
        this.karts[i].heldItem = slot.currentItem;
      }
    }

    // Update projectiles
    this.updateProjectiles(dt);

    // Star updates
    for (const kart of this.karts) {
      if (kart.state.starTimer > 0) {
        updateStar(kart, dt);
      }
      if (kart.state.shrinkTimer > 0) {
        kart.state.shrinkTimer -= dt;
      }
    }

    // Meadow cows AI + collisions
    if (this.meadowCows) {
      this.meadowCows.update(dt, this.karts, this.trackSpline);
      const cowHitPlayer = this.meadowCows.checkCollisions(this.karts);
      if (cowHitPlayer) {
        this.audio.playHit();
        // Mark hit on P1 events (cow collision doesn't specify which player)
        this.frameEventsArr[0].playerHit = true;
      }
    }

    // Coastal pedestrians AI
    if (this.coastalPedestrians) {
      this.coastalPedestrians.update(dt, this.karts, this.trackSpline);
    }

    // Check if players are targeted by red shell
    for (const shell of this.redShells) {
      if (!shell.active) continue;
      for (let p = 0; p < this.playerCount; p++) {
        if (shell.targetId === this.playerKarts[p].index) {
          this.frameEventsArr[p].isPlayerTargeted = true;
        }
      }
    }

    // Position & lap tracking
    const lapEvents = this.lapTracker.update(this.karts, this.raceTimer.elapsed);
    this.positionTracker.update(this.karts);
    this.rubberBanding.apply(this.karts);

    // Check for player lap changes
    for (let p = 0; p < this.playerCount; p++) {
      const currentLap = this.playerKarts[p].currentLap;
      if (currentLap > this.lastPlayerLaps[p] && this.lastPlayerLaps[p] > 0) {
        this.frameEventsArr[p].lapCompleted = currentLap + 1; // 1-indexed
      }
      this.lastPlayerLaps[p] = currentLap;
    }

    // Check if race finished — all players must finish
    const allPlayersFinished = this.playerKarts.every(k => k.finished);
    if (allPlayersFinished) {
      this.state = 'finished';
      this.raceTimer.stop();
      this.audio.stopEngine();
    }

    // Shadow follows P1
    this.lighting.updateShadowTarget(
      this.playerKarts[0].state.position.x,
      this.playerKarts[0].state.position.z,
    );
  }

  updateRender(alpha: number, camera: THREE.Camera): void {
    for (const kart of this.karts) {
      kart.interpolateRender(alpha);
      this.animator.update(kart, 1 / 60);

      // Star rainbow effect — glow entire kart group
      if (kart.state.starTimer > 0) {
        const hue = (Date.now() * 0.003) % 1;
        kart.meshes.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat && mat.emissive) {
              mat.emissive.setHSL(hue, 1, 0.5);
              mat.emissiveIntensity = 1;
            }
          }
        });
      } else {
        kart.meshes.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat && mat.emissive) {
              mat.emissiveIntensity = 0;
            }
          }
        });
      }
    }

    // Player particles (P1 only for now — keeps particle count manageable)
    const pk = this.playerKarts[0];
    const isBoosting = pk.state.boostTimer > 0;

    this.driftSparks.update(
      this.particlePool, pk.renderPosition, pk.forward,
      pk.state.driftDirection, this.playerDrifts[0].stage, 1 / 60,
    );
    this.boostFlame.update(this.particlePool, pk.renderPosition, pk.forward, isBoosting, 1 / 60);

    const surface = this.trackCollider.query(pk.state.position, 0);
    this.dustTrail.update(
      this.particlePool, pk.renderPosition, pk.forward,
      Math.abs(pk.state.speed), pk.state.isDrifting,
      surface?.surfaceType === 'offroad', 1 / 60,
    );

    this.starSparkle.update(this.particlePool, pk.renderPosition, pk.state.starTimer > 0, 1 / 60);

    this.speedSparks.update(
      this.particlePool, pk.renderPosition, pk.forward,
      Math.abs(pk.state.speed), pk.state.isGrounded, 1 / 60,
    );

    // Shell trail particles
    for (const shell of this.greenShells) {
      if (shell.active) {
        this.shellTrail.emitGreen(this.particlePool, shell.position);
      }
    }
    for (const shell of this.redShells) {
      if (shell.active) {
        this.shellTrail.emitRed(this.particlePool, shell.position);
      }
    }

    this.lightningStrike.update(1 / 60, this.sceneManager.scene);
    this.snowEffect?.update(1 / 60, camera.position);
    this.volcanoEffect?.update(1 / 60, camera.position);
    this.meteorShowerEffect?.update(1 / 60, camera.position);
    // Loop fireworks — activate when player is on the vertical loop (antigravity + high Y)
    if (this.loopFireworks) {
      const onLoop = pk.state.onAntiGravity && pk.state.position.y > 70;
      this.loopFireworks.setActive(onLoop, pk.state.position);
      this.loopFireworks.update(1 / 60, pk.state.position);
    }
    this.particlePool.update(1 / 60, camera);
  }

  private getPlayerIndex(kart: Kart): number {
    for (let i = 0; i < this.playerKarts.length; i++) {
      if (this.playerKarts[i].index === kart.index) return i;
    }
    return 0;
  }

  private executeItem(kart: Kart, item: ItemType, playerIdx?: number): void {
    const pIdx = playerIdx ?? (kart.isPlayer ? this.getPlayerIndex(kart) : -1);

    switch (item) {
      case 'mushroom':
        useMushroom(kart);
        if (kart.isPlayer) {
          if (pIdx === 0) this.audio.playBoost();
          this.frameEventsArr[pIdx].playerUsedMushroom = true;
          MushroomBurst.emit(this.particlePool, kart.state.position, kart.forward);
        }
        break;

      case 'banana': {
        const pos = kart.state.position.clone().add(
          new THREE.Vector3(Math.sin(kart.state.heading), 0, Math.cos(kart.state.heading)).multiplyScalar(2)
        );
        const banana = createBanana(pos, kart.index);
        this.bananas.push(banana);
        this.sceneManager.add(banana.mesh);
        break;
      }

      case 'greenShell': {
        const shell = createGreenShell(kart.state.position.clone(), kart.state.heading, kart.index);
        this.greenShells.push(shell);
        this.sceneManager.add(shell.mesh);
        break;
      }

      case 'redShell': {
        const targetKart = this.karts
          .filter(k => k.index !== kart.index && k.racePosition < kart.racePosition)
          .sort((a, b) => b.racePosition - a.racePosition)[0];

        if (!targetKart) {
          const shell = createRedShell(kart.state.position.clone(), kart.state.heading, kart.index, -1);
          this.redShells.push(shell);
          this.sceneManager.add(shell.mesh);
        } else {
          const shell = createRedShell(kart.state.position.clone(), kart.state.heading, kart.index, targetKart.index);
          this.redShells.push(shell);
          this.sceneManager.add(shell.mesh);
        }
        break;
      }

      case 'star':
        useStar(kart);
        if (kart.isPlayer) {
          this.frameEventsArr[pIdx].playerUsedStar = true;
        }
        break;

      case 'lightning':
        useLightning(kart, this.karts);
        for (const target of this.karts) {
          if (target.index === kart.index) continue;
          if (target.state.starTimer > 0) continue;
          this.lightningStrike.strike(
            target.state.position.clone(),
            this.sceneManager.scene,
            this.particlePool,
          );
        }
        this.audio.playLightning();
        if (kart.isPlayer) {
          this.frameEventsArr[pIdx].playerUsedLightning = true;
        }
        break;
    }

    // Clear the item slot
    const slot = this.itemSlots.get(kart.index);
    if (slot) {
      slot.currentItem = null;
      slot.displayItem = null;
    }
  }

  private updateProjectiles(dt: number): void {
    // Bananas
    for (let i = this.bananas.length - 1; i >= 0; i--) {
      const banana = this.bananas[i];
      if (!banana.active) {
        this.sceneManager.remove(banana.mesh);
        this.bananas.splice(i, 1);
        continue;
      }
      for (const kart of this.karts) {
        if (checkBananaCollision(banana, kart)) {
          if (kart.isPlayer) {
            const pIdx = this.getPlayerIndex(kart);
            if (pIdx === 0) this.audio.playHit();
            this.frameEventsArr[pIdx].playerHit = true;
          }
          ItemExplosion.emit(this.particlePool, banana.position, 0xffdd00, 30);
        }
      }
    }

    // Green shells
    for (let i = this.greenShells.length - 1; i >= 0; i--) {
      const shell = this.greenShells[i];
      updateGreenShell(shell, dt, 12);
      if (!shell.active) {
        this.sceneManager.remove(shell.mesh);
        this.greenShells.splice(i, 1);
        continue;
      }
      const gClosest = this.trackSpline.findClosestT(shell.position);
      const gSp = this.trackSpline.getPointAt(gClosest);
      shell.mesh.position.y = gSp.position.y + 0.4;
      const gDx = shell.position.x - gSp.position.x;
      const gDz = shell.position.z - gSp.position.z;
      const gDist = Math.sqrt(gDx * gDx + gDz * gDz);
      if (gDist > gSp.width * 0.5) {
        const wallNormal = new THREE.Vector3(gDx, 0, gDz).normalize();
        bounceGreenShell(shell, wallNormal);
        const pushBack = gSp.width * 0.5 - 0.3;
        shell.position.x = gSp.position.x + wallNormal.x * pushBack;
        shell.position.z = gSp.position.z + wallNormal.z * pushBack;
      }
      for (const kart of this.karts) {
        if (kart.index === shell.ownerId) continue;
        if (checkGreenShellCollision(shell, kart)) {
          if (kart.isPlayer) {
            const pIdx = this.getPlayerIndex(kart);
            if (pIdx === 0) this.audio.playHit();
            this.frameEventsArr[pIdx].playerHit = true;
          }
          ItemExplosion.emit(this.particlePool, shell.position, 0x00ff44, 35);
        }
      }
    }

    // Red shells
    for (let i = this.redShells.length - 1; i >= 0; i--) {
      const shell = this.redShells[i];
      updateRedShell(shell, dt, this.karts);
      if (!shell.active) {
        this.sceneManager.remove(shell.mesh);
        this.redShells.splice(i, 1);
        continue;
      }
      const rClosest = this.trackSpline.findClosestT(shell.position);
      const rSp = this.trackSpline.getPointAt(rClosest);
      shell.mesh.position.y = rSp.position.y + 0.4;
      for (const kart of this.karts) {
        if (kart.index === shell.ownerId) continue;
        if (checkRedShellCollision(shell, kart)) {
          if (kart.isPlayer) {
            const pIdx = this.getPlayerIndex(kart);
            if (pIdx === 0) this.audio.playHit();
            this.frameEventsArr[pIdx].playerHit = true;
          }
          ItemExplosion.emit(this.particlePool, shell.position, 0xff2200, 40);
        }
      }
    }
  }

  getPlayerKart(index = 0): Kart {
    return this.playerKarts[index] ?? this.playerKarts[0];
  }

  getPlayerDriftStage(index = 0): DriftStage {
    return this.playerDrifts[index]?.stage ?? DriftStage.None;
  }

  getPlayerItemSlot(index = 0): ItemSlot {
    const kartIndex = this.playerKarts[index]?.index ?? 0;
    return this.itemSlots.get(kartIndex)!;
  }

  getRaceTime(): number {
    return this.raceTimer.elapsed;
  }

  getTrackSpline(): TrackSpline {
    return this.trackSpline;
  }

  getTrackCollider(): TrackCollider {
    return this.trackCollider;
  }

  getFrameEvents(index = 0): RaceEvents {
    return this.frameEventsArr[index] ?? this.frameEventsArr[0];
  }

  dispose(): void {
    this.lightningStrike.dispose(this.sceneManager.scene);
    this.snowEffect?.dispose();
    this.snowEffect = null;
    this.volcanoEffect?.dispose();
    this.volcanoEffect = null;
    this.meteorShowerEffect?.dispose();
    this.meteorShowerEffect = null;
    this.loopFireworks?.dispose();
    this.loopFireworks = null;
    this.meadowCows?.dispose();
    this.meadowCows = null;
    this.beachHouses?.dispose();
    this.beachHouses = null;
    this.coastalPedestrians?.dispose();
    this.coastalPedestrians = null;
    this.sceneManager.clear();
    this.audio.stopEngine();
    this.audio.stopDrift();
  }
}
