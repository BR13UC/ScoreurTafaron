import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from './game.js';
import { chooserSucceeded, computeRoundScore, recomputeGameScores, validateRoundResult } from './scoring.js';
import type { ContractCode, Game, Round, RoundResult } from './types.js';

let game: Game;
const makeRound = (contract: ContractCode, jokerContract?: Round['jokerContract']): Round => ({ id: 'round', index: 1, chooserPlayerId: 'a', contract, jokerContract, status: 'scoring', submissions: {}, scoreDelta: {}, bonusApplied: false, chooserSucceeded: false, validationErrors: [], createdAt: '' });

beforeEach(() => {
  game = createGame('Test', 5); game.players = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id, joinedAt: '', connected: true, kind: 'local' }));
});

describe('calcul des scores', () => {
  it('calcule Réussite et le bonus du choisisseur', () => {
    const round = makeRound('R'); const result = { firstPlayerId: 'a', secondPlayerId: 'b' };
    expect(computeRoundScore(round, result, game.settings, game.players)).toMatchObject({ a: -125, b: -50, c: 0 }); expect(chooserSucceeded(round, result)).toBe(true);
  });
  it('calcule les cœurs et refuse un total incorrect', () => {
    const round = makeRound('C'); const valid: RoundResult = { heartsByPlayer: { a: 0, b: 2, c: 2, d: 3, e: 3 } };
    expect(validateRoundResult(round, valid, game)).toEqual([]); expect(computeRoundScore(round, valid, game.settings, game.players).a).toBe(-25);
    expect(validateRoundResult(round, { heartsByPlayer: { a: 0, b: 1, c: 1, d: 1, e: 1 } }, game)[0]).toMatch(/doit être 10/);
  });
  it('calcule dames, roi, plis et dernier pli du Tafaron', () => {
    const round = makeRound('T'); const result: RoundResult = { heartsByPlayer: { a: 0, b: 10, c: 0, d: 0, e: 0 }, queensByPlayer: { a: 0, b: 4, c: 0, d: 0, e: 0 }, tricksByPlayer: { a: 0, b: 8, c: 0, d: 0, e: 0 }, kingOfHeartsPlayerId: 'b', lastTrickPlayerId: 'b' };
    expect(validateRoundResult(round, result, game)).toEqual([]); expect(computeRoundScore(round, result, game.settings, game.players)).toMatchObject({ a: -25, b: 920 });
  });
  it('applique au Joker la règle du contrat imité sans le consommer', () => {
    const round = makeRound('J', 'K'); const result = { kingOfHeartsPlayerId: 'b' };
    expect(computeRoundScore(round, result, game.settings, game.players)).toMatchObject({ a: -25, b: 100 });
  });
  it('recalcule les cumuls depuis les deltas validés', () => {
    const one = { ...makeRound('R'), status: 'validated' as const, scoreDelta: { a: -125, b: -50 } };
    const two = { ...makeRound('K'), id: 'two', status: 'validated' as const, scoreDelta: { b: 100 } };
    expect(recomputeGameScores([one, two], game.players)).toMatchObject({ a: -125, b: 50, c: 0 });
  });
});
