import type { ContractCode, EffectiveContractCode, ScoringSettings } from './types.js';

export type StatsPreset = 'all' | 'year' | 'custom' | 'last10';

export interface StatsFilter {
  preset: StatsPreset;
  from?: string;
  to?: string;
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProfileData {
  version: 1;
  profiles: PlayerProfile[];
  assignments: Record<string, string>;
}

export interface PlayerStatsSummary {
  profileId: string;
  displayName: string;
  aliases: string[];
  active: boolean;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  podiums: number;
  podiumRate: number;
  averagePlacement: number | null;
  averageScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
}

export interface PlayerGameStat {
  gameId: string;
  gameName?: string;
  completedAt: string;
  sourcePlayerId: string;
  sourceName: string;
  placement: number;
  finalScore: number;
  playerCount: number;
  participants: string[];
  enabledContracts: ContractCode[];
  scoring: ScoringSettings;
}

export interface ContractMetric {
  rounds: number;
  successes: number;
  successRate: number | null;
  bonuses: number;
  totalDelta: number;
  averageDelta: number | null;
}

export interface ContractStatsRow {
  contract: ContractCode;
  chooser: ContractMetric;
  allRound: ContractMetric;
  jokerBreakdown?: Partial<Record<EffectiveContractCode, { rounds: number; chooserRounds: number; totalDelta: number }>>;
}

export interface PlayerStatsDetail {
  summary: PlayerStatsSummary;
  games: PlayerGameStat[];
  contracts: ContractStatsRow[];
}

export interface PlayerAppearance {
  key: string;
  gameId: string;
  gameName?: string;
  gameStatus: string;
  playerId: string;
  sourceName: string;
  profileId: string;
  explicitAssignment: boolean;
  qualifies: boolean;
}

export interface IdentityAdminView {
  profiles: Array<PlayerProfile & { active: boolean; appearanceCount: number; qualifyingAppearanceCount: number }>;
  appearances: PlayerAppearance[];
}
