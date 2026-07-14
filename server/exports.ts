import type { Game } from '../shared/types.js';
import { recomputeGameScores } from '../shared/scoring.js';

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const row = (values: unknown[]) => values.map(csvCell).join(';');

export function publicGameExport(game: Game) {
  return {
    ...game,
    players: game.players.map(({ tokenHash: _tokenHash, ...player }) => player),
  };
}

export function roundsCsv(game: Game): string {
  const headers = ['manche', 'index', 'choisisseur', 'contrat', 'contratJoker', 'joueur', 'delta', 'scoreCumule', 'bonusApplique', 'corrigeLe'];
  const totals = Object.fromEntries(game.players.map((player) => [player.id, 0]));
  const lines = [row(headers)];
  for (const round of game.rounds.filter((item) => item.status === 'validated')) {
    for (const player of game.players) {
      const delta = round.scoreDelta[player.id] ?? 0;
      totals[player.id] += delta;
      lines.push(row([round.id, round.index, game.players.find((p) => p.id === round.chooserPlayerId)?.name, round.contract, round.jokerContract, player.name, delta, totals[player.id], round.bonusApplied && player.id === round.chooserPlayerId ? 'oui' : 'non', round.correctedAt]));
    }
  }
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

export function scoresCsv(game: Game): string {
  const totals = recomputeGameScores(game.rounds, game.players);
  const ordered = [...game.players].sort((a, b) => totals[a.id] - totals[b.id]);
  const lines = [row(['rang', 'joueur', 'scoreTotal', 'nombreBonus'])];
  ordered.forEach((player, index) => {
    const bonusCount = game.rounds.filter((round) => round.status === 'validated' && round.chooserPlayerId === player.id && round.bonusApplied).length;
    lines.push(row([index + 1, player.name, totals[player.id], bonusCount]));
  });
  return `\ufeff${lines.join('\r\n')}\r\n`;
}
