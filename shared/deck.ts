import { RANKS, type DeckSettings, type RankLabel } from './types.js';

export function computeSuccessStartRank(keptRanks: readonly RankLabel[]) {
  if (!keptRanks.length) throw new Error('Aucun rang conservé.');
  const index = Math.floor(keptRanks.length / 2);
  return { successStartRank: keptRanks[index], successStartRankPosition: index + 1 };
}

export function computeDeckDistribution(playerCount: number, customRanks?: number): DeckSettings {
  if (!Number.isInteger(playerCount) || playerCount < 3 || playerCount > 10) {
    throw new Error('Le nombre de joueurs doit être compris entre 3 et 10.');
  }
  const candidates = customRanks == null
    ? Array.from({ length: RANKS.length }, (_, index) => RANKS.length - index)
    : [customRanks];
  for (const ranksPerSuit of candidates) {
    if (!Number.isInteger(ranksPerSuit) || ranksPerSuit < 1 || ranksPerSuit > RANKS.length) continue;
    const cardsUsed = ranksPerSuit * 4;
    if (cardsUsed % playerCount !== 0) continue;
    const keptRanks = RANKS.slice(0, ranksPerSuit) as RankLabel[];
    return {
      mode: customRanks == null ? 'tarot_suits_auto' : 'custom_ranks_per_suit',
      suitsCount: 4,
      ranksPerSuit,
      keptRanks,
      cardsUsed,
      cardsPerPlayer: cardsUsed / playerCount,
      heartsInPlay: ranksPerSuit,
      queensInPlay: keptRanks.includes('Dame') ? 4 : 0,
      keepInstruction: `Garder de l'As au ${keptRanks.at(-1)}`,
      ...computeSuccessStartRank(keptRanks),
    };
  }
  const count = customRanks == null ? '' : `, ${customRanks} rangs par couleur donnent ${customRanks * 4} cartes`;
  throw new Error(`Distribution impossible pour ${playerCount} joueurs${count}.`);
}

export function getValidDeckDistributions(playerCount: number): DeckSettings[] {
  const options: DeckSettings[] = [];
  for (let ranks = 1; ranks <= RANKS.length; ranks++) {
    try { options.push(computeDeckDistribution(playerCount, ranks)); } catch { /* option non divisible */ }
  }
  return options.sort((a, b) => b.ranksPerSuit - a.ranksPerSuit);
}
