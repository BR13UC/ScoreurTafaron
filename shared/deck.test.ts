import { describe, expect, it } from 'vitest';
import { computeDeckDistribution, computeSuccessStartRank, getValidDeckDistributions } from './deck.js';

describe('distribution des cartes', () => {
  const expected = { 3: [12, 16, '4'], 4: [14, 14, '2'], 5: [10, 8, '6'], 6: [12, 8, '4'], 7: [14, 8, '2'], 8: [14, 7, '2'], 9: [9, 4, '7'], 10: [10, 4, '6'] } as const;
  for (const [players, [ranks, cards, last]] of Object.entries(expected)) {
    it(`calcule la distribution pour ${players} joueurs`, () => {
      const result = computeDeckDistribution(Number(players));
      expect(result.ranksPerSuit).toBe(ranks); expect(result.cardsPerPlayer).toBe(cards); expect(result.keepInstruction).toBe(`Garder de l'As au ${last}`);
    });
  }
  it('rejette une distribution personnalisée non divisible', () => expect(() => computeDeckDistribution(5, 9)).toThrow(/impossible/i));
  it('prend le milieu côté petites cartes', () => expect(computeSuccessStartRank(['As', 'Roi', 'Dame', 'Cavalier', 'Valet', '10'])).toEqual({ successStartRank: 'Cavalier', successStartRankPosition: 4 }));
  it('liste uniquement les distributions valides pour chaque nombre de joueurs', () => {
    for (let players = 3; players <= 10; players += 1) {
      const options = getValidDeckDistributions(players);
      expect(options.length).toBeGreaterThan(0);
      expect(options.every((option) => option.cardsUsed % players === 0 && option.cardsPerPlayer > 0)).toBe(true);
    }
  });
});
