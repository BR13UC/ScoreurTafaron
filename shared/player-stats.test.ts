import { describe, expect, it } from 'vitest';
import { playerLeaderboard, playerStatsDetail } from './player-stats.js';
import type { Game, Round } from './types.js';
import type { PlayerProfileData } from './stats-types.js';

const profiles: PlayerProfileData = { version: 1, profiles: [
  { id: 'alice', displayName: 'Alice', aliases: ['alice'], createdAt: '', updatedAt: '' },
  { id: 'bob', displayName: 'Bob', aliases: ['bob'], createdAt: '', updatedAt: '' },
  { id: 'cara', displayName: 'Cara', aliases: ['cara'], createdAt: '', updatedAt: '' },
], assignments: {} };

function makeGame(id: string, completedAt: string, scores: [number, number, number], finishedReason: Game['finishedReason'] = 'complete', contract: Round['contract'] = 'C'): Game {
  const players = ['Alice', 'Bob', 'Cara'].map((name) => ({ id: name.toLowerCase(), name, joinedAt: '', connected: false, kind: 'local' as const }));
  const round: Round = { id: `${id}-r`, index: 1, chooserPlayerId: 'alice', contract, ...(contract === 'J' ? { jokerContract: 'C' as const } : {}), status: 'validated', submissions: {}, scoreDelta: Object.fromEntries(players.map((player, index) => [player.id, scores[index]])), bonusApplied: true, chooserSucceeded: true, validationErrors: [], createdAt: completedAt, validatedAt: completedAt };
  return { id, name: id, status: 'finished', finishedReason, createdAt: completedAt, updatedAt: completedAt, settings: { playerCount: 3, enabledContracts: ['C', 'J'], scoring: { successFirst: -100, successSecond: -50, heart: 20, queen: 50, kingOfHearts: 100, trick: 40, lastTrick: 100, bonus: -25 }, turnOrder: players.map((p) => p.id), resultEntryMode: 'players', setupStep: 'ready', lowestScoreWins: true, deck: {} as Game['settings']['deck'] }, players, rounds: [round] };
}

describe('statistiques joueur', () => {
  it('exclut les fins anticipées et attribue les victoires partagées avec classement compétition', () => {
    const games = [makeGame('tie', '2026-01-02T10:00:00Z', [0, 0, 20]), makeGame('early', '2026-01-03T10:00:00Z', [-50, 0, 50], 'early')];
    const board = playerLeaderboard(games, profiles, { preset: 'all' });
    expect(board.map((item) => [item.displayName, item.wins, item.averagePlacement])).toEqual([['Alice', 1, 1], ['Bob', 1, 1], ['Cara', 0, 3]]);
  });

  it('applique les bornes de dates inclusivement et le filtre des dix dernières parties par profil', () => {
    const games = Array.from({ length: 12 }, (_, index) => makeGame(`g${index}`, `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00Z`, [index, 20, 30]));
    expect(playerLeaderboard(games, profiles, { preset: 'custom', from: '2026-01-02', to: '2026-01-03' })[0].gamesPlayed).toBe(2);
    expect(playerStatsDetail(games, profiles, 'alice', { preset: 'last10' }).games).toHaveLength(10);
    expect(() => playerLeaderboard(games, profiles, { preset: 'custom', from: '2026-02-30', to: '2026-03-01' })).toThrow(/période/i);
  });

  it('calcule les deux perspectives par contrat et détaille le Joker', () => {
    const detail = playerStatsDetail([makeGame('joker', '2026-02-01T10:00:00Z', [-25, 10, 15], 'complete', 'J')], profiles, 'alice', { preset: 'all' });
    expect(detail.contracts[0]).toMatchObject({ contract: 'J', chooser: { rounds: 1, successes: 1, bonuses: 1, totalDelta: -25, averageDelta: -25 }, allRound: { rounds: 1, totalDelta: -25 }, jokerBreakdown: { C: { rounds: 1, chooserRounds: 1, totalDelta: -25 } } });
  });

  it('conserve le contexte des barèmes et réagit à la liste actuelle des sauvegardes', () => {
    const first = makeGame('first', '2025-12-31T10:00:00Z', [-20, 10, 10]); const second = makeGame('second', '2026-01-01T10:00:00Z', [40, 0, 10]); second.settings.scoring.heart = 99;
    const detail = playerStatsDetail([first, second], profiles, 'alice', { preset: 'all' });
    expect(detail.summary).toMatchObject({ gamesPlayed: 2, averageScore: 10, bestScore: -20, worstScore: 40 });
    expect(detail.games.map((item) => item.scoring.heart)).toEqual([20, 99]);
    expect(playerLeaderboard([second], profiles, { preset: 'all' }).find((item) => item.profileId === 'alice')?.gamesPlayed).toBe(1);
    expect(playerLeaderboard([first, second], profiles, { preset: 'year' }, new Date('2026-07-01T00:00:00Z'))[0].gamesPlayed).toBe(1);
  });
});
