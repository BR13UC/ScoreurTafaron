import type { ContractCode, EffectiveContractCode, Game } from './types.js';
import type { ContractMetric, ContractStatsRow, PlayerGameStat, PlayerProfileData, PlayerStatsDetail, PlayerStatsSummary, StatsFilter } from './stats-types.js';
import { resolveProfile } from './player-identity.js';

export function gameCompletionTime(game: Game): string {
  const validated = game.rounds.filter((round) => round.status === 'validated' && round.validatedAt).map((round) => round.validatedAt!).sort();
  return validated.at(-1) ?? game.updatedAt;
}

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Une date de partie est invalide.');
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateStatsFilter(filter: StatsFilter, allowLast10: boolean): StatsFilter {
  if (!['all', 'year', 'custom', ...(allowLast10 ? ['last10'] : [])].includes(filter.preset)) throw new Error('Filtre de statistiques invalide.');
  if (filter.preset === 'custom') {
    if (!validCalendarDate(filter.from) || !validCalendarDate(filter.to) || filter.from! > filter.to!) throw new Error('La période personnalisée est invalide.');
  }
  return filter;
}

function validCalendarDate(value?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const [year, month, day] = value!.split('-').map(Number); const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function filteredGames(games: Game[], filter: StatsFilter, now = new Date()): Game[] {
  const qualifying = games.filter((game) => game.finishedReason === 'complete');
  if (filter.preset === 'all' || filter.preset === 'last10') return qualifying;
  if (filter.preset === 'year') return qualifying.filter((game) => new Date(gameCompletionTime(game)).getFullYear() === now.getFullYear());
  return qualifying.filter((game) => { const key = dateKey(gameCompletionTime(game)); return key >= filter.from! && key <= filter.to!; });
}

function scoresAndPlacements(game: Game) {
  const scores = Object.fromEntries(game.players.map((player) => [player.id, 0])) as Record<string, number>;
  for (const round of game.rounds.filter((item) => item.status === 'validated')) for (const player of game.players) scores[player.id] += round.scoreDelta[player.id] ?? 0;
  const placements = Object.fromEntries(game.players.map((player) => [player.id, Object.values(scores).filter((score) => score < scores[player.id]).length + 1])) as Record<string, number>;
  return { scores, placements };
}

function roundNumber(value: number) { return Math.round(value * 100) / 100; }
function average(values: number[]) { return values.length ? roundNumber(values.reduce((sum, value) => sum + value, 0) / values.length) : null; }

function gamesForProfile(games: Game[], data: PlayerProfileData, profileId: string, filter: StatsFilter, now?: Date): PlayerGameStat[] {
  let rows = filteredGames(games, filter, now).flatMap((game) => {
    const player = game.players.find((candidate) => resolveProfile(data, game.id, candidate.id, candidate.name)?.id === profileId);
    if (!player) return [];
    const { scores, placements } = scoresAndPlacements(game);
    return [{ gameId: game.id, gameName: game.name, completedAt: gameCompletionTime(game), sourcePlayerId: player.id, sourceName: player.name, placement: placements[player.id], finalScore: scores[player.id], playerCount: game.players.length, participants: game.players.map((item) => item.name), enabledContracts: game.settings.enabledContracts, scoring: game.settings.scoring } satisfies PlayerGameStat];
  }).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  if (filter.preset === 'last10') rows = rows.slice(-10);
  return rows;
}

function summary(profile: PlayerProfileData['profiles'][number], games: PlayerGameStat[]): PlayerStatsSummary {
  const wins = games.filter((game) => game.placement === 1).length; const podiums = games.filter((game) => game.placement <= 3).length;
  const scores = games.map((game) => game.finalScore);
  return { profileId: profile.id, displayName: profile.displayName, aliases: profile.aliases, active: games.length > 0, gamesPlayed: games.length, wins, winRate: games.length ? roundNumber(wins / games.length * 100) : 0, podiums, podiumRate: games.length ? roundNumber(podiums / games.length * 100) : 0, averagePlacement: average(games.map((game) => game.placement)), averageScore: average(scores), bestScore: scores.length ? Math.min(...scores) : null, worstScore: scores.length ? Math.max(...scores) : null };
}

const emptyMetric = (): ContractMetric => ({ rounds: 0, successes: 0, successRate: null, bonuses: 0, totalDelta: 0, averageDelta: null });

function contractRows(games: Game[], data: PlayerProfileData, profileId: string, includedGameIds: Set<string>): ContractStatsRow[] {
  const rows = new Map<ContractCode, ContractStatsRow>();
  const rowFor = (contract: ContractCode) => { let row = rows.get(contract); if (!row) { row = { contract, chooser: emptyMetric(), allRound: emptyMetric(), ...(contract === 'J' ? { jokerBreakdown: {} } : {}) }; rows.set(contract, row); } return row; };
  for (const game of games.filter((item) => includedGameIds.has(item.id))) {
    const player = game.players.find((candidate) => resolveProfile(data, game.id, candidate.id, candidate.name)?.id === profileId); if (!player) continue;
    for (const round of game.rounds.filter((item) => item.status === 'validated' && item.contract)) {
      const row = rowFor(round.contract!); const delta = round.scoreDelta[player.id] ?? 0;
      row.allRound.rounds++; row.allRound.totalDelta += delta;
      if (round.chooserPlayerId === player.id) { row.chooser.rounds++; row.chooser.totalDelta += delta; if (round.chooserSucceeded) row.chooser.successes++; if (round.bonusApplied) row.chooser.bonuses++; }
      if (round.contract === 'J' && round.jokerContract) {
        const key = round.jokerContract as EffectiveContractCode; const current = row.jokerBreakdown![key] ?? { rounds: 0, chooserRounds: 0, totalDelta: 0 };
        current.rounds++; current.totalDelta += delta; if (round.chooserPlayerId === player.id) current.chooserRounds++; row.jokerBreakdown![key] = current;
      }
    }
  }
  for (const row of rows.values()) for (const metric of [row.chooser, row.allRound]) { metric.averageDelta = metric.rounds ? roundNumber(metric.totalDelta / metric.rounds) : null; metric.successRate = metric.rounds ? roundNumber(metric.successes / metric.rounds * 100) : null; }
  return [...rows.values()].sort((a, b) => a.contract.localeCompare(b.contract));
}

export function playerLeaderboard(games: Game[], data: PlayerProfileData, filter: StatsFilter, now?: Date): PlayerStatsSummary[] {
  validateStatsFilter(filter, false);
  return data.profiles.map((profile) => summary(profile, gamesForProfile(games, data, profile.id, filter, now))).filter((item) => item.active).sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || (a.averagePlacement ?? Infinity) - (b.averagePlacement ?? Infinity) || a.displayName.localeCompare(b.displayName, 'fr'));
}

export function playerStatsDetail(games: Game[], data: PlayerProfileData, profileId: string, filter: StatsFilter, now?: Date): PlayerStatsDetail {
  validateStatsFilter(filter, true); const profile = data.profiles.find((item) => item.id === profileId); if (!profile) throw new Error('Profil joueur introuvable.');
  const profileGames = gamesForProfile(games, data, profileId, filter, now);
  return { summary: summary(profile, profileGames), games: profileGames, contracts: contractRows(games, data, profileId, new Set(profileGames.map((game) => game.gameId))) };
}
