import { Question, SubjectId, WeaponType, ItemType, DayNightPhase, QuizPortal } from '../types/game';
import { sounds } from '../services/soundEngine';

export interface GameCallbacks {
  onTriggerQuiz: (portalIndex: number, totalPortals: number, question: Question) => void;
  onGameOver: (score: number, kills: number) => void;
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
    clearedPortals: number;
    totalPortals: number;
  }) => void;
}

// Particle
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

// Bullet
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
  pierceCount?: number;
}

// Floating Drop Item
interface DropItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: ItemType;
  radius: number;
  isGrounded: boolean;
}

// Supply Flying Capsule Pod (Hộp tiếp tế bay trên trời)
interface SupplyPod {
  x: number;
  y: number;
  vx: number;
  baseY: number;
  angle: number;
  hp: number;
  width: number;
  height: number;
  itemInside: ItemType;
  destroyed: boolean;
}

// Enemy
interface Enemy {
  id: string;
  type: 'patrol' | 'turret' | 'drone' | 'boss';
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  shootCooldown: number;
  shootInterval: number;
  facing: 'left' | 'right';
  turretAngle?: number;
  color: string;
}

// Platform Terrain
interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  type?: 'ground' | 'bridge' | 'high_steel';
}

export class ContraGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;
  private questions: Question[];
  private subject: SubjectId;

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  // Level dimensions
  private readonly LEVEL_WIDTH = 4800;
  private readonly LEVEL_HEIGHT = 650;
  private cameraX: number = 0;

  // Day to Night Cycle (35-45s full cycle)
  private timeOfDay: number = 0; // 0 to 45 seconds
  private readonly CYCLE_DURATION: number = 42; // seconds
  private currentPhase: DayNightPhase = 'DAY';

  // Player state
  private player = {
    x: 100,
    y: 450,
    width: 32,
    height: 52,
    vx: 0,
    vy: 0,
    isGrounded: false,
    jumpCount: 0,
    maxJumps: 2,
    isCrouching: false,
    facing: 'right' as 'left' | 'right',
    aimUp: false,
    aimDown: false,
    muzzleFlash: 0,
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
  };

  // Entities
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private supplyPods: SupplyPod[] = [];
  private dropItems: DropItem[] = [];
  private particles: Particle[] = [];
  private platforms: Platform[] = [];
  private portals: QuizPortal[] = [];

  // Key states
  public keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    shoot: false,
    skill: false,
  };

  private bossSpawned: boolean = false;
  private finalPortalIndex: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    questions: Question[],
    subject: SubjectId,
    callbacks: GameCallbacks
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot get 2d context');
    this.ctx = context;
    this.questions = questions.length > 0 ? questions : [];
    this.subject = subject;
    this.callbacks = callbacks;

    this.initLevel();
  }

  private initLevel() {
    this.platforms = [];
    this.enemies = [];
    this.supplyPods = [];
    this.dropItems = [];
    this.particles = [];
    this.bullets = [];
    this.portals = [];

    const groundY = 560;

    // 1. Continuous Ground with some tactical gaps
    this.platforms.push({ x: 0, y: groundY, width: 1400, height: 90, type: 'ground' });
    this.platforms.push({ x: 1480, y: groundY, width: 1100, height: 90, type: 'ground' });
    this.platforms.push({ x: 2650, y: groundY, width: 1200, height: 90, type: 'ground' });
    this.platforms.push({ x: 3900, y: groundY, width: 900, height: 90, type: 'ground' });

    // 2. High Platforms, Steel Bridges & Military catwalks
    const catwalks: [number, number, number][] = [
      [200, 440, 220],
      [480, 360, 240],
      [750, 420, 200],
      [1100, 450, 220],
      [1350, 380, 200],
      [1650, 460, 240],
      [1950, 370, 250],
      [2250, 430, 220],
      [2500, 360, 200],
      [2800, 440, 240],
      [3100, 380, 250],
      [3400, 460, 220],
      [3700, 370, 240],
      [4100, 440, 300],
    ];

    catwalks.forEach(([px, py, pw]) => {
      this.platforms.push({ x: px, y: py, width: pw, height: 16, type: 'high_steel' });
    });

    // 3. Quiz Portals (Chướng ngại vật trắc nghiệm phong ấn)
    // We create 3 sequential checkpoint portals along the level
    const portalPositions = [950, 2100, 3350];
    const shuffledQuestions = [...this.questions].sort(() => Math.random() - 0.5);

    portalPositions.forEach((pos, idx) => {
      const q = shuffledQuestions[idx % shuffledQuestions.length] || {
        id: `q_default_${idx}`,
        subject: this.subject,
        question: 'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?',
        options: ['1945', '1954', '1972', '1975'] as [string, string, string, string],
        correctIndex: 1,
        hint: 'Năm 1954',
      };

      this.portals.push({
        id: `portal_${idx}`,
        x: pos,
        y: groundY - 180,
        width: 44,
        height: 180,
        question: q,
        cleared: false,
        active: true,
        label: `CỔNG PHONG ẤN #${idx + 1}`,
      });
    });

    // 4. Flying Supply Pods (Hộp tiếp tế bay trên trời - drops Mushroom, M-gun, S-gun, L-gun)
    const podConfigs: [number, number, ItemType][] = [
      [360, 160, 'MACHINE_GUN'],
      [820, 170, 'SPREAD_GUN'],
      [1250, 180, 'MUSHROOM'],
      [1750, 150, 'LASER_GUN'],
      [2250, 160, 'MACHINE_GUN'],
      [2700, 170, 'SPREAD_GUN'],
      [3150, 160, 'MUSHROOM'],
      [3600, 180, 'LASER_GUN'],
      [4100, 150, 'MACHINE_GUN'],
    ];

    podConfigs.forEach(([x, baseY, item]) => {
      this.supplyPods.push({
        x,
        y: baseY,
        baseY,
        vx: 1.5,
        angle: Math.random() * Math.PI * 2,
        hp: 30,
        width: 40,
        height: 24,
        itemInside: item,
        destroyed: false,
      });
    });

    // 5. Initial Enemies (Patrol Soldiers & High Turrets & Drones)
    this.spawnInitialEnemies();
  }

  private spawnInitialEnemies() {
    // Turrets on high platforms
    const turretSpots = [520, 1400, 2000, 2850, 3750];
    turretSpots.forEach((tx, i) => {
      this.enemies.push({
        id: `turret_${i}`,
        type: 'turret',
        x: tx,
        y: 330,
        width: 32,
        height: 30,
        vx: 0,
        vy: 0,
        hp: 45,
        maxHp: 45,
        shootCooldown: 60 + Math.random() * 60,
        shootInterval: 120,
        facing: 'left',
        color: '#f59e0b',
      });
    });

    // Patrol soldiers
    const patrolSpots = [400, 700, 1200, 1600, 1850, 2300, 2700, 3100, 3500];
    patrolSpots.forEach((px, i) => {
      this.enemies.push({
        id: `soldier_${i}`,
        type: 'patrol',
        x: px,
        y: 500,
        width: 30,
        height: 48,
        vx: -1.2,
        vy: 0,
        hp: 30,
        maxHp: 30,
        shootCooldown: 80 + Math.random() * 80,
        shootInterval: 140,
        facing: 'left',
        color: '#ef4444',
      });
    });

    // Flying drones
    const droneSpots = [650, 1500, 2500, 3300];
    droneSpots.forEach((dx, i) => {
      this.enemies.push({
        id: `drone_${i}`,
        type: 'drone',
        x: dx,
        y: 220,
        width: 36,
        height: 24,
        vx: -1.4,
        vy: 0,
        hp: 35,
        maxHp: 35,
        shootCooldown: 90 + Math.random() * 90,
        shootInterval: 130,
        facing: 'left',
        color: '#a855f7',
      });
    });
  }

  private spawnBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    this.enemies.push({
      id: 'final_cyber_boss',
      type: 'boss',
      x: 4300,
      y: 400,
      width: 90,
      height: 120,
      vx: 0,
      vy: 0,
      hp: 350,
      maxHp: 350,
      shootCooldown: 40,
      shootInterval: 50,
      facing: 'left',
      color: '#dc2626',
    });
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

  public resumeAfterQuizSuccess(portalId: string) {
    const portal = this.portals.find((p) => p.id === portalId);
    if (portal) {
      portal.cleared = true;
      portal.active = false;

      // Create explosive shatter particles
      for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 7;
        this.particles.push({
          x: portal.x + portal.width / 2,
          y: portal.y + Math.random() * portal.height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: ['#06b6d4', '#38bdf8', '#fbbf24', '#f43f5e'][Math.floor(Math.random() * 4)],
          size: 3 + Math.random() * 4,
          life: 0,
          maxLife: 35 + Math.random() * 25,
        });
      }

      // Bonus rewards
      this.player.score += 500;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
      this.player.mana = Math.min(this.player.maxMana, this.player.mana + 45);
      sounds.explosion();
    }

    // Check if all portals cleared, spawn final boss if needed
    const allPortalsCleared = this.portals.every((p) => p.cleared);
    if (allPortalsCleared && !this.bossSpawned) {
      this.spawnBoss();
    }

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

  // Trigger Mana Skill (Khiên hộ thể / Siêu năng lượng)
  public activateSkill() {
    if (this.player.mana >= 35 && !this.player.shieldActive) {
      this.player.mana -= 35;
      this.player.shieldActive = true;
      this.player.shieldTimeRemaining = 6.0; // 6 seconds of invulnerability
      sounds.shieldActivate();

      // Burst protective particles
      for (let i = 0; i < 30; i++) {
        const ang = (i / 30) * Math.PI * 2;
        this.particles.push({
          x: this.player.x + this.player.width / 2,
          y: this.player.y + this.player.height / 2,
          vx: Math.cos(ang) * 4,
          vy: Math.sin(ang) * 4,
          color: '#38bdf8',
          size: 4,
          life: 0,
          maxLife: 30,
        });
      }
    }
  }

  // Update Game Logic
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

    // Passive mana regeneration
    this.player.mana = Math.min(this.player.maxMana, this.player.mana + dt * 4);

    // Shield timer
    if (this.player.shieldActive) {
      this.player.shieldTimeRemaining -= dt;
      if (this.player.shieldTimeRemaining <= 0) {
        this.player.shieldActive = false;
      }
    }

    // 2. Handle Player Input & Movement
    const speed = 4.5;
    this.player.isCrouching = this.keys.down && this.player.isGrounded;

    if (this.keys.left && !this.player.isCrouching) {
      this.player.vx = -speed;
      this.player.facing = 'left';
    } else if (this.keys.right && !this.player.isCrouching) {
      this.player.vx = speed;
      this.player.facing = 'right';
    } else {
      this.player.vx *= 0.8;
      if (Math.abs(this.player.vx) < 0.1) this.player.vx = 0;
    }

    this.player.aimUp = this.keys.up && !this.player.isCrouching;
    this.player.aimDown = this.keys.down && !this.player.isGrounded;
    if (this.player.muzzleFlash > 0) {
      this.player.muzzleFlash -= dt * 60;
    }

    // Apply Gravity
    this.player.vy += 0.55;
    if (this.player.vy > 14) this.player.vy = 14;

    this.player.x += this.player.vx;
    this.player.y += this.player.vy;

    // Clamp Level bounds
    if (this.player.x < 10) this.player.x = 10;
    if (this.player.x > this.LEVEL_WIDTH - 50) this.player.x = this.LEVEL_WIDTH - 50;

    // Platform Collision
    this.player.isGrounded = false;
    const pWidth = this.player.width;
    const pHeight = this.player.isCrouching ? this.player.height * 0.55 : this.player.height;
    const pBottom = this.player.y + pHeight;

    for (const plat of this.platforms) {
      const isWithinX = this.player.x + pWidth > plat.x && this.player.x < plat.x + plat.width;
      if (isWithinX) {
        // Landing on top
        if (this.player.vy >= 0 && pBottom >= plat.y && pBottom - this.player.vy <= plat.y + 12) {
          this.player.y = plat.y - pHeight;
          this.player.vy = 0;
          this.player.isGrounded = true;
          this.player.jumpCount = 0;
        }
      }
    }

    // Pit fall check (re-spawn on ground with small penalty)
    if (this.player.y > this.LEVEL_HEIGHT + 100) {
      this.player.hp -= 20;
      sounds.hit();
      this.player.y = 400;
      this.player.x = Math.max(50, this.player.x - 100);
      this.player.vy = 0;
      if (this.player.hp <= 0) {
        this.handlePlayerDeath();
        return;
      }
    }

    // 3. Player Shoot
    if (this.player.shootCooldown > 0) {
      this.player.shootCooldown -= dt * 60;
    }

    if (this.keys.shoot && this.player.shootCooldown <= 0) {
      this.firePlayerWeapon();
    }

    // Skill trigger
    if (this.keys.skill) {
      this.activateSkill();
    }

    // 4. Update Camera (Smooth tracking)
    const targetCamX = this.player.x - this.canvas.width * 0.38;
    this.cameraX += (targetCamX - this.cameraX) * 0.12;
    this.cameraX = Math.max(0, Math.min(this.LEVEL_WIDTH - this.canvas.width, this.cameraX));

    // 5. Check Quiz Portals Collision
    for (let i = 0; i < this.portals.length; i++) {
      const portal = this.portals[i];
      if (portal.active && !portal.cleared) {
        // Block player from passing
        if (
          this.player.x + this.player.width >= portal.x &&
          this.player.x <= portal.x + portal.width &&
          this.player.y + this.player.height >= portal.y &&
          this.player.y <= portal.y + portal.height
        ) {
          // Push player back
          this.player.x = portal.x - this.player.width - 2;
          this.player.vx = 0;

          // PAUSE GAME IMMEDIATELY & TRIGGER QUIZ
          this.pause();
          this.finalPortalIndex = i;
          this.callbacks.onTriggerQuiz(i, this.portals.length, portal.question);
          return;
        }
      }
    }

    // 6. Update Supply Flying Pods
    for (const pod of this.supplyPods) {
      if (pod.destroyed) continue;
      pod.angle += 0.04;
      pod.y = pod.baseY + Math.sin(pod.angle) * 35;
      pod.x += pod.vx;

      // Reverse direction within territory
      if (pod.x > this.LEVEL_WIDTH - 200 || pod.x < 100) {
        pod.vx *= -1;
      }
    }

    // 7. Update Drop Items
    for (let i = this.dropItems.length - 1; i >= 0; i--) {
      const item = this.dropItems[i];
      item.vy += 0.3;
      item.y += item.vy;

      // Check ground collision
      for (const plat of this.platforms) {
        if (
          item.x >= plat.x &&
          item.x <= plat.x + plat.width &&
          item.y + item.radius >= plat.y &&
          item.y - item.vy <= plat.y
        ) {
          item.y = plat.y - item.radius;
          item.vy = 0;
          item.isGrounded = true;
        }
      }

      // Pickup collision with player
      const dx = this.player.x + this.player.width / 2 - item.x;
      const dy = this.player.y + this.player.height / 2 - item.y;
      const dist = Math.hypot(dx, dy);

      if (dist < item.radius + 24) {
        // Apply item effect
        if (item.type === 'MUSHROOM') {
          this.player.hp = this.player.maxHp;
          this.player.mana = this.player.maxMana;
          this.player.score += 200;
        } else if (item.type === 'MACHINE_GUN') {
          this.player.weapon = 'MACHINE_GUN';
          this.player.score += 150;
        } else if (item.type === 'SPREAD_GUN') {
          this.player.weapon = 'SPREAD';
          this.player.score += 150;
        } else if (item.type === 'LASER_GUN') {
          this.player.weapon = 'LASER';
          this.player.score += 150;
        }

        sounds.itemPickup();
        // Sparkle particles
        for (let p = 0; p < 20; p++) {
          const ang = Math.random() * Math.PI * 2;
          this.particles.push({
            x: item.x,
            y: item.y,
            vx: Math.cos(ang) * 3,
            vy: Math.sin(ang) * 3,
            color: '#fbbf24',
            size: 3,
            life: 0,
            maxLife: 25,
          });
        }

        this.dropItems.splice(i, 1);
      }
    }

    // 8. Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      // Range check
      if (b.x < this.cameraX - 100 || b.x > this.cameraX + this.canvas.width + 100 || b.y < 0 || b.y > 650) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.isPlayer) {
        // 1. Check hitting flying supply pods
        for (const pod of this.supplyPods) {
          if (!pod.destroyed) {
            if (
              b.x >= pod.x &&
              b.x <= pod.x + pod.width &&
              b.y >= pod.y &&
              b.y <= pod.y + pod.height
            ) {
              pod.hp -= b.damage;
              sounds.hit();
              if (pod.hp <= 0) {
                pod.destroyed = true;
                sounds.supplyDrop();
                sounds.explosion();
                // Drop item
                this.dropItems.push({
                  x: pod.x + pod.width / 2,
                  y: pod.y + pod.height / 2,
                  vx: 0,
                  vy: -2,
                  type: pod.itemInside,
                  radius: 14,
                  isGrounded: false,
                });
                // Explosion particles
                for (let k = 0; k < 25; k++) {
                  const ang = Math.random() * Math.PI * 2;
                  this.particles.push({
                    x: pod.x + pod.width / 2,
                    y: pod.y + pod.height / 2,
                    vx: Math.cos(ang) * 4,
                    vy: Math.sin(ang) * 4,
                    color: '#f43f5e',
                    size: 3,
                    life: 0,
                    maxLife: 25,
                  });
                }
              }

              if (!b.isLaser) {
                this.bullets.splice(i, 1);
                break;
              }
            }
          }
        }

        // 2. Check hitting enemies
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (
            b.x >= enemy.x &&
            b.x <= enemy.x + enemy.width &&
            b.y >= enemy.y &&
            b.y <= enemy.y + enemy.height
          ) {
            enemy.hp -= b.damage;
            sounds.hit();

            // Hit spark
            this.particles.push({
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              color: '#fef08a',
              size: 2.5,
              life: 0,
              maxLife: 15,
            });

            if (enemy.hp <= 0) {
              sounds.explosion();
              this.player.kills += 1;
              this.player.score += enemy.type === 'boss' ? 2000 : enemy.type === 'turret' ? 200 : 100;
              this.player.mana = Math.min(this.player.maxMana, this.player.mana + 15);

              // Explosion particles
              for (let k = 0; k < (enemy.type === 'boss' ? 80 : 30); k++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 1 + Math.random() * (enemy.type === 'boss' ? 8 : 4);
                this.particles.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                  vx: Math.cos(ang) * spd,
                  vy: Math.sin(ang) * spd,
                  color: ['#ef4444', '#f59e0b', '#f97316'][Math.floor(Math.random() * 3)],
                  size: 3 + Math.random() * 3,
                  life: 0,
                  maxLife: 30,
                });
              }

              if (enemy.type === 'boss') {
                this.enemies.splice(j, 1);
                // VICTORY!
                sounds.victory();
                this.callbacks.onVictory(this.player.score, this.player.kills);
                this.stop();
                return;
              }

              this.enemies.splice(j, 1);
            }

            if (!b.isLaser) {
              this.bullets.splice(i, 1);
              break;
            } else {
              b.pierceCount = (b.pierceCount || 0) + 1;
              if (b.pierceCount > 4) {
                this.bullets.splice(i, 1);
                break;
              }
            }
          }
        }
      } else {
        // Enemy bullet hitting Player
        const pBox = {
          x: this.player.x,
          y: this.player.y,
          w: this.player.width,
          h: this.player.isCrouching ? this.player.height * 0.55 : this.player.height,
        };

        if (
          b.x >= pBox.x &&
          b.x <= pBox.x + pBox.w &&
          b.y >= pBox.y &&
          b.y <= pBox.y + pBox.h
        ) {
          if (!this.player.shieldActive) {
            this.player.hp -= b.damage;
            sounds.hit();
            if (this.player.hp <= 0) {
              this.handlePlayerDeath();
              return;
            }
          } else {
            // Deflected by shield!
            sounds.hit();
          }

          this.bullets.splice(i, 1);
        }
      }
    }

    // 9. Update Enemies
    for (const enemy of this.enemies) {
      // AI Logic based on type
      if (enemy.type === 'patrol') {
        enemy.x += enemy.vx;
        // Turn around on boundaries
        if (enemy.x < 50 || enemy.x > this.LEVEL_WIDTH - 100) {
          enemy.vx *= -1;
        }

        // Face player if in range
        const distToPlayer = this.player.x - enemy.x;
        if (Math.abs(distToPlayer) < 450) {
          enemy.facing = distToPlayer > 0 ? 'right' : 'left';
          enemy.shootCooldown -= 1;
          if (enemy.shootCooldown <= 0) {
            enemy.shootCooldown = enemy.shootInterval;
            sounds.shootEnemy();
            this.bullets.push({
              x: enemy.facing === 'right' ? enemy.x + enemy.width : enemy.x,
              y: enemy.y + 18,
              vx: enemy.facing === 'right' ? 4.5 : -4.5,
              vy: 0,
              radius: 4.5,
              isPlayer: false,
              damage: 15,
              color: '#ef4444',
            });
          }
        }
      } else if (enemy.type === 'turret') {
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 550) {
          enemy.turretAngle = Math.atan2(dy, dx);
          enemy.shootCooldown -= 1;
          if (enemy.shootCooldown <= 0) {
            enemy.shootCooldown = enemy.shootInterval;
            sounds.shootEnemy();
            this.bullets.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height / 2,
              vx: Math.cos(enemy.turretAngle) * 4.2,
              vy: Math.sin(enemy.turretAngle) * 4.2,
              radius: 5,
              isPlayer: false,
              damage: 18,
              color: '#f97316',
            });
          }
        }
      } else if (enemy.type === 'drone') {
        enemy.x += enemy.vx;
        if (enemy.x < 100 || enemy.x > this.LEVEL_WIDTH - 200) enemy.vx *= -1;

        const dx = Math.abs(this.player.x - enemy.x);
        if (dx < 300) {
          enemy.shootCooldown -= 1;
          if (enemy.shootCooldown <= 0) {
            enemy.shootCooldown = enemy.shootInterval;
            sounds.shootEnemy();
            this.bullets.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height,
              vx: (this.player.x - enemy.x) * 0.015,
              vy: 3.5,
              radius: 5,
              isPlayer: false,
              damage: 20,
              color: '#ec4899',
            });
          }
        }
      } else if (enemy.type === 'boss') {
        // Boss attacks
        enemy.shootCooldown -= 1;
        if (enemy.shootCooldown <= 0) {
          enemy.shootCooldown = enemy.shootInterval;
          sounds.shootEnemy();

          // 3-way missile attack
          const angles = [-0.3, 0, 0.3];
          angles.forEach((offset) => {
            this.bullets.push({
              x: enemy.x,
              y: enemy.y + 40,
              vx: -5 * Math.cos(offset),
              vy: 5 * Math.sin(offset),
              radius: 6.5,
              isPlayer: false,
              damage: 25,
              color: '#dc2626',
            });
          });
        }
      }

      // Check collision between enemy body and player
      if (
        this.player.x + this.player.width >= enemy.x &&
        this.player.x <= enemy.x + enemy.width &&
        this.player.y + this.player.height >= enemy.y &&
        this.player.y <= enemy.y + enemy.height
      ) {
        if (this.player.shieldActive) {
          // Shield damages enemy on contact
          enemy.hp -= 2;
        } else {
          this.player.hp -= 0.6;
          if (this.player.hp <= 0) {
            this.handlePlayerDeath();
            return;
          }
        }
      }
    }

    // 10. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life += 1;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 11. Send stats update to React HUD
    const clearedCount = this.portals.filter((p) => p.cleared).length;
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
      clearedPortals: clearedCount,
      totalPortals: this.portals.length,
    });
  }

  private firePlayerWeapon() {
    const isFacingRight = this.player.facing === 'right';
    const isCrouching = this.player.isCrouching;
    const aimUp = this.player.aimUp;
    const aimDown = this.player.aimDown;
    const isMovingH = Math.abs(this.player.vx) > 0.5;

    let startX = isFacingRight ? this.player.x + this.player.width + 4 : this.player.x - 4;
    let startY = this.player.y + 20;
    let baseVx = isFacingRight ? 11 : -11;
    let baseVy = 0;

    if (aimUp) {
      if (isMovingH) {
        // Diagonal Up-Forward
        baseVx = isFacingRight ? 8.5 : -8.5;
        baseVy = -8.5;
        startX = isFacingRight ? this.player.x + this.player.width + 4 : this.player.x - 4;
        startY = this.player.y + 6;
      } else {
        // Straight UP
        baseVx = 0;
        baseVy = -12;
        startX = this.player.x + (isFacingRight ? 20 : 12);
        startY = this.player.y - 6;
      }
    } else if (aimDown) {
      if (isMovingH) {
        // Diagonal Down-Forward (jumping)
        baseVx = isFacingRight ? 8.5 : -8.5;
        baseVy = 8.5;
        startX = isFacingRight ? this.player.x + this.player.width + 4 : this.player.x - 4;
        startY = this.player.y + 36;
      } else {
        // Straight Down (jumping)
        baseVx = 0;
        baseVy = 12;
        startX = this.player.x + (isFacingRight ? 20 : 12);
        startY = this.player.y + this.player.height + 4;
      }
    } else if (isCrouching) {
      baseVx = isFacingRight ? 11 : -11;
      baseVy = 0;
      startX = isFacingRight ? this.player.x + this.player.width + 6 : this.player.x - 6;
      startY = this.player.y + 18;
    }

    // Trigger visual muzzle flash
    this.player.muzzleFlash = 4;

    // Eject shell casing particle
    this.particles.push({
      x: startX - (isFacingRight ? 8 : -8),
      y: startY,
      vx: (isFacingRight ? -2.5 : 2.5) + (Math.random() - 0.5) * 1.5,
      vy: -2.5 - Math.random() * 2,
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
        vx: baseVx,
        vy: baseVy,
        radius: 4,
        isPlayer: true,
        damage: 18,
        color: '#facc15',
      });
    } else if (this.player.weapon === 'MACHINE_GUN') {
      // Rapid fire machine gun (Súng M)
      this.player.shootCooldown = 5.5; // High rate of fire
      sounds.shootMachineGun();
      this.bullets.push({
        x: startX,
        y: startY + (Math.random() - 0.5) * 4,
        vx: baseVx * 1.15,
        vy: baseVy * 1.15,
        radius: 4.5,
        isPlayer: true,
        damage: 16,
        color: '#fb923c',
      });
    } else if (this.player.weapon === 'SPREAD') {
      // 5-way spread gun (Súng S)
      this.player.shootCooldown = 15;
      sounds.shootSpread();
      const spreadAngles = [-0.28, -0.14, 0, 0.14, 0.28];
      spreadAngles.forEach((ang) => {
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const vx = baseVx * cos - baseVy * sin;
        const vy = baseVx * sin + baseVy * cos;

        this.bullets.push({
          x: startX,
          y: startY,
          vx,
          vy,
          radius: 5.5,
          isPlayer: true,
          damage: 15,
          color: '#ef4444',
        });
      });
    } else if (this.player.weapon === 'LASER') {
      // Piercing beam (Súng L)
      this.player.shootCooldown = 16;
      sounds.shootLaser();
      this.bullets.push({
        x: startX,
        y: startY,
        vx: baseVx * 1.6,
        vy: baseVy * 1.6,
        radius: 7,
        isPlayer: true,
        damage: 45,
        color: '#06b6d4',
        isLaser: true,
        pierceCount: 0,
      });
    }
  }

  private handlePlayerDeath() {
    sounds.gameOver();
    this.stop();
    this.callbacks.onGameOver(this.player.score, this.player.kills);
  }

  public jump() {
    if (this.player.jumpCount < this.player.maxJumps) {
      this.player.vy = -11.5;
      this.player.jumpCount += 1;
      this.player.isGrounded = false;
      sounds.jump();

      // Jump dust particles
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          x: this.player.x + this.player.width / 2,
          y: this.player.y + this.player.height,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * -2,
          color: '#94a3b8',
          size: 2.5,
          life: 0,
          maxLife: 15,
        });
      }
    }
  }

  // ================= RENDER ENGINE =================
  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Draw Sky Background with Day to Night Transition
    this.drawSkyBackground(ctx, w, h);

    // 2. Parallax Mountain & Jungle Silhouettes
    this.drawParallaxScenery(ctx, w, h);

    // 3. Shift Camera coordinate
    ctx.save();
    ctx.translate(-Math.round(this.cameraX), 0);

    // 4. Draw Platforms & Terrain
    this.drawPlatforms(ctx);

    // 5. Draw Quiz Portals (Cổng phong ấn trắc nghiệm)
    this.drawPortals(ctx);

    // 6. Draw Supply Pods (Hộp tiếp tế)
    this.drawSupplyPods(ctx);

    // 7. Draw Drop Items
    this.drawDropItems(ctx);

    // 8. Draw Enemies
    this.drawEnemies(ctx);

    // 9. Draw Bullets
    this.drawBullets(ctx);

    // 10. Draw Particles
    this.drawParticles(ctx);

    // 11. Draw Player (Contra Commando)
    this.drawPlayer(ctx);

    ctx.restore(); // restore camera translation

    // 12. NIGHT AMBIENT DARKNESS & PLAYER SEARCHLIGHT AURA
    if (this.currentPhase === 'NIGHT' || this.currentPhase === 'SUNSET') {
      this.drawNightDarknessAndLight(ctx, w, h);
    }

    ctx.restore();
  }

  private drawSkyBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);

    if (this.currentPhase === 'DAY') {
      grad.addColorStop(0, '#0284c7'); // Bright day blue
      grad.addColorStop(0.7, '#38bdf8');
      grad.addColorStop(1, '#bae6fd');
    } else if (this.currentPhase === 'SUNSET') {
      grad.addColorStop(0, '#7c2d12'); // Rich sunset orange / crimson
      grad.addColorStop(0.5, '#ea580c');
      grad.addColorStop(0.8, '#f59e0b');
      grad.addColorStop(1, '#fde68a');
    } else {
      // NIGHT
      grad.addColorStop(0, '#030712'); // Deep starry night
      grad.addColorStop(0.6, '#0f172a');
      grad.addColorStop(1, '#1e1b4b');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Celestial bodies (Sun or Moon)
    if (this.currentPhase === 'DAY') {
      // Golden Sun
      ctx.beginPath();
      ctx.arc(w * 0.75, 90, 40, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 30;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (this.currentPhase === 'SUNSET') {
      // Sunset giant orange sun sinking
      ctx.beginPath();
      ctx.arc(w * 0.75, 180, 50, 0, Math.PI * 2);
      ctx.fillStyle = '#fb923c';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 40;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Moon & Stars
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 35; s++) {
        const sx = ((s * 137.5) % w);
        const sy = ((s * 73.1) % 250);
        ctx.fillRect(sx, sy, 2, 2);
      }
      // Glowing Moon
      ctx.beginPath();
      ctx.arc(w * 0.8, 80, 28, 0, Math.PI * 2);
      ctx.fillStyle = '#f1f5f9';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  private drawParallaxScenery(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Distant mountain layers
    ctx.fillStyle =
      this.currentPhase === 'DAY'
        ? '#0369a1'
        : this.currentPhase === 'SUNSET'
        ? '#451a03'
        : '#020617';

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 80) {
      const offsetX = x + this.cameraX * 0.2;
      const my = 350 + Math.sin(offsetX * 0.005) * 80 + Math.cos(offsetX * 0.015) * 40;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  private drawPlatforms(ctx: CanvasRenderingContext2D) {
    for (const p of this.platforms) {
      if (p.x + p.width < this.cameraX - 100 || p.x > this.cameraX + this.canvas.width + 100) continue;

      if (p.type === 'ground') {
        // Ground base
        const groundGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.height);
        groundGrad.addColorStop(0, '#15803d'); // Jungle grass top
        groundGrad.addColorStop(0.12, '#166534');
        groundGrad.addColorStop(0.3, '#3f2b1d'); // Rock/earth
        groundGrad.addColorStop(1, '#1c1917');

        ctx.fillStyle = groundGrad;
        ctx.fillRect(p.x, p.y, p.width, p.height);

        // Top grass texture fringe
        ctx.fillStyle = '#22c55e';
        for (let gx = p.x; gx < p.x + p.width; gx += 12) {
          ctx.fillRect(gx, p.y - 3, 6, 4);
        }
      } else {
        // Steel high platform / Catwalk
        ctx.fillStyle = '#334155';
        ctx.fillRect(p.x, p.y, p.width, p.height);

        // Top hazard edge
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(p.x, p.y, p.width, 3);

        // Support pillars
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(p.x + 8, p.y + p.height, 6, 25);
        ctx.fillRect(p.x + p.width - 14, p.y + p.height, 6, 25);
      }
    }
  }

  private drawPortals(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < this.portals.length; i++) {
      const portal = this.portals[i];
      if (portal.cleared) continue;

      // Pulsating laser force field
      const pulse = Math.sin(Date.now() * 0.008) * 0.2 + 0.8;

      // Vertical energy barrier beams
      const beamGrad = ctx.createLinearGradient(portal.x, 0, portal.x + portal.width, 0);
      beamGrad.addColorStop(0, `rgba(6, 182, 212, ${0.4 * pulse})`);
      beamGrad.addColorStop(0.5, `rgba(244, 63, 94, ${0.85 * pulse})`);
      beamGrad.addColorStop(1, `rgba(6, 182, 212, ${0.4 * pulse})`);

      ctx.fillStyle = beamGrad;
      ctx.fillRect(portal.x, portal.y, portal.width, portal.height);

      // Top and bottom emitter pylons
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(portal.x - 8, portal.y - 12, portal.width + 16, 16);
      ctx.fillRect(portal.x - 8, portal.y + portal.height - 4, portal.width + 16, 16);

      // Glowing power cores
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(portal.x + portal.width / 2, portal.y - 4, 6, 0, Math.PI * 2);
      ctx.arc(portal.x + portal.width / 2, portal.y + portal.height + 4, 6, 0, Math.PI * 2);
      ctx.fill();

      // Energy runes / label
      ctx.save();
      ctx.translate(portal.x + portal.width / 2, portal.y + portal.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`⚡ CỔNG PHONG ẤN #${i + 1} - CẦN TRẮC NGHIỆM`, 0, 4);
      ctx.restore();
    }
  }

  private drawSupplyPods(ctx: CanvasRenderingContext2D) {
    for (const pod of this.supplyPods) {
      if (pod.destroyed) continue;

      // Classic Contra flying capsule / red blimp
      ctx.save();
      ctx.translate(pod.x, pod.y);

      // Shadow/wings
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(pod.width / 2, pod.height / 2, pod.width / 2, pod.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // White stripe
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pod.width / 2 - 4, 2, 8, pod.height - 4);

      // Blinking antenna
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(pod.width / 2 - 1, -6, 2, 6);
      ctx.beginPath();
      ctx.arc(pod.width / 2, -7, 3, 0, Math.PI * 2);
      ctx.fill();

      // Text icon inside
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      const label = pod.itemInside === 'MUSHROOM' ? '🍄' : pod.itemInside === 'MACHINE_GUN' ? 'M' : pod.itemInside === 'SPREAD_GUN' ? 'S' : 'L';
      ctx.fillText(label, pod.width / 2, pod.height / 2 + 3);

      ctx.restore();
    }
  }

  private drawDropItems(ctx: CanvasRenderingContext2D) {
    for (const item of this.dropItems) {
      ctx.save();
      ctx.translate(item.x, item.y);

      // Glowing aura
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);

      if (item.type === 'MUSHROOM') {
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🍄', 0, 5);
      } else if (item.type === 'MACHINE_GUN') {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('M', 0, 4);
      } else if (item.type === 'SPREAD_GUN') {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#f87171';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('S', 0, 4);
      } else {
        // Laser Gun
        ctx.fillStyle = '#06b6d4';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('L', 0, 4);
      }

      ctx.restore();
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.enemies) {
      if (enemy.x + enemy.width < this.cameraX - 100 || enemy.x > this.cameraX + this.canvas.width + 100) continue;

      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      // Health bar above enemy
      if (enemy.hp < enemy.maxHp) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, -10, enemy.width, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(0, -10, (enemy.hp / enemy.maxHp) * enemy.width, 4);
      }

      if (enemy.type === 'patrol') {
        // Red Patrol Soldier
        const isRight = enemy.facing === 'right';
        ctx.fillStyle = '#b91c1c'; // Red uniform
        ctx.fillRect(4, 14, 22, 22);

        // Head & helmet
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(6, 2, 18, 12);
        // Goggles
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(isRight ? 16 : 6, 6, 6, 4);

        // Legs
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(6, 36, 7, 12);
        ctx.fillRect(17, 36, 7, 12);

        // Gun
        ctx.fillStyle = '#000000';
        ctx.fillRect(isRight ? 20 : -4, 20, 14, 5);
      } else if (enemy.type === 'turret') {
        // High platform mounted turret
        ctx.fillStyle = '#475569';
        ctx.fillRect(2, 16, 28, 14);

        // Rotating cannon barrel
        ctx.save();
        ctx.translate(16, 16);
        ctx.rotate(enemy.turretAngle || 0);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, -4, 20, 8);
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();
        ctx.restore();
      } else if (enemy.type === 'drone') {
        // Flying cyber drone
        ctx.fillStyle = '#7e22ce';
        ctx.fillRect(6, 6, 24, 12);
        // Rotors
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 2, 12, 3);
        ctx.fillRect(24, 2, 12, 3);
        // Red eye
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(18, 12, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (enemy.type === 'boss') {
        // Massive Cyber Fortress Boss
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, enemy.width, enemy.height);

        ctx.fillStyle = '#dc2626';
        ctx.fillRect(10, 20, enemy.width - 20, 30);

        // Huge energy core
        ctx.beginPath();
        ctx.arc(enemy.width / 2, 70, 24, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Dual Gatling Barrels
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-15, 30, 20, 12);
        ctx.fillRect(-15, 60, 20, 12);

        // Boss label
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('TRÙM CĂN CỨ CHIẾN LƯỢC', enemy.width / 2, -16);
      }

      ctx.restore();
    }
  }

  private drawBullets(ctx: CanvasRenderingContext2D) {
    for (const b of this.bullets) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);

      if (b.isLaser) {
        ctx.fillStyle = '#06b6d4';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 10;
        ctx.fill();
        // Laser tail
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#67e8f9';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 2, b.y - b.vy * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = b.color;
        ctx.fill();
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

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const isRight = p.facing === 'right';
    const crouch = p.isCrouching;

    ctx.save();
    ctx.translate(p.x, p.y);

    // 1. Force Shield Halo (Khiên Hộ Thể)
    if (p.shieldActive) {
      const shieldPulse = Math.sin(Date.now() * 0.015) * 4 + 32;
      ctx.beginPath();
      ctx.arc(p.width / 2, p.height / 2, shieldPulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (crouch) {
      // Crouched Commando
      ctx.fillStyle = '#1e3a8a'; // Blue pants
      ctx.fillRect(4, 24, 24, 14);

      ctx.fillStyle = '#b45309'; // Tactical vest
      ctx.fillRect(6, 14, 20, 12);

      // Head with red headband
      ctx.fillStyle = '#fbcfe8';
      ctx.fillRect(8, 4, 14, 10);
      ctx.fillStyle = '#ef4444'; // Red headband
      ctx.fillRect(6, 4, 18, 4);

      // Gun low
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(isRight ? 20 : -8, 18, 18, 5);

      // Muzzle flash when crouching
      if (p.muzzleFlash > 0) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(isRight ? 40 : -10, 20, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(isRight ? 40 : -10, 20, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Standing / Running Commando
      // Legs (Camo / Tactical pants)
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(4, 34, 10, 18);
      ctx.fillRect(18, 34, 10, 18);

      // Torso / Combat vest
      ctx.fillStyle = '#d97706'; // Vest
      ctx.fillRect(4, 16, 24, 18);

      // Muscular arms
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(isRight ? 20 : 0, 18, 8, 8);

      // Head & Face
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(8, 2, 16, 14);

      // Contra signature Red Headband with fluttering ribbon tails
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(6, 3, 20, 4);
      // Ribbon tail fluttering in the wind
      const tailOffset = Math.sin(Date.now() * 0.02) * 3;
      ctx.fillRect(isRight ? -4 : 26, 4 + tailOffset, 8, 3);

      // Gun rendering with dynamic aiming angles
      ctx.fillStyle = '#0f172a';
      const isMovingH = Math.abs(p.vx) > 0.5;

      if (p.aimUp) {
        if (isMovingH) {
          // Diagonal 45 deg Up
          ctx.save();
          ctx.translate(isRight ? 20 : 12, 18);
          ctx.rotate(isRight ? -Math.PI / 4 : (-3 * Math.PI) / 4);
          ctx.fillRect(0, -3, 22, 6);
          if (p.muzzleFlash > 0) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(24, 0, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(24, 0, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else {
          // Straight UP 90 deg
          ctx.save();
          ctx.translate(isRight ? 18 : 14, 10);
          ctx.rotate(-Math.PI / 2);
          ctx.fillRect(0, -3, 22, 6);
          if (p.muzzleFlash > 0) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(24, 0, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(24, 0, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      } else if (p.aimDown) {
        if (isMovingH) {
          // Diagonal 45 deg Down
          ctx.save();
          ctx.translate(isRight ? 20 : 12, 28);
          ctx.rotate(isRight ? Math.PI / 4 : (3 * Math.PI) / 4);
          ctx.fillRect(0, -3, 22, 6);
          if (p.muzzleFlash > 0) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(24, 0, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(24, 0, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else {
          // Straight DOWN 90 deg
          ctx.save();
          ctx.translate(isRight ? 18 : 14, 34);
          ctx.rotate(Math.PI / 2);
          ctx.fillRect(0, -3, 22, 6);
          if (p.muzzleFlash > 0) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(24, 0, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(24, 0, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      } else {
        // Straight Horizontal
        ctx.fillRect(isRight ? 20 : -10, 20, 22, 6);
        if (p.muzzleFlash > 0) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(isRight ? 44 : -12, 23, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(isRight ? 44 : -12, 23, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // Night Darkness Overlay with Player Headlight / Protective Aura
  private drawNightDarknessAndLight(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const isNight = this.currentPhase === 'NIGHT';
    const darknessAlpha = isNight ? 0.78 : 0.35; // Sunset has gentle twilight, Night is dark

    ctx.save();

    // Create a temporary canvas or radial gradient mask around player screen position
    const playerScreenX = this.player.x - this.cameraX + this.player.width / 2;
    const playerScreenY = this.player.y + this.player.height / 2;

    const auraRadius = isNight ? 240 : 340;

    // Use radial gradient that is transparent at player center and dark outer
    const lightGrad = ctx.createRadialGradient(
      playerScreenX,
      playerScreenY,
      30,
      playerScreenX,
      playerScreenY,
      auraRadius
    );
    lightGrad.addColorStop(0, 'rgba(3, 7, 18, 0)');
    lightGrad.addColorStop(0.65, `rgba(3, 7, 18, ${darknessAlpha * 0.4})`);
    lightGrad.addColorStop(1, `rgba(3, 7, 18, ${darknessAlpha})`);

    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle flashlight cone towards facing direction at night
    if (isNight) {
      const coneGrad = ctx.createRadialGradient(
        playerScreenX,
        playerScreenY,
        10,
        playerScreenX + (this.player.facing === 'right' ? 120 : -120),
        playerScreenY,
        180
      );
      coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.12)');
      coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.arc(playerScreenX, playerScreenY, 180, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
