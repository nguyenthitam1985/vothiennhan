import { Question, SubjectId, WeaponType, ItemType, DayNightPhase, QuizPortal, ZombieType } from '../types/game';
import { sounds } from '../services/soundEngine';

export interface ZombieGameCallbacks {
  onTriggerQuiz: (
    questionNumber: number,
    question: Question,
    correctCount: number,
    wrongCount: number
  ) => void;
  onGameOver: (score: number, kills: number, reason: 'zombie_bite' | 'wrong_answers') => void;
  onVictory: (score: number, kills: number) => void;
  onStatsUpdate: (stats: {
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
    score: number;
    kills: number;
    weapon: WeaponType;
    shieldActive: boolean;
    shieldTimeRemaining: number;
    dayNightPhase: DayNightPhase;
    correctCount: number;
    targetCorrect: number;
    wrongCount: number;
    maxWrong: number;
    nextQuestionCountdown: number;
    currentWave: number;
    totalWaves: number;
    zombiesRemainingInWave: number;
    bossHp?: number;
    bossMaxHp?: number;
  }) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface BloodSplatter {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
}

interface DamagePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isPlayer: boolean;
  damage: number;
  color: string;
  isLaser?: boolean;
  isRocket?: boolean;
  pierceCount?: number;
}

interface DropItem {
  x: number;
  y: number;
  type: ItemType;
  radius: number;
  vy: number;
  floatOffset: number;
}

interface SupplyCrate {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  itemInside: ItemType;
  destroyed: boolean;
}

interface Zombie {
  id: string;
  type: ZombieType;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  angle: number;
  color: string;
  attackCooldown: number;
  spitCooldown: number;
  walkFrame: number;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'wrecked_car' | 'barricade' | 'barrel' | 'building';
  color: string;
}

export class ZombieGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: ZombieGameCallbacks;
  private questions: Question[];
  private subject: SubjectId;

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  // Map world size (2600 x 1800)
  public readonly MAP_WIDTH = 2600;
  public readonly MAP_HEIGHT = 1800;
  private cameraX: number = 0;
  private cameraY: number = 0;
  private screenShake: number = 0;

  // Day / Night horror cycle (38s full cycle)
  private timeOfDay: number = 0;
  private readonly CYCLE_DURATION: number = 38;
  private currentPhase: DayNightPhase = 'DAY';

  // 10-Second Periodic Question System
  public questionTimer: number = 10;
  public readonly QUESTION_INTERVAL: number = 10; // Cứ 10 giây xuất hiện 1 câu hỏi
  public correctCount: number = 0;
  public readonly TARGET_CORRECT: number = 6; // Đúng 6 câu là CHIẾN THẮNG
  public wrongCount: number = 0;
  public readonly MAX_WRONG: number = 3; // Sai 3 câu là THUA
  private questionIndexCounter: number = 0;

  // Wave & Ramp-Up Spawner System (zombie xuất hiện từ từ)
  public currentWave: number = 1;
  public readonly TOTAL_WAVES: number = 5;
  private zombiesSpawnedInWave: number = 0;
  private maxZombiesInWave: number = 4; // Wave 1: Chỉ 4 zombie, xuất hiện từ từ
  private waveSpawnTimer: number = 0;
  private waveSpawnInterval: number = 4.0;

  // Player character (SWAT / Zombie Hunter)
  public player = {
    x: 250,
    y: 900,
    radius: 19,
    speed: 4.8,
    angle: 0, // 360-degree rotation
    hp: 100,
    maxHp: 100,
    mana: 100,
    maxMana: 100,
    score: 0,
    kills: 0,
    weapon: 'NORMAL' as WeaponType,
    shootCooldown: 0,
    shieldActive: false,
    shieldTimeRemaining: 0,
    muzzleFlash: 0,
    walkFrame: 0,
  };

  public mouseAim = {
    canvasX: 0,
    canvasY: 0,
    active: false,
    hasMoved: false,
  };

  public keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false,
    skill: false,
  };

  // World elements
  private bullets: Bullet[] = [];
  private zombies: Zombie[] = [];
  private supplyCrates: SupplyCrate[] = [];
  private dropItems: DropItem[] = [];
  private particles: Particle[] = [];
  private bloodSplatters: BloodSplatter[] = [];
  private damagePopups: DamagePopup[] = [];
  private portals: QuizPortal[] = [];
  private obstacles: Obstacle[] = [];

  // Boss state
  private bossSpawned: boolean = false;
  private bossRef: Zombie | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    questions: Question[],
    subject: SubjectId,
    callbacks: ZombieGameCallbacks
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context');
    this.ctx = ctx;
    this.questions = questions;
    this.subject = subject;
    this.callbacks = callbacks;

    this.initLevel();
  }

  private initLevel() {
    this.bullets = [];
    this.zombies = [];
    this.supplyCrates = [];
    this.dropItems = [];
    this.particles = [];
    this.bloodSplatters = [];
    this.damagePopups = [];
    this.portals = [];
    this.obstacles = [];
    this.bossSpawned = false;
    this.bossRef = null;

    // Reset Rules: 10s timer, 6 correct to win, 3 wrong to lose
    this.questionTimer = this.QUESTION_INTERVAL;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.questionIndexCounter = 0;

    // Reset Wave
    this.currentWave = 1;
    this.zombiesSpawnedInWave = 0;
    this.maxZombiesInWave = 4;
    this.waveSpawnTimer = 0;
    this.waveSpawnInterval = 4.0;

    this.initObstacles();

    // Crates
    const crateConfigs: [number, number, ItemType][] = [
      [450, 400, 'MACHINE_GUN'],
      [680, 1300, 'SPREAD_GUN'],
      [1100, 500, 'MUSHROOM'],
      [1350, 1400, 'LASER_GUN'],
      [1750, 450, 'MUSHROOM'],
      [1950, 1250, 'SPREAD_GUN'],
      [2400, 900, 'MACHINE_GUN'],
    ];

    crateConfigs.forEach(([x, y, item]) => {
      this.supplyCrates.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        hp: 35,
        itemInside: item,
        destroyed: false,
      });
    });

    // Mới vào chỉ có 2 zombie chậm rãi từ xa để làm quen!
    this.spawnSingleZombie('walker', 680, 860);
    this.spawnSingleZombie('walker', 720, 940);
    this.zombiesSpawnedInWave = 2;
  }

  private initObstacles() {
    this.obstacles = [
      { x: 0, y: 0, w: this.MAP_WIDTH, h: 40, type: 'building', color: '#1e293b' },
      { x: 0, y: this.MAP_HEIGHT - 40, w: this.MAP_WIDTH, h: 40, type: 'building', color: '#1e293b' },
      { x: 420, y: 650, w: 90, h: 50, type: 'wrecked_car', color: '#334155' },
      { x: 550, y: 1100, w: 100, h: 55, type: 'wrecked_car', color: '#475569' },
      { x: 480, y: 1250, w: 35, h: 35, type: 'barrel', color: '#16a34a' },
      { x: 620, y: 400, w: 35, h: 35, type: 'barrel', color: '#ca8a04' },
      { x: 1050, y: 700, w: 95, h: 55, type: 'wrecked_car', color: '#dc2626' },
      { x: 1250, y: 1150, w: 90, h: 50, type: 'wrecked_car', color: '#0284c7' },
      { x: 1100, y: 350, w: 40, h: 40, type: 'barrel', color: '#16a34a' },
      { x: 1350, y: 750, w: 40, h: 40, type: 'barrel', color: '#ca8a04' },
      { x: 1400, y: 1300, w: 40, h: 40, type: 'barrel', color: '#16a34a' },
      { x: 1750, y: 650, w: 110, h: 60, type: 'wrecked_car', color: '#1e293b' },
      { x: 1900, y: 1100, w: 100, h: 55, type: 'wrecked_car', color: '#334155' },
      { x: 1800, y: 1350, w: 45, h: 45, type: 'barrel', color: '#16a34a' },
      { x: 2350, y: 600, w: 45, h: 45, type: 'barrel', color: '#dc2626' },
      { x: 2350, y: 1200, w: 45, h: 45, type: 'barrel', color: '#dc2626' },
    ];
  }

  // ===================== PLAYER TURNING =====================
  public turnPlayer(angleDelta: number) {
    this.player.angle += angleDelta;
  }

  public turnAround() {
    this.player.angle += Math.PI;
  }

  public setMouseAim(canvasX: number, canvasY: number, active: boolean = true) {
    this.mouseAim.canvasX = canvasX;
    this.mouseAim.canvasY = canvasY;
    this.mouseAim.active = active;
    this.mouseAim.hasMoved = true;

    const targetAimX = canvasX + this.cameraX;
    const targetAimY = canvasY + this.cameraY;
    this.player.angle = Math.atan2(targetAimY - this.player.y, targetAimX - this.player.x);
  }

  // ===================== WAVE SPAWNER =====================
  private spawnSingleZombie(type: ZombieType, x?: number, y?: number) {
    const isRunner = type === 'runner';
    const isTank = type === 'tank';
    const isSpitter = type === 'spitter';

    const spawnX =
      x !== undefined
        ? x
        : this.player.x + (Math.random() > 0.5 ? 1 : -1) * (480 + Math.random() * 200);
    const spawnY =
      y !== undefined
        ? y
        : this.player.y + (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 200);

    const clampedX = Math.max(80, Math.min(this.MAP_WIDTH - 80, spawnX));
    const clampedY = Math.max(80, Math.min(this.MAP_HEIGHT - 80, spawnY));

    this.zombies.push({
      id: `z_${Date.now()}_${Math.random()}`,
      type,
      x: clampedX,
      y: clampedY,
      radius: isTank ? 32 : isRunner ? 16 : 19,
      hp: isTank ? 200 : isSpitter ? 50 : isRunner ? 28 : 40,
      maxHp: isTank ? 200 : isSpitter ? 50 : isRunner ? 28 : 40,
      speed: isTank ? 1.4 : isRunner ? 3.6 : isSpitter ? 1.8 : 2.0,
      angle: 0,
      color: isTank ? '#7c2d12' : isSpitter ? '#84cc16' : isRunner ? '#ef4444' : '#22c55e',
      attackCooldown: 0,
      spitCooldown: 60 + Math.random() * 60,
      walkFrame: Math.random() * 10,
    });
  }

  private updateWaveSpawner(dt: number) {
    if (this.zombiesSpawnedInWave < this.maxZombiesInWave) {
      this.waveSpawnTimer += dt;
      if (this.waveSpawnTimer >= this.waveSpawnInterval) {
        this.waveSpawnTimer = 0;
        this.zombiesSpawnedInWave += 1;

        let type: ZombieType = 'walker';
        if (this.currentWave === 2) {
          type = Math.random() < 0.3 ? 'runner' : 'walker';
        } else if (this.currentWave === 3) {
          type = Math.random() < 0.3 ? 'spitter' : Math.random() < 0.35 ? 'runner' : 'walker';
        } else if (this.currentWave >= 4) {
          type = Math.random() < 0.25 ? 'tank' : Math.random() < 0.3 ? 'spitter' : Math.random() < 0.3 ? 'runner' : 'walker';
        }

        this.spawnSingleZombie(type);
      }
    } else if (this.zombies.length === 0 && !this.bossSpawned) {
      if (this.currentWave < this.TOTAL_WAVES) {
        this.currentWave += 1;
        this.zombiesSpawnedInWave = 0;
        this.maxZombiesInWave = this.currentWave * 4 + 2;
        this.waveSpawnInterval = Math.max(1.8, 4.0 - this.currentWave * 0.5);
      } else if (!this.bossSpawned) {
        this.spawnBoss();
      }
    }
  }

  private spawnBoss() {
    this.bossSpawned = true;
    sounds.zombieRoar();

    const boss: Zombie = {
      id: 'boss_mutant_overlord',
      type: 'boss_mutant',
      x: 2350,
      y: 900,
      radius: 46,
      hp: 650,
      maxHp: 650,
      speed: 1.6,
      angle: 0,
      color: '#991b1b',
      attackCooldown: 0,
      spitCooldown: 40,
      walkFrame: 0,
    };

    this.zombies.push(boss);
    this.bossRef = boss;
    this.screenShake = 16;

    for (let i = 0; i < 40; i++) {
      const ang = (i / 40) * Math.PI * 2;
      this.particles.push({
        x: boss.x,
        y: boss.y,
        vx: Math.cos(ang) * 6,
        vy: Math.sin(ang) * 6,
        color: '#dc2626',
        size: 5,
        life: 0,
        maxLife: 35,
      });
    }
  }

  // ===================== 10-SECOND QUESTION SYSTEM =====================
  // Cứ mỗi 10 giây xuất hiện 1 câu hỏi trắc nghiệm
  private triggerPeriodicQuiz() {
    if (this.isPaused) return;

    this.pause();
    this.questionIndexCounter += 1;
    const qIndex = (this.questionIndexCounter - 1) % this.questions.length;
    const question = this.questions[qIndex];

    this.callbacks.onTriggerQuiz(
      this.questionIndexCounter,
      question,
      this.correctCount,
      this.wrongCount
    );
  }

  // Xử lý kết quả trả lời: đúng thì CỘNG MÁU, sai thì chạy bắn tiếp như thường!
  public handleQuizResult(isCorrect: boolean) {
    if (isCorrect) {
      // TRẢ LỜI ĐÚNG: CỘNG MÁU (+40 HP), HỒI MANA
      sounds.quizCorrect();
      sounds.itemPickup();

      this.correctCount += 1;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
      this.player.mana = Math.min(this.player.maxMana, this.player.mana + 35);
      this.player.score += 500;

      this.damagePopups.push({
        x: this.player.x,
        y: this.player.y - 28,
        text: `+40 MÁU! (ĐÚNG ${this.correctCount}/6)`,
        color: '#10b981',
        life: 0,
        maxLife: 45,
      });

      // Kiểm tra: ĐÚNG ĐỦ 6 CÂU THÌ DÀNH CHIẾN THẮNG!
      if (this.correctCount >= this.TARGET_CORRECT) {
        sounds.victory();
        this.stop();
        this.callbacks.onVictory(this.player.score, this.player.kills);
        return;
      }
    } else {
      // TRẢ LỜI SAI: BỊ TÍNH 1 LỖI SAI, KHÔNG ĐƯỢC CỘNG MÁU
      sounds.quizWrong();
      this.wrongCount += 1;

      this.damagePopups.push({
        x: this.player.x,
        y: this.player.y - 28,
        text: `SAI CÂU ${this.wrongCount}/3!`,
        color: '#ef4444',
        life: 0,
        maxLife: 45,
      });

      // Kiểm tra: SAI 3 CÂU LÀ THUA!
      if (this.wrongCount >= this.MAX_WRONG) {
        sounds.gameOver();
        this.stop();
        this.callbacks.onGameOver(this.player.score, this.player.kills, 'wrong_answers');
        return;
      }
    }

    // Tiếp tục chạy bắn zombie như thường, đặt lại 10s cho câu hỏi tiếp theo
    this.questionTimer = this.QUESTION_INTERVAL;
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  public activateSkill() {
    if (this.player.mana >= 35 && !this.player.shieldActive) {
      this.player.mana -= 35;
      this.player.shieldActive = true;
      this.player.shieldTimeRemaining = 6.0;
      sounds.shieldActivate();

      for (const z of this.zombies) {
        const dist = Math.hypot(z.x - this.player.x, z.y - this.player.y);
        if (dist < 220) {
          const pushAng = Math.atan2(z.y - this.player.y, z.x - this.player.x);
          z.x += Math.cos(pushAng) * 80;
          z.y += Math.sin(pushAng) * 80;
          z.hp -= 35;
          sounds.hit();
        }
      }

      for (let i = 0; i < 36; i++) {
        const ang = (i / 36) * Math.PI * 2;
        this.particles.push({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(ang) * 5,
          vy: Math.sin(ang) * 5,
          color: '#38bdf8',
          size: 4,
          life: 0,
          maxLife: 30,
        });
      }
    }
  }

  public start() {
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  private loop = (currentTime: number = performance.now()) => {
    if (!this.isRunning) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.update(dt);
    }
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // 1. Day / Night Cycle
    this.timeOfDay = (this.timeOfDay + dt) % this.CYCLE_DURATION;
    const third = this.CYCLE_DURATION / 3;
    if (this.timeOfDay < third) {
      this.currentPhase = 'DAY';
    } else if (this.timeOfDay < third * 2) {
      this.currentPhase = 'SUNSET';
    } else {
      this.currentPhase = 'NIGHT';
    }

    // 2. Mana passive recovery
    this.player.mana = Math.min(this.player.maxMana, this.player.mana + dt * 4);

    // 3. Shield countdown
    if (this.player.shieldActive) {
      this.player.shieldTimeRemaining -= dt;
      if (this.player.shieldTimeRemaining <= 0) {
        this.player.shieldActive = false;
      }
    }

    if (this.player.muzzleFlash > 0) {
      this.player.muzzleFlash -= dt * 60;
    }

    if (this.screenShake > 0) {
      this.screenShake -= dt * 30;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    // 4. 10-Second Question Timer (Đếm ngược 10 giây để ra câu hỏi)
    this.questionTimer -= dt;
    if (this.questionTimer <= 0) {
      this.questionTimer = this.QUESTION_INTERVAL;
      this.triggerPeriodicQuiz();
      return;
    }

    // 5. Progressive Wave Spawner (Xuất hiện từ từ)
    this.updateWaveSpawner(dt);

    // 6. Player 8-direction Movement (WASD / Arrows)
    let moveX = 0;
    let moveY = 0;
    if (this.keys.left) moveX -= 1;
    if (this.keys.right) moveX += 1;
    if (this.keys.up) moveY -= 1;
    if (this.keys.down) moveY += 1;

    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }

    const isMoving = moveX !== 0 || moveY !== 0;
    if (isMoving) {
      this.player.walkFrame += dt * 9;
    }

    // Turn towards movement if mouse has not moved
    if (!this.mouseAim.hasMoved && isMoving) {
      this.player.angle = Math.atan2(moveY, moveX);
    }

    const nextPx = this.player.x + moveX * this.player.speed;
    const nextPy = this.player.y + moveY * this.player.speed;

    let canMoveX = true;
    let canMoveY = true;
    for (const obs of this.obstacles) {
      if (
        nextPx + this.player.radius > obs.x &&
        nextPx - this.player.radius < obs.x + obs.w &&
        this.player.y + this.player.radius > obs.y &&
        this.player.y - this.player.radius < obs.y + obs.h
      ) {
        canMoveX = false;
      }
      if (
        this.player.x + this.player.radius > obs.x &&
        this.player.x - this.player.radius < obs.x + obs.w &&
        nextPy + this.player.radius > obs.y &&
        nextPy - this.player.radius < obs.y + obs.h
      ) {
        canMoveY = false;
      }
    }

    if (canMoveX) this.player.x = nextPx;
    if (canMoveY) this.player.y = nextPy;

    this.player.x = Math.max(30, Math.min(this.MAP_WIDTH - 30, this.player.x));
    this.player.y = Math.max(40, Math.min(this.MAP_HEIGHT - 40, this.player.y));

    // Smooth camera follow
    const targetCamX = this.player.x - this.canvas.width / 2;
    const targetCamY = this.player.y - this.canvas.height / 2;
    this.cameraX += (targetCamX - this.cameraX) * 0.14;
    this.cameraY += (targetCamY - this.cameraY) * 0.14;
    this.cameraX = Math.max(0, Math.min(this.MAP_WIDTH - this.canvas.width, this.cameraX));
    this.cameraY = Math.max(0, Math.min(this.MAP_HEIGHT - this.canvas.height, this.cameraY));

    // 7. Shooting controls
    if (this.player.shootCooldown > 0) {
      this.player.shootCooldown -= dt * 60;
    }
    if (this.keys.shoot && this.player.shootCooldown <= 0) {
      this.firePlayerWeapon();
    }
    if (this.keys.skill) {
      this.activateSkill();
    }

    // 8. Supply Crates drifting & bobbing
    for (const crate of this.supplyCrates) {
      if (crate.destroyed) continue;
      crate.x += crate.vx;
      crate.y += crate.vy;
      if (crate.x < 150 || crate.x > this.MAP_WIDTH - 150) crate.vx *= -1;
      if (crate.y < 200 || crate.y > this.MAP_HEIGHT - 200) crate.vy *= -1;
    }

    // 9. Drop Items pickup
    for (let i = this.dropItems.length - 1; i >= 0; i--) {
      const item = this.dropItems[i];
      item.floatOffset += dt * 3;
      const dist = Math.hypot(this.player.x - item.x, this.player.y - item.y);
      if (dist < this.player.radius + item.radius + 6) {
        if (item.type === 'MUSHROOM') {
          this.player.hp = this.player.maxHp;
          this.player.mana = this.player.maxMana;
          this.player.score += 250;
        } else if (item.type === 'MACHINE_GUN') {
          this.player.weapon = 'MACHINE_GUN';
          this.player.score += 180;
        } else if (item.type === 'SPREAD_GUN') {
          this.player.weapon = 'SPREAD';
          this.player.score += 180;
        } else if (item.type === 'LASER_GUN') {
          this.player.weapon = 'LASER';
          this.player.score += 200;
        } else if (item.type === 'ROCKET_LAUNCHER') {
          this.player.weapon = 'ROCKET';
          this.player.score += 220;
        }
        sounds.itemPickup();
        this.dropItems.splice(i, 1);
      }
    }

    // 10. Bullets update & collision
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      if (b.isRocket && Math.random() < 0.6) {
        this.particles.push({
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          color: '#cbd5e1',
          size: 3,
          life: 0,
          maxLife: 15,
        });
      }

      if (b.x < 0 || b.x > this.MAP_WIDTH || b.y < 0 || b.y > this.MAP_HEIGHT) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.isPlayer) {
        for (const crate of this.supplyCrates) {
          if (!crate.destroyed && Math.hypot(b.x - crate.x, b.y - crate.y) < 26) {
            crate.hp -= b.damage;
            sounds.hit();
            if (crate.hp <= 0) {
              crate.destroyed = true;
              sounds.supplyDrop();
              sounds.explosion();
              this.dropItems.push({
                x: crate.x,
                y: crate.y,
                type: crate.itemInside,
                radius: 17,
                vy: 0,
                floatOffset: 0,
              });
            }
            if (!b.isLaser) {
              this.bullets.splice(i, 1);
              break;
            }
          }
        }

        // Hit Zombies
        for (let j = this.zombies.length - 1; j >= 0; j--) {
          const z = this.zombies[j];
          if (Math.hypot(b.x - z.x, b.y - z.y) < z.radius + b.radius) {
            z.hp -= b.damage;
            sounds.hit();

            if (Math.random() < 0.4) {
              this.bloodSplatters.push({
                x: z.x + (Math.random() - 0.5) * 14,
                y: z.y + (Math.random() - 0.5) * 14,
                radius: 6 + Math.random() * 10,
                color: z.type === 'spitter' ? '#65a30d' : '#991b1b',
                alpha: 0.55,
              });
            }

            this.damagePopups.push({
              x: z.x + (Math.random() - 0.5) * 12,
              y: z.y - 14,
              text: `-${b.damage}`,
              color: b.isLaser ? '#06b6d4' : b.isRocket ? '#ef4444' : '#facc15',
              life: 0,
              maxLife: 22,
            });

            const knockAng = Math.atan2(b.vy, b.vx);
            const knockDist = b.isRocket ? 25 : this.player.weapon === 'SPREAD' ? 16 : 6;
            z.x += Math.cos(knockAng) * knockDist;
            z.y += Math.sin(knockAng) * knockDist;

            if (b.isRocket) {
              this.screenShake = 12;
              sounds.explosion();
              for (const otherZ of this.zombies) {
                const blastDist = Math.hypot(b.x - otherZ.x, b.y - otherZ.y);
                if (blastDist < 110 && otherZ !== z) {
                  otherZ.hp -= 50;
                }
              }
            }

            // Zombie death check
            if (z.hp <= 0) {
              sounds.zombieBite();
              this.player.kills += 1;
              this.player.score += z.type === 'boss_mutant' ? 3000 : z.type === 'tank' ? 300 : z.type === 'spitter' ? 160 : 100;
              this.player.mana = Math.min(this.player.maxMana, this.player.mana + (z.type === 'tank' ? 25 : 12));

              this.bloodSplatters.push({
                x: z.x,
                y: z.y,
                radius: z.radius * 1.3,
                color: z.type === 'spitter' ? '#4d7c0f' : '#7f1d1d',
                alpha: 0.7,
              });

              if (Math.random() < 0.16 && z.type !== 'boss_mutant') {
                const dropTypes: ItemType[] = ['MUSHROOM', 'MACHINE_GUN', 'SPREAD_GUN'];
                this.dropItems.push({
                  x: z.x,
                  y: z.y,
                  type: dropTypes[Math.floor(Math.random() * dropTypes.length)],
                  radius: 16,
                  vy: 0,
                  floatOffset: 0,
                });
              }

              if (z.type === 'boss_mutant') {
                this.zombies.splice(j, 1);
                sounds.victory();
                this.callbacks.onVictory(this.player.score, this.player.kills);
                this.stop();
                return;
              }

              this.zombies.splice(j, 1);
            }

            if (!b.isLaser) {
              this.bullets.splice(i, 1);
              break;
            } else {
              b.pierceCount = (b.pierceCount || 0) + 1;
              if (b.pierceCount > 5) {
                this.bullets.splice(i, 1);
                break;
              }
            }
          }
        }
      } else {
        // Enemy bullet hitting player
        if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < this.player.radius + b.radius) {
          if (!this.player.shieldActive) {
            this.player.hp -= b.damage;
            sounds.hit();
            this.screenShake = 6;
            // NẾU BỊ ZOMBIE CẮN CHẾT (HP <= 0) THÌ THUA!
            if (this.player.hp <= 0) {
              sounds.gameOver();
              this.stop();
              this.callbacks.onGameOver(this.player.score, this.player.kills, 'zombie_bite');
              return;
            }
          }
          this.bullets.splice(i, 1);
        }
      }
    }

    // 11. Zombie AI & Biting
    for (const z of this.zombies) {
      z.walkFrame += dt * 8;
      const dx = this.player.x - z.x;
      const dy = this.player.y - z.y;
      const dist = Math.hypot(dx, dy);

      z.angle = Math.atan2(dy, dx);
      const nightMultiplier = this.currentPhase === 'NIGHT' ? 1.25 : 1.0;

      // Contact attack (Zombie cắn người chơi)
      if (dist < this.player.radius + z.radius) {
        z.attackCooldown -= dt * 60;
        if (z.attackCooldown <= 0) {
          z.attackCooldown = 35;
          if (!this.player.shieldActive) {
            const biteDmg = z.type === 'boss_mutant' ? 30 : z.type === 'tank' ? 24 : 12;
            this.player.hp -= biteDmg;
            sounds.hit();
            this.screenShake = 7;
            // NẾU BỊ ZOMBIE CẮN CHẾT (HP <= 0) THÌ THUA!
            if (this.player.hp <= 0) {
              sounds.gameOver();
              this.stop();
              this.callbacks.onGameOver(this.player.score, this.player.kills, 'zombie_bite');
              return;
            }
          } else {
            sounds.hit();
            z.x -= Math.cos(z.angle) * 30;
            z.y -= Math.sin(z.angle) * 30;
          }
        }
      }

      if (z.type === 'walker') {
        z.x += Math.cos(z.angle) * z.speed * nightMultiplier;
        z.y += Math.sin(z.angle) * z.speed * nightMultiplier;
      } else if (z.type === 'runner') {
        const zigzag = Math.sin(z.walkFrame * 0.8) * 0.35;
        const stalkAngle = z.angle + zigzag;
        z.x += Math.cos(stalkAngle) * z.speed * nightMultiplier;
        z.y += Math.sin(stalkAngle) * z.speed * nightMultiplier;
      } else if (z.type === 'spitter') {
        if (dist > 280) {
          z.x += Math.cos(z.angle) * z.speed;
          z.y += Math.sin(z.angle) * z.speed;
        } else if (dist < 180) {
          z.x -= Math.cos(z.angle) * (z.speed * 0.8);
          z.y -= Math.sin(z.angle) * (z.speed * 0.8);
        }

        z.spitCooldown -= dt * 60;
        if (dist < 550 && z.spitCooldown <= 0) {
          z.spitCooldown = 90 + Math.random() * 40;
          sounds.shootEnemy();
          this.bullets.push({
            x: z.x + Math.cos(z.angle) * 20,
            y: z.y + Math.sin(z.angle) * 20,
            vx: Math.cos(z.angle) * 4.4,
            vy: Math.sin(z.angle) * 4.4,
            radius: 6,
            isPlayer: false,
            damage: 16,
            color: '#84cc16',
          });
        }
      } else if (z.type === 'tank') {
        z.x += Math.cos(z.angle) * z.speed * nightMultiplier;
        z.y += Math.sin(z.angle) * z.speed * nightMultiplier;
      } else if (z.type === 'boss_mutant') {
        z.x += Math.cos(z.angle) * z.speed;
        z.y += Math.sin(z.angle) * z.speed;

        z.spitCooldown -= dt * 60;
        if (z.spitCooldown <= 0) {
          z.spitCooldown = 65;
          sounds.zombieRoar();
          const spreadAngles = [-0.3, 0, 0.3];
          spreadAngles.forEach((ang) => {
            const finalAng = z.angle + ang;
            this.bullets.push({
              x: z.x + Math.cos(finalAng) * 35,
              y: z.y + Math.sin(finalAng) * 35,
              vx: Math.cos(finalAng) * 4.6,
              vy: Math.sin(finalAng) * 4.6,
              radius: 8,
              isPlayer: false,
              damage: 22,
              color: '#dc2626',
            });
          });
        }
      }
    }

    // 12. Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life += 1;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.damagePopups.length - 1; i >= 0; i--) {
      const d = this.damagePopups[i];
      d.y -= 0.6;
      d.life += 1;
      if (d.life >= d.maxLife) {
        this.damagePopups.splice(i, 1);
      }
    }

    if (this.bloodSplatters.length > 80) {
      this.bloodSplatters.splice(0, this.bloodSplatters.length - 80);
    }

    // 13. Send stats update to React HUD
    this.callbacks.onStatsUpdate({
      hp: Math.max(0, Math.round(this.player.hp)),
      maxHp: this.player.maxHp,
      mana: Math.max(0, Math.round(this.player.mana)),
      maxMana: this.player.maxMana,
      score: this.player.score,
      kills: this.player.kills,
      weapon: this.player.weapon,
      shieldActive: this.player.shieldActive,
      shieldTimeRemaining: Math.ceil(this.player.shieldTimeRemaining),
      dayNightPhase: this.currentPhase,
      correctCount: this.correctCount,
      targetCorrect: this.TARGET_CORRECT,
      wrongCount: this.wrongCount,
      maxWrong: this.MAX_WRONG,
      nextQuestionCountdown: Math.max(0, Math.ceil(this.questionTimer)),
      currentWave: this.currentWave,
      totalWaves: this.TOTAL_WAVES,
      zombiesRemainingInWave: Math.max(0, this.maxZombiesInWave - this.zombiesSpawnedInWave) + this.zombies.length,
      bossHp: this.bossRef ? Math.max(0, Math.round(this.bossRef.hp)) : undefined,
      bossMaxHp: this.bossRef ? this.bossRef.maxHp : undefined,
    });
  }

  private firePlayerWeapon() {
    const angle = this.player.angle;
    const startX = this.player.x + Math.cos(angle) * (this.player.radius + 12);
    const startY = this.player.y + Math.sin(angle) * (this.player.radius + 12);

    this.player.muzzleFlash = 4;

    const shellAng = angle - Math.PI / 2;
    this.particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(shellAng) * 2 + (Math.random() - 0.5) * 1.5,
      vy: Math.sin(shellAng) * 2 + (Math.random() - 0.5) * 1.5,
      color: '#eab308',
      size: 2.5,
      life: 0,
      maxLife: 20,
    });

    if (this.player.weapon === 'NORMAL') {
      this.player.shootCooldown = 10;
      sounds.shootNormal();
      this.bullets.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * 11,
        vy: Math.sin(angle) * 11,
        radius: 4,
        isPlayer: true,
        damage: 18,
        color: '#facc15',
      });
    } else if (this.player.weapon === 'MACHINE_GUN') {
      this.player.shootCooldown = 5;
      sounds.shootMachineGun();
      const spread = (Math.random() - 0.5) * 0.12;
      this.bullets.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle + spread) * 13,
        vy: Math.sin(angle + spread) * 13,
        radius: 4.5,
        isPlayer: true,
        damage: 17,
        color: '#fb923c',
      });
    } else if (this.player.weapon === 'SPREAD') {
      this.player.shootCooldown = 15;
      sounds.shootSpread();
      const spreadAngles = [-0.28, -0.14, 0, 0.14, 0.28];
      spreadAngles.forEach((angOffset) => {
        const finalAng = angle + angOffset;
        this.bullets.push({
          x: startX,
          y: startY,
          vx: Math.cos(finalAng) * 11.5,
          vy: Math.sin(finalAng) * 11.5,
          radius: 5,
          isPlayer: true,
          damage: 15,
          color: '#ef4444',
        });
      });
    } else if (this.player.weapon === 'LASER') {
      this.player.shootCooldown = 16;
      sounds.shootLaser();
      this.bullets.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * 18,
        vy: Math.sin(angle) * 18,
        radius: 7,
        isPlayer: true,
        damage: 48,
        color: '#06b6d4',
        isLaser: true,
        pierceCount: 0,
      });
    } else if (this.player.weapon === 'ROCKET') {
      this.player.shootCooldown = 22;
      sounds.shootRocket();
      this.bullets.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * 8.5,
        vy: Math.sin(angle) * 8.5,
        radius: 7.5,
        isPlayer: true,
        damage: 55,
        color: '#f97316',
        isRocket: true,
      });
    }
  }

  // ===================== RENDERING =====================

  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
    }
    ctx.translate(-this.cameraX + shakeX, -this.cameraY + shakeY);

    this.drawWorldGround(ctx);
    this.drawBloodSplatters(ctx);
    this.drawObstacles(ctx);
    this.drawSupplyCrates(ctx);
    this.drawDropItems(ctx);
    this.drawBullets(ctx);
    this.drawZombies(ctx);
    this.drawPlayer(ctx);
    this.drawParticles(ctx);
    this.drawDamagePopups(ctx);

    ctx.restore();

    this.drawNightDarkness(ctx, w, h);
    this.drawCrosshair(ctx);
  }

  private drawWorldGround(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.MAP_WIDTH, this.MAP_HEIGHT);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const tileSize = 80;
    for (let x = 0; x < this.MAP_WIDTH; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.MAP_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < this.MAP_HEIGHT; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.MAP_WIDTH, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(0, 900);
    ctx.lineTo(this.MAP_WIDTH, 900);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☣ ĐÚNG 6 CÂU: CHIẾN THẮNG | SAI 3 CÂU: THUA ☣', 700, 850);
    ctx.fillText('☣ CỨ 10 GIÂY XUẤT HIỆN 1 CÂU HỎI TRẮC NGHIỆM ☣', 1500, 850);
  }

  private drawBloodSplatters(ctx: CanvasRenderingContext2D) {
    for (const b of this.bloodSplatters) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.alpha;
      ctx.fill();
      ctx.restore();
    }
  }

  private drawObstacles(ctx: CanvasRenderingContext2D) {
    for (const obs of this.obstacles) {
      ctx.save();
      if (obs.type === 'wrecked_car') {
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(obs.x + 8, obs.y + 6, obs.w - 16, obs.h - 12);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(obs.x + obs.w * 0.25, obs.y + 10, obs.w * 0.5, obs.h - 20);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(obs.x + obs.w - 4, obs.y + 4, 4, 8);
        ctx.fillRect(obs.x + obs.w - 4, obs.y + obs.h - 12, 4, 8);
      } else if (obs.type === 'barrel') {
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'building') {
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      }
      ctx.restore();
    }
  }

  private drawSupplyCrates(ctx: CanvasRenderingContext2D) {
    for (const c of this.supplyCrates) {
      if (c.destroyed) continue;
      ctx.save();
      ctx.translate(c.x, c.y);

      ctx.fillStyle = '#065f46';
      ctx.fillRect(-18, -18, 36, 36);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(-18, -18, 36, 36);

      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, -18);
      ctx.lineTo(18, 18);
      ctx.moveTo(-18, 18);
      ctx.lineTo(18, -18);
      ctx.stroke();

      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      const lbl =
        c.itemInside === 'MUSHROOM'
          ? '🍄'
          : c.itemInside === 'MACHINE_GUN'
          ? 'M'
          : c.itemInside === 'SPREAD_GUN'
          ? 'S'
          : c.itemInside === 'LASER_GUN'
          ? 'L'
          : 'R';
      ctx.fillText(lbl, 0, 4);

      ctx.restore();
    }
  }

  private drawDropItems(ctx: CanvasRenderingContext2D) {
    for (const item of this.dropItems) {
      ctx.save();
      const floatY = Math.sin(item.floatOffset) * 4;
      ctx.translate(item.x, item.y + floatY);

      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fillStyle =
        item.type === 'MUSHROOM'
          ? '#10b981'
          : item.type === 'MACHINE_GUN'
          ? '#f59e0b'
          : item.type === 'SPREAD_GUN'
          ? '#ef4444'
          : item.type === 'LASER_GUN'
          ? '#06b6d4'
          : '#dc2626';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const lbl =
        item.type === 'MUSHROOM'
          ? '🍄'
          : item.type === 'MACHINE_GUN'
          ? 'M'
          : item.type === 'SPREAD_GUN'
          ? 'S'
          : item.type === 'LASER_GUN'
          ? 'L'
          : 'R';
      ctx.fillText(lbl, 0, 4);

      ctx.restore();
    }
  }

  private drawZombies(ctx: CanvasRenderingContext2D) {
    for (const z of this.zombies) {
      ctx.save();
      ctx.translate(z.x, z.y);

      if (z.hp < z.maxHp) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(-z.radius, -z.radius - 9, z.radius * 2, 4);
        ctx.fillStyle = z.type === 'boss_mutant' ? '#dc2626' : '#22c55e';
        ctx.fillRect(-z.radius, -z.radius - 9, (z.hp / z.maxHp) * z.radius * 2, 4);
      }

      ctx.rotate(z.angle);

      if (z.type === 'walker') {
        ctx.fillStyle = '#3f6212';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(-z.radius * 0.7, -z.radius * 0.5, z.radius * 1.4, z.radius);

        ctx.fillStyle = '#4d7c0f';
        ctx.fillRect(z.radius * 0.5, -z.radius * 0.7, z.radius * 0.8, 5);
        ctx.fillRect(z.radius * 0.5, z.radius * 0.4, z.radius * 0.8, 5);

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(z.radius * 0.6, -3, 2.5, 0, Math.PI * 2);
        ctx.arc(z.radius * 0.6, 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.type === 'runner') {
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(z.radius * 0.6, -6, z.radius * 0.9, 4);
        ctx.fillRect(z.radius * 0.6, 2, z.radius * 0.9, 4);

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(z.radius * 0.7, -3, 2.5, 0, Math.PI * 2);
        ctx.arc(z.radius * 0.7, 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.type === 'spitter') {
        ctx.fillStyle = '#65a30d';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#a3e635';
        ctx.beginPath();
        ctx.arc(-z.radius * 0.4, -z.radius * 0.4, 5, 0, Math.PI * 2);
        ctx.arc(-z.radius * 0.4, z.radius * 0.4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#bef264';
        ctx.beginPath();
        ctx.arc(z.radius * 0.5, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.type === 'tank') {
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#78350f';
        ctx.fillRect(z.radius * 0.2, -z.radius * 1.1, z.radius * 0.9, 12);
        ctx.fillRect(z.radius * 0.2, z.radius * 0.6, z.radius * 0.9, 12);

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(z.radius * 0.7, -4, 3.5, 0, Math.PI * 2);
        ctx.arc(z.radius * 0.7, 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.type === 'boss_mutant') {
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();

        const heartPulse = Math.sin(Date.now() * 0.01) * 3 + 12;
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, heartPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(z.radius * 0.7, -8, 4, 0, Math.PI * 2);
        ctx.arc(z.radius * 0.7, 8, 4, 0, Math.PI * 2);
        ctx.arc(z.radius * 0.8, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#450a0a';
        ctx.fillRect(z.radius * 0.4, -z.radius * 0.9, z.radius * 0.9, 14);
        ctx.fillRect(z.radius * 0.4, z.radius * 0.5, z.radius * 0.9, 14);
      }

      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.shieldActive) {
      const shieldPulse = Math.sin(Date.now() * 0.018) * 4 + p.radius + 16;
      ctx.beginPath();
      ctx.arc(0, 0, shieldPulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Laser sight
    ctx.save();
    ctx.rotate(p.angle);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.radius + 18, 0);
    ctx.lineTo(p.radius + 220, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(p.radius + 220, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Legs animation
    ctx.save();
    ctx.rotate(p.angle);
    const legOffset = Math.sin(p.walkFrame) * 6;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-p.radius * 0.6 + legOffset, -p.radius * 0.8, 8, 5);
    ctx.fillRect(-p.radius * 0.6 - legOffset, p.radius * 0.6, 8, 5);

    // Body
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Vest
    ctx.fillStyle = '#334155';
    ctx.fillRect(-p.radius * 0.7, -p.radius * 0.6, p.radius * 1.4, p.radius * 1.2);

    // Helmet
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Red visor
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(p.radius * 0.2, -p.radius * 0.45, 4, p.radius * 0.9);

    // Gun
    ctx.fillStyle = '#020617';
    ctx.fillRect(p.radius * 0.4, -4, 22, 8);

    if (p.weapon === 'LASER') {
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(p.radius * 0.4 + 18, -3, 6, 6);
    } else if (p.weapon === 'SPREAD') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(p.radius * 0.4 + 18, -5, 6, 10);
    } else if (p.weapon === 'MACHINE_GUN') {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(p.radius * 0.4 + 18, -3, 8, 6);
    }

    if (p.muzzleFlash > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(p.radius * 0.4 + 28, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.radius * 0.4 + 28, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }

  private drawBullets(ctx: CanvasRenderingContext2D) {
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      if (b.isLaser) {
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 1.8, b.y - b.vy * 1.8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawDamagePopups(ctx: CanvasRenderingContext2D) {
    for (const d of this.damagePopups) {
      const alpha = 1 - d.life / d.maxLife;
      ctx.save();
      ctx.fillStyle = d.color;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.text, d.x, d.y);
      ctx.restore();
    }
  }

  private drawNightDarkness(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const isNight = this.currentPhase === 'NIGHT';
    const isSunset = this.currentPhase === 'SUNSET';

    if (!isNight && !isSunset) return;

    const screenX = this.player.x - this.cameraX;
    const screenY = this.player.y - this.cameraY;
    const darknessAlpha = isNight ? 0.88 : 0.42;

    ctx.save();

    const grad = ctx.createRadialGradient(screenX, screenY, 40, screenX, screenY, 280);
    grad.addColorStop(0, 'rgba(3, 7, 18, 0)');
    grad.addColorStop(0.7, `rgba(3, 7, 18, ${darknessAlpha * 0.65})`);
    grad.addColorStop(1, `rgba(3, 7, 18, ${darknessAlpha})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (isNight) {
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.player.angle);

      const coneGrad = ctx.createRadialGradient(0, 0, 30, 200, 0, 320);
      coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
      coneGrad.addColorStop(0.7, 'rgba(254, 240, 138, 0.15)');
      coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 320, -0.42, 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawCrosshair(ctx: CanvasRenderingContext2D) {
    const mx = this.mouseAim.canvasX;
    const my = this.mouseAim.canvasY;

    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mx - 18, my);
    ctx.lineTo(mx - 6, my);
    ctx.moveTo(mx + 6, my);
    ctx.lineTo(mx + 18, my);
    ctx.moveTo(mx, my - 18);
    ctx.lineTo(mx, my - 6);
    ctx.moveTo(mx, my + 6);
    ctx.lineTo(mx, my + 18);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
