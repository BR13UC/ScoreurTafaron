import type { EffectiveContractCode, Game, GameSettings, Player, Round, RoundResult, ScoreMap } from './types.js';

export function effectiveContract(round: Round): EffectiveContractCode {
  if (round.contract === 'J') {
    if (!round.jokerContract) throw new Error('Le Joker doit imiter un contrat.');
    return round.jokerContract;
  }
  if (!round.contract) throw new Error('Aucun contrat choisi.');
  return round.contract;
}

const value = (map: Record<string, number> | undefined, id: string) => map?.[id] ?? 0;

export function validateRoundResult(round: Round, result: RoundResult, game: Game): string[] {
  const contract = effectiveContract(round);
  const errors: string[] = [];
  const ids = new Set(game.players.map((player) => player.id));
  const validateTotal = (label: string, values: Record<string, number> | undefined, expected: number) => {
    if (!values || game.players.some((player) => !Number.isInteger(values[player.id]) || values[player.id] < 0)) {
      errors.push(`La saisie des ${label} est incomplète ou invalide.`);
      return;
    }
    const entered = game.players.reduce((sum, player) => sum + values[player.id], 0);
    if (entered !== expected) errors.push(`Le total des ${label} doit être ${expected}, mais vaut ${entered}.`);
  };
  if (contract === 'R') {
    if (!result.firstPlayerId || !result.secondPlayerId || !ids.has(result.firstPlayerId) || !ids.has(result.secondPlayerId)) errors.push('Les premier et deuxième joueurs doivent être renseignés.');
    else if (result.firstPlayerId === result.secondPlayerId) errors.push('Le premier et le deuxième doivent être différents.');
  }
  if (contract === 'C' || contract === 'T') validateTotal('cœurs', result.heartsByPlayer, game.settings.deck.heartsInPlay);
  if (contract === 'D' || contract === 'T') validateTotal('dames', result.queensByPlayer, game.settings.deck.queensInPlay);
  if (contract === 'P' || contract === 'T') validateTotal('plis', result.tricksByPlayer, game.settings.deck.cardsPerPlayer);
  if ((contract === 'K' || contract === 'T') && (!result.kingOfHeartsPlayerId || !ids.has(result.kingOfHeartsPlayerId))) errors.push('Le roi de cœur doit être attribué à un joueur.');
  if ((contract === 'L' || contract === 'T') && (!result.lastTrickPlayerId || !ids.has(result.lastTrickPlayerId))) errors.push('Le dernier pli doit être attribué à un joueur.');
  return errors;
}

export function chooserSucceeded(round: Round, result: RoundResult): boolean {
  const id = round.chooserPlayerId;
  switch (effectiveContract(round)) {
    case 'R': return result.firstPlayerId === id;
    case 'C': return value(result.heartsByPlayer, id) === 0;
    case 'D': return value(result.queensByPlayer, id) === 0;
    case 'K': return result.kingOfHeartsPlayerId !== id;
    case 'P': return value(result.tricksByPlayer, id) === 0;
    case 'L': return result.lastTrickPlayerId !== id;
    case 'T': return value(result.heartsByPlayer, id) === 0 && value(result.queensByPlayer, id) === 0 && value(result.tricksByPlayer, id) === 0 && result.kingOfHeartsPlayerId !== id && result.lastTrickPlayerId !== id;
  }
}

export function computeRoundScore(round: Round, result: RoundResult, settings: GameSettings, players: Player[]): ScoreMap {
  const score = Object.fromEntries(players.map((player) => [player.id, 0]));
  const contract = effectiveContract(round);
  for (const player of players) {
    if (contract === 'C' || contract === 'T') score[player.id] += value(result.heartsByPlayer, player.id) * settings.scoring.heart;
    if (contract === 'D' || contract === 'T') score[player.id] += value(result.queensByPlayer, player.id) * settings.scoring.queen;
    if (contract === 'P' || contract === 'T') score[player.id] += value(result.tricksByPlayer, player.id) * settings.scoring.trick;
  }
  if (contract === 'R') {
    if (result.firstPlayerId) score[result.firstPlayerId] += settings.scoring.successFirst;
    if (result.secondPlayerId) score[result.secondPlayerId] += settings.scoring.successSecond;
  }
  if ((contract === 'K' || contract === 'T') && result.kingOfHeartsPlayerId) score[result.kingOfHeartsPlayerId] += settings.scoring.kingOfHearts;
  if ((contract === 'L' || contract === 'T') && result.lastTrickPlayerId) score[result.lastTrickPlayerId] += settings.scoring.lastTrick;
  if (chooserSucceeded(round, result)) score[round.chooserPlayerId] += settings.scoring.bonus;
  return score;
}

export function recomputeGameScores(rounds: Round[], players: Player[]): ScoreMap {
  const totals = Object.fromEntries(players.map((player) => [player.id, 0]));
  for (const round of rounds.filter((item) => item.status === 'validated')) {
    for (const [playerId, delta] of Object.entries(round.scoreDelta)) totals[playerId] = (totals[playerId] ?? 0) + delta;
  }
  return totals;
}
