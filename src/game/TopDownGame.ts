import { Question, SubjectId, WeaponType, ItemType, DayNightPhase, QuizPortal } from '../types/game';
import { sounds } from '../services/soundEngine';

export interface TopDownCallbacks {
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
}

interface SupplyPod {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  itemInside: ItemType;
  destroyed: boolean;
}

interface Enemy {
  id: string;
  type: 'soldier' | 'turret' | 'drone' | 'boss';
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  shootCooldown: number;
  shootInterval: number;
  angle: number;
  color: string;
}

export class TopDownGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: TopDownCallbacks;
  private questions: Question[];
  private subject: SubjectId;

  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;

  // Map size
  public readonly MAP_WIDTH = 2400;
  public readonly MAP_HEIGHT = 1600;
  private cameraX: number = 0;
  private cameraY: number = 0;
  private screenShake: number = 0;

  // Day/Night Cycle
  private timeOfDay: number = 0;
  private readonly CYCLE_DURATION: number = 42;
  private currentPhase: DayNightPhase = 'DAY';

  // Player state
  private player = {
    x: 300,
    y: 800,
    radius: 18,
    speed: 4.8,
    angle: 0,
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
  };

  public mouseAim = {
    canvasX: 0,
    canvasY: 0,
    active: true,
  };

  public keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false,
    skill: false,
  };

  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private supplyPods: SupplyPod[] = [];
  private dropItems: DropItem[] = [];
  private particles: Particle[] = [];
  private damagePopups: DamagePopup[] = [];
  private portals: QuizPortal[] = [];
  private bossSpawned: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    questions: Question[],
    subject: SubjectId,
    callbacks: TopDownCallbacks
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
    this.enemies = [];
    this.supplyPods = [];
    this.dropItems = [];
    this.particles = [];
    this.damagePopups = [];
    this.portals = [];

    // 3 Gateways partitioning the map into sectors
    const portalPositions = [
      { x: 750, y: 550, w: 40, h: 500, label: 'CỔNG PHONG ẤN VÙNG NGOẠI Ô' },
      { x: 1350, y: 550, w: 40, h: 500, label: 'CỔNG PHONG ẤN PHÒNG TUYẾN TRUNG TÂM' },
      { x: 1950, y: 550, w: 40, h: 500, label: 'CỔNG PHONG ẤN CĂN CỨ TỔNG HÀNH DINH' },
    ];

    const shuffled = [...this.questions].sort(() => Math.random() - 0.5);

    portalPositions.forEach((pos, idx) => {
      const q = shuffled[idx % shuffled.length] || {
        id: `q_td_${idx}`,
        subject: this.subject,
        question: 'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?',
        options: ['1945', '1954', '1972', '1975'] as [string, string, string, string],
        correctIndex: 1,
        hint: 'Năm 1954',
      };

      this.portals.push({
        id: `portal_td_${idx}`,
        x: pos.x,
        y: pos.y,
        width: pos.w,
        height: pos.h,
        question: q,
        cleared: false,
        active: true,
        label: pos.label,
      });
    });

    // Flying Supply Pods
    const podConfigs: [number, number, ItemType][] = [
      [400, 300, 'MACHINE_GUN'],
      [650, 1100, 'SPREAD_GUN'],
      [1100, 400, 'MUSHROOM'],
      [1250, 1200, 'LASER_GUN'],
      [1700, 350, 'ROCKET_LAUNCHER'],
      [1800, 1250, 'MUSHROOM'],
      [2200, 700, 'SPREAD_GUN'],
    ];

    podConfigs.forEach(([x, y, item]) => {
      this.supplyPods.push({
        x,
        y,
        vx: 1.2,
        vy: 0.8,
        hp: 35,
        itemInside: item,
        destroyed: false,
      });
    });

    // Initial Enemies
    this.spawnEnemies();
  }

  private spawnEnemies() {
    // Sector 1
    for (let i = 0; i < 7; i++) {
      this.enemies.push({
        id: `soldier_1_${i}`,
        type: 'soldier',
        x: 450 + Math.random() * 250,
        y: 600 + Math.random() * 400,
        radius: 16,
        hp: 30,
        maxHp: 30,
        speed: 2.2,
        shootCooldown: 60 + Math.random() * 80,
        shootInterval: 120,
        angle: 0,
        color: '#ef4444',
      });
    }

    // Sector 1 Turrets
    this.enemies.push({
      id: 'turret_1_1',
      type: 'turret',
      x: 600,
      y: 400,
      radius: 20,
      hp: 55,
      maxHp: 55,
      speed: 0,
      shootCooldown: 80,
      shootInterval: 110,
      angle: 0,
      color: '#f59e0b',
    });

    // Sector 2
    for (let i = 0; i < 10; i++) {
      this.enemies.push({
        id: `soldier_2_${i}`,
        type: 'soldier',
        x: 950 + Math.random() * 350,
        y: 500 + Math.random() * 600,
        radius: 16,
        hp: 35,
        maxHp: 35,
        speed: 2.4,
        shootCooldown: 50 + Math.random() * 70,
        shootInterval: 100,
        angle: 0,
        color: '#ef4444',
      });
    }

    // Flying Drones
    for (let i = 0; i < 4; i++) {
      this.enemies.push({
        id: `drone_${i}`,
        type: 'drone',
        x: 900 + i * 250,
        y: 350 + (i % 2) * 800,
        radius: 14,
        hp: 28,
        maxHp: 28,
        speed: 2.8,
        shootCooldown: 60 + Math.random() * 60,
        shootInterval: 90,
        angle: 0,
        color: '#a855f7',
      });
    }

    // Sector 3 Turrets
    this.enemies.push({
      id: 'turret_3_1',
      type: 'turret',
      x: 1600,
      y: 500,
      radius: 22,
      hp: 65,
      maxHp: 65,
      speed: 0,
      shootCooldown: 70,
      shootInterval: 95,
      angle: 0,
      color: '#f59e0b',
    });
    this.enemies.push({
      id: 'turret_3_2',
      type: 'turret',
      x: 1600,
      y: 1100,
      radius: 22,
      hp: 65,
      maxHp: 65,
      speed: 0,
      shootCooldown: 80,
      shootInterval: 95,
      angle: 0,
      color: '#f59e0b',
    });
  }

  private spawnBoss() {
    if (this.bossSpawned) return;
    this.bossSpawned = true;
    this.enemies.push({
      id: 'boss_hq',
      type: 'boss',
      x: 2150,
      y: 800,
      radius: 50,
      hp: 450,
      maxHp: 450,
      speed: 1.0,
      shootCooldown: 40,
      shootInterval: 45,
      angle: 0,
      color: '#dc2626',
    });
  }

  public setMouseAim(canvasX: number, canvasY: number, active: boolean = true) {
    this.mouseAim.canvasX = canvasX;
    this.mouseAim.canvasY = canvasY;
    this.mouseAim.active = active;
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

      // Shatter blast particles
      for (let i = 0; i < 70; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 8;
        this.particles.push({
          x: portal.x + portal.width / 2,
          y: portal.y + Math.random() * portal.height,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color: ['#06b6d4', '#38bdf8', '#fbbf24', '#f43f5e'][Math.floor(Math.random() * 4)],
          size: 3.5 + Math.random() * 3,
          life: 0,
          maxLife: 35 + Math.random() * 20,
        });
      }

      this.player.score += 500;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
      this.player.mana = Math.min(this.player.maxMana, this.player.mana + 50);
      sounds.explosion();
    }

    const allCleared = this.portals.every((p) => p.cleared);
    if (allCleared && !this.bossSpawned) {
      this.spawnBoss();
    }

    this.isPaused = false;
    this.lastTime = performance.now();
  }

  public activateSkill() {
    if (this.player.mana >= 35 && !this.player.shieldActive) {
      this.player.mana -= 35;
      this.player.shieldActive = true;
      this.player.shieldTimeRemaining = 6.0;
      sounds.shieldActivate();

      for (let i = 0; i < 30; i++) {
        const ang = (i / 30) * Math.PI * 2;
        this.particles.push({
          x: this.player.x,
          y: this.player.y,
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
    // Day / Night cycle
    this.timeOfDay = (this.timeOfDay + dt) % this.CYCLE_DURATION;
    const third = this.CYCLE_DURATION / 3;
    if (this.timeOfDay < third) {
      this.currentPhase = 'DAY';
    } else if (this.timeOfDay < third * 2) {
      this.currentPhase = 'SUNSET';
    } else {
      this.currentPhase = 'NIGHT';
    }

    // Passive mana
    this.player.mana = Math.min(this.player.maxMana, this.player.mana + dt * 4);

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

    // Player 8-direction movement
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

    this.player.x += moveX * this.player.speed;
    this.player.y += moveY * this.player.speed;

    // Bounds
    this.player.x = Math.max(30, Math.min(this.MAP_WIDTH - 30, this.player.x));
    this.player.y = Math.max(30, Math.min(this.MAP_HEIGHT - 30, this.player.y));

    // Player aiming angle (towards mouse)
    const targetAimX = this.mouseAim.canvasX + this.cameraX;
    const targetAimY = this.mouseAim.canvasY + this.cameraY;
    this.player.angle = Math.atan2(targetAimY - this.player.y, targetAimX - this.player.x);

    // Camera follow player
    const targetCamX = this.player.x - this.canvas.width / 2;
    const targetCamY = this.player.y - this.canvas.height / 2;
    this.cameraX += (targetCamX - this.cameraX) * 0.12;
    this.cameraY += (targetCamY - this.cameraY) * 0.12;
    this.cameraX = Math.max(0, Math.min(this.MAP_WIDTH - this.canvas.width, this.cameraX));
    this.cameraY = Math.max(0, Math.min(this.MAP_HEIGHT - this.canvas.height, this.cameraY));

    // Shooting
    if (this.player.shootCooldown > 0) {
      this.player.shootCooldown -= dt * 60;
    }
    if (this.keys.shoot && this.player.shootCooldown <= 0) {
      this.firePlayerWeapon();
    }
    if (this.keys.skill) {
      this.activateSkill();
    }

    // Portal collisions
    for (let i = 0; i < this.portals.length; i++) {
      const portal = this.portals[i];
      if (portal.active && !portal.cleared) {
        if (
          this.player.x + this.player.radius >= portal.x &&
          this.player.x - this.player.radius <= portal.x + portal.width &&
          this.player.y + this.player.radius >= portal.y &&
          this.player.y - this.player.radius <= portal.y + portal.height
        ) {
          // Push player back
          this.player.x = portal.x - this.player.radius - 4;
          this.pause();
          this.callbacks.onTriggerQuiz(i, this.portals.length, portal.question);
          return;
        }
      }
    }

    // Supply pods
    for (const pod of this.supplyPods) {
      if (pod.destroyed) continue;
      pod.x += pod.vx;
      pod.y += pod.vy;
      if (pod.x < 100 || pod.x > this.MAP_WIDTH - 100) pod.vx *= -1;
      if (pod.y < 100 || pod.y > this.MAP_HEIGHT - 100) pod.vy *= -1;
    }

    // Drop items pickup
    for (let i = this.dropItems.length - 1; i >= 0; i--) {
      const item = this.dropItems[i];
      const dist = Math.hypot(this.player.x - item.x, this.player.y - item.y);
      if (dist < this.player.radius + item.radius) {
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
        } else if (item.type === 'ROCKET_LAUNCHER') {
          this.player.weapon = 'ROCKET';
          this.player.score += 200;
        }
        sounds.itemPickup();
        this.dropItems.splice(i, 1);
      }
    }

    // Bullets update
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      // Rocket smoke trail
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
        // Hit supply pods
        for (const pod of this.supplyPods) {
          if (!pod.destroyed && Math.hypot(b.x - pod.x, b.y - pod.y) < 25) {
            pod.hp -= b.damage;
            sounds.hit();
            if (pod.hp <= 0) {
              pod.destroyed = true;
              sounds.supplyDrop();
              sounds.explosion();
              this.dropItems.push({
                x: pod.x,
                y: pod.y,
                type: pod.itemInside,
                radius: 16,
              });
            }
            if (!b.isLaser) {
              this.bullets.splice(i, 1);
              break;
            }
          }
        }

        // Hit enemies
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < enemy.radius + b.radius) {
            enemy.hp -= b.damage;
            sounds.hit();

            // Floating damage popup
            this.damagePopups.push({
              x: enemy.x + (Math.random() - 0.5) * 10,
              y: enemy.y - 12,
              text: `-${b.damage}`,
              color: b.isLaser ? '#06b6d4' : b.isRocket ? '#ef4444' : '#facc15',
              life: 0,
              maxLife: 24,
            });

            // Rocket Area Explosion
            if (b.isRocket) {
              this.screenShake = 12;
              sounds.explosion();
              for (const otherEnemy of this.enemies) {
                const blastDist = Math.hypot(b.x - otherEnemy.x, b.y - otherEnemy.y);
                if (blastDist < 90 && otherEnemy !== enemy) {
                  otherEnemy.hp -= 40;
                }
              }
              for (let k = 0; k < 40; k++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 2 + Math.random() * 6;
                this.particles.push({
                  x: b.x,
                  y: b.y,
                  vx: Math.cos(ang) * spd,
                  vy: Math.sin(ang) * spd,
                  color: ['#ef4444', '#f97316', '#fbbf24'][Math.floor(Math.random() * 3)],
                  size: 4,
                  life: 0,
                  maxLife: 25,
                });
              }
            }

            if (enemy.hp <= 0) {
              sounds.explosion();
              this.player.kills += 1;
              this.player.score += enemy.type === 'boss' ? 2500 : enemy.type === 'turret' ? 250 : 120;
              this.player.mana = Math.min(this.player.maxMana, this.player.mana + 15);

              if (enemy.type === 'boss') {
                this.enemies.splice(j, 1);
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
        // Enemy bullet hitting player
        if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < this.player.radius + b.radius) {
          if (!this.player.shieldActive) {
            this.player.hp -= b.damage;
            sounds.hit();
            if (this.player.hp <= 0) {
              sounds.gameOver();
              this.stop();
              this.callbacks.onGameOver(this.player.score, this.player.kills);
              return;
            }
          } else {
            sounds.hit();
          }
          this.bullets.splice(i, 1);
        }
      }
    }

    // Enemies logic
    for (const enemy of this.enemies) {
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const dist = Math.hypot(dx, dy);

      enemy.angle = Math.atan2(dy, dx);

      if (enemy.type === 'soldier') {
        if (dist > 150) {
          enemy.x += Math.cos(enemy.angle) * enemy.speed;
          enemy.y += Math.sin(enemy.angle) * enemy.speed;
        }
        enemy.shootCooldown -= 1;
        if (dist < 450 && enemy.shootCooldown <= 0) {
          enemy.shootCooldown = enemy.shootInterval;
          sounds.shootEnemy();
          this.bullets.push({
            x: enemy.x + Math.cos(enemy.angle) * 16,
            y: enemy.y + Math.sin(enemy.angle) * 16,
            vx: Math.cos(enemy.angle) * 4.2,
            vy: Math.sin(enemy.angle) * 4.2,
            radius: 4.5,
            isPlayer: false,
            damage: 15,
            color: '#ef4444',
          });
        }
      } else if (enemy.type === 'turret') {
        enemy.shootCooldown -= 1;
        if (dist < 550 && enemy.shootCooldown <= 0) {
          enemy.shootCooldown = enemy.shootInterval;
          sounds.shootEnemy();
          this.bullets.push({
            x: enemy.x + Math.cos(enemy.angle) * 22,
            y: enemy.y + Math.sin(enemy.angle) * 22,
            vx: Math.cos(enemy.angle) * 4.5,
            vy: Math.sin(enemy.angle) * 4.5,
            radius: 5,
            isPlayer: false,
            damage: 18,
            color: '#f59e0b',
          });
        }
      } else if (enemy.type === 'drone') {
        enemy.x += Math.cos(enemy.angle) * enemy.speed;
        enemy.y += Math.sin(enemy.angle) * enemy.speed;
        enemy.shootCooldown -= 1;
        if (dist < 350 && enemy.shootCooldown <= 0) {
          enemy.shootCooldown = enemy.shootInterval;
          sounds.shootEnemy();
          this.bullets.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(enemy.angle) * 4.8,
            vy: Math.sin(enemy.angle) * 4.8,
            radius: 5,
            isPlayer: false,
            damage: 20,
            color: '#c084fc',
          });
        }
      } else if (enemy.type === 'boss') {
        enemy.shootCooldown -= 1;
        if (enemy.shootCooldown <= 0) {
          enemy.shootCooldown = enemy.shootInterval;
          sounds.shootEnemy();
          [-0.3, 0, 0.3].forEach((offset) => {
            this.bullets.push({
              x: enemy.x + Math.cos(enemy.angle + offset) * 35,
              y: enemy.y + Math.sin(enemy.angle + offset) * 35,
              vx: Math.cos(enemy.angle + offset) * 5,
              vy: Math.sin(enemy.angle + offset) * 5,
              radius: 6,
              isPlayer: false,
              damage: 25,
              color: '#dc2626',
            });
          });
        }
      }

      // Contact damage
      if (dist < enemy.radius + this.player.radius) {
        if (!this.player.shieldActive) {
          this.player.hp -= 0.6;
          if (this.player.hp <= 0) {
            sounds.gameOver();
            this.stop();
            this.callbacks.onGameOver(this.player.score, this.player.kills);
            return;
          }
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life += 1;
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }

    // Damage popups
    for (let i = this.damagePopups.length - 1; i >= 0; i--) {
      const dp = this.damagePopups[i];
      dp.y -= 0.8;
      dp.life += 1;
      if (dp.life >= dp.maxLife) this.damagePopups.splice(i, 1);
    }

    // Stats HUD callback
    const cleared = this.portals.filter((p) => p.cleared).length;
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
      clearedPortals: cleared,
      totalPortals: this.portals.length,
    });
  }

  private firePlayerWeapon() {
    const ang = this.player.angle;
    const startX = this.player.x + Math.cos(ang) * 22;
    const startY = this.player.y + Math.sin(ang) * 22;

    this.player.muzzleFlash = 4;

    // Shell casing
    this.particles.push({
      x: this.player.x,
      y: this.player.y,
      vx: Math.cos(ang + Math.PI / 2) * (2 + Math.random()),
      vy: Math.sin(ang + Math.PI / 2) * (2 + Math.random()),
      color: '#eab308',
      size: 2,
      life: 0,
      maxLife: 20,
    });

    if (this.player.weapon === 'NORMAL') {
      this.player.shootCooldown = 10;
      sounds.shootNormal();
      this.bullets.push({
        x: startX,
        y: startY,
        vx: Math.cos(ang) * 11,
        vy: Math.sin(ang) * 11,
        radius: 4,
        isPlayer: true,
        damage: 18,
        color: '#facc15',
      });
    } else if (this.player.weapon === 'MACHINE_GUN') {
      this.player.shootCooldown = 5.5;
      sounds.shootMachineGun();
      const spreadAng = ang + (Math.random() - 0.5) * 0.08;
      this.bullets.push({
        x: startX,
        y: startY,
        vx: Math.cos(spreadAng) * 13,
        vy: Math.sin(spreadAng) * 13,
        radius: 4.5,
        isPlayer: true,
        damage: 16,
        color: '#fb923c',
      });
    } else if (this.player.weapon === 'SPREAD') {
      this.player.shootCooldown = 15;
      sounds.shootSpread();
      [-0.26, -0.13, 0, 0.13, 0.26].forEach((offset) => {
        this.bullets.push({
          x: startX,
          y: startY,
          vx: Math.cos(ang + offset) * 11,
          vy: Math.sin(ang + offset) * 11,
          radius: 5.5,
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
        vx: Math.cos(ang) * 16,
        vy: Math.sin(ang) * 16,
        radius: 7,
        isPlayer: true,
        damage: 45,
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
        vx: Math.cos(ang) * 9,
        vy: Math.sin(ang) * 9,
        radius: 7,
        isPlayer: true,
        damage: 65,
        color: '#ef4444',
        isRocket: true,
      });
    }
  }

  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Screen shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    ctx.save();
    ctx.translate(-Math.round(this.cameraX), -Math.round(this.cameraY));

    // Arena Floor
    this.drawFloor(ctx);

    // Portals
    this.drawPortals(ctx);

    // Supply Pods & Items
    this.drawSupplyPods(ctx);
    this.drawDropItems(ctx);

    // Enemies
    this.drawEnemies(ctx);

    // Bullets
    this.drawBullets(ctx);

    // Particles
    this.drawParticles(ctx);

    // Player Commando
    this.drawPlayer(ctx);

    // Floating Damage Popups
    this.drawDamagePopups(ctx);

    ctx.restore();

    // Night darkness & flashlight cone
    if (this.currentPhase === 'NIGHT' || this.currentPhase === 'SUNSET') {
      this.drawNightDarkness(ctx, w, h);
    }

    // Laser Sight & Crosshair
    this.drawCrosshair(ctx);

    ctx.restore();
  }

  private drawFloor(ctx: CanvasRenderingContext2D) {
    // Military base metal grid
    ctx.fillStyle = this.currentPhase === 'DAY' ? '#1e293b' : this.currentPhase === 'SUNSET' ? '#271914' : '#090d16';
    ctx.fillRect(0, 0, this.MAP_WIDTH, this.MAP_HEIGHT);

    ctx.strokeStyle = this.currentPhase === 'DAY' ? '#334155' : this.currentPhase === 'SUNSET' ? '#43281c' : '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.MAP_WIDTH; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.MAP_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < this.MAP_HEIGHT; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.MAP_WIDTH, y);
      ctx.stroke();
    }
  }

  private drawPortals(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < this.portals.length; i++) {
      const p = this.portals[i];
      if (p.cleared) continue;

      const pulse = Math.sin(Date.now() * 0.008) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(6, 182, 212, ${0.7 * pulse})`;
      ctx.fillRect(p.x, p.y, p.width, p.height);

      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(p.x - 4, p.y - 10, p.width + 8, 14);
      ctx.fillRect(p.x - 4, p.y + p.height - 4, p.width + 8, 14);

      ctx.save();
      ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`⚡ CỔNG TRẮC NGHIỆM #${i + 1}`, 0, 4);
      ctx.restore();
    }
  }

  private drawSupplyPods(ctx: CanvasRenderingContext2D) {
    for (const pod of this.supplyPods) {
      if (pod.destroyed) continue;
      ctx.save();
      ctx.translate(pod.x, pod.y);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const lbl = pod.itemInside === 'MUSHROOM' ? '🍄' : pod.itemInside === 'MACHINE_GUN' ? 'M' : pod.itemInside === 'SPREAD_GUN' ? 'S' : pod.itemInside === 'LASER_GUN' ? 'L' : 'R';
      ctx.fillText(lbl, 0, 4);
      ctx.restore();
    }
  }

  private drawDropItems(ctx: CanvasRenderingContext2D) {
    for (const item of this.dropItems) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fillStyle = item.type === 'MUSHROOM' ? '#10b981' : item.type === 'MACHINE_GUN' ? '#f59e0b' : item.type === 'SPREAD_GUN' ? '#ef4444' : item.type === 'LASER_GUN' ? '#06b6d4' : '#dc2626';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const lbl = item.type === 'MUSHROOM' ? '🍄' : item.type === 'MACHINE_GUN' ? 'M' : item.type === 'SPREAD_GUN' ? 'S' : item.type === 'LASER_GUN' ? 'L' : 'R';
      ctx.fillText(lbl, 0, 4);
      ctx.restore();
    }
  }

  private drawEnemies(ctx: CanvasRenderingContext2D) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      // Health bar
      if (e.hp < e.maxHp) {
        ctx.fillStyle = '#000';
        ctx.fillRect(-e.radius, -e.radius - 8, e.radius * 2, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-e.radius, -e.radius - 8, (e.hp / e.maxHp) * e.radius * 2, 4);
      }

      ctx.rotate(e.angle);

      if (e.type === 'soldier') {
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, -3, 18, 6);
      } else if (e.type === 'turret') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, -4, 24, 8);
      } else if (e.type === 'drone') {
        ctx.fillStyle = '#7e22ce';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'boss') {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, -8, 48, 16);
      }

      ctx.restore();
    }
  }

  private drawBullets(ctx: CanvasRenderingContext2D) {
    for (const b of this.bullets) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
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
    for (const dp of this.damagePopups) {
      ctx.save();
      const alpha = 1 - dp.life / dp.maxLife;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = dp.color;
      ctx.textAlign = 'center';
      ctx.fillText(dp.text, dp.x, dp.y);
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Shield Aura
    if (p.shieldActive) {
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.rotate(p.angle);

    // Body
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Vest
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Gun Barrel
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, -4, 24, 8);

    // Muzzle flash
    if (p.muzzleFlash > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(26, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Red Headband
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-p.radius, -3, p.radius * 2, 6);

    ctx.restore();
  }

  private drawNightDarkness(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const isNight = this.currentPhase === 'NIGHT';
    const alpha = isNight ? 0.8 : 0.35;

    const screenX = this.player.x - this.cameraX;
    const screenY = this.player.y - this.cameraY;

    ctx.save();
    const grad = ctx.createRadialGradient(screenX, screenY, 40, screenX, screenY, 260);
    grad.addColorStop(0, 'rgba(3, 7, 18, 0)');
    grad.addColorStop(0.7, `rgba(3, 7, 18, ${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(3, 7, 18, ${alpha})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Flashlight beam
    if (isNight) {
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(this.player.angle);
      const coneGrad = ctx.createRadialGradient(0, 0, 20, 220, 0, 260);
      coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
      coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 260, -0.4, 0.4);
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
    ctx.strokeStyle = '#22d3ee';
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
