import { randomUUID } from 'node:crypto';
import { computeDeckDistribution } from './deck.js';
import { CONTRACT_CODES, type ContractCode, type Game, type Player, type Round, type ScoringSettings } from './types.js';

export const DEFAULT_SCORING: ScoringSettings = {
  successFirst: -100, successSecond: -50, heart: 20, queen: 50,
  kingOfHearts: 100, trick: 40, lastTrick: 100, bonus: -25,
};

export function createGame(name?: string, playerCount = 5): Game {
  const now = new Date().toISOString();
  return {
    id: randomUUID(), name: name?.trim() || undefined, status: 'waiting_players', createdAt: now, updatedAt: now,
    settings: {
      playerCount, enabledContracts: [...CONTRACT_CODES], deck: computeDeckDistribution(playerCount),
      scoring: { ...DEFAULT_SCORING }, turnOrder: [], resultEntryMode: 'players', setupStep: 'settings', lowestScoreWins: true,
    },
    players: [], rounds: [],
  };
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function ensureUniqueName(players: Player[], name: string, excludedId?: string) {
  const normalized = normalizeName(name);
  if (!normalized) throw new Error('Le nom du joueur est obligatoire.');
  if (normalized.length > 40) throw new Error('Le nom du joueur ne peut pas dépasser 40 caractères.');
  if (players.some((p) => p.id !== excludedId && p.name.localeCompare(normalized, 'fr', { sensitivity: 'base' }) === 0)) throw new Error('Ce nom est déjà utilisé.');
  return normalized;
}

export function availableContracts(game: Game, playerId: string): ContractCode[] {
  const used = new Set(game.rounds.filter((round) => round.status === 'validated' && round.chooserPlayerId === playerId).map((round) => round.contract));
  return game.settings.enabledContracts.filter((contract) => !used.has(contract));
}

export function createNextRound(game: Game): Round | undefined {
  const validated = game.rounds.filter((round) => round.status === 'validated').length;
  const total = game.players.length * game.settings.enabledContracts.length;
  if (validated >= total) return undefined;
  const chooserPlayerId = game.settings.turnOrder[validated % game.settings.turnOrder.length];
  return {
    id: randomUUID(), index: validated + 1, chooserPlayerId, status: 'choosing', submissions: {}, scoreDelta: {},
    bonusApplied: false, chooserSucceeded: false, validationErrors: [], createdAt: new Date().toISOString(),
  };
}
