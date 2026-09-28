export type SubjectId = 'history' | 'literature' | 'ktpl';

export interface SubjectInfo {
  id: SubjectId;
  name: string;
  shortName: string;
  icon: string;
  badgeColor: string;
  description: string;
  accentClass: string;
}

export interface Question {
  id: string;
  subject: SubjectId;
  question: string;
  options: [string, string, string, string]; // A, B, C, D
  correctIndex: number; // 0, 1, 2, 3
  hint: string;
  createdAt?: number;
}

export type WeaponType = 'NORMAL' | 'MACHINE_GUN' | 'SPREAD' | 'LASER' | 'ROCKET';

export type ItemType = 'MUSHROOM' | 'MACHINE_GUN' | 'SPREAD_GUN' | 'LASER_GUN' | 'ROCKET_LAUNCHER';

export type ShooterStyle = 'SIDE_SCROLLER' | 'TOP_DOWN';

export type ZombieType = 'walker' | 'runner' | 'spitter' | 'tank' | 'boss_mutant';

export type DayNightPhase = 'DAY' | 'SUNSET' | 'NIGHT';

export type GameScreen = 'MENU' | 'SELECT_SUBJECT' | 'PLAYING' | 'MANAGE_QUESTIONS' | 'GAME_OVER' | 'VICTORY';

export interface PlayerStats {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  score: number;
  kills: number;
  weapon: WeaponType;
  shieldActive: boolean;
  shieldDuration: number;
  shieldCooldown: number;
}

export interface QuizPortal {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  question: Question;
  cleared: boolean;
  active: boolean;
  label: string;
}
