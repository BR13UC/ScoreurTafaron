import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { availableContracts, createGame, createNextRound, ensureUniqueName } from '../shared/game.js';
import { computeDeckDistribution } from '../shared/deck.js';
import { chooserSucceeded, completeRoundResult, computeRoundScore, effectiveContract, recomputeGameScores, validateRoundResult } from '../shared/scoring.js';
import type { ContractCode, EffectiveContractCode, Game, GameSnapshot, JoinContext, PlayerSubmission, PlayerView, RecoveryAdminRequest, RecoveryRequestCreated, RecoveryRequestState, RecoveryRequestStatus, Round, RoundResult, ScoringSettings, SetupStep } from '../shared/types.js';
import { GameStorage } from './storage.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const now = () => new Date().toISOString();

interface RecoveryRequest {
  id: string;
  gameId: string;
  playerId: string;
  secretHash: string;
  state: RecoveryRequestState | 'claimed';
  createdAt: string;
  expiresAt: string;
}

export class GameManager extends EventEmitter {
  private games = new Map<string, Game>();
  private countdowns = new Map<string, NodeJS.Timeout>();
  private recoveryRequests = new Map<string, RecoveryRequest>();

  constructor(private readonly storage = new GameStorage()) { super(); }

  async init() {
    for (const game of await this.storage.list()) {
      game.settings.setupStep ??= game.status === 'playing' || game.status === 'finished' ? 'ready' : 'settings';
      for (const round of game.rounds) {
        for (const submission of Object.values(round.submissions ?? {})) {
          submission.updatedAt ??= submission.submittedAt;
          submission.source ??= 'player';
          submission.revision ??= 1;
        }
      }
      this.games.set(game.id, game);
      const round = this.currentRound(game);
      if (round?.status === 'countdown' && round.result) this.scheduleCountdown(game, round);
      else if (round?.status === 'countdown') round.status = 'scoring';
    }
  }
  list() { return [...this.games.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  get(id: string) { const game = this.games.get(id); if (!game) throw new Error('Partie introuvable.'); return game; }
  active() { return this.list().find((game) => game.status !== 'archived'); }

  snapshot(game: Game): GameSnapshot {
    const validated = game.rounds.filter((round) => round.status === 'validated').length;
    const playerTotal = ['setup', 'waiting_players'].includes(game.status) ? game.settings.playerCount : game.players.length;
    const totalRounds = playerTotal * game.settings.enabledContracts.length;
    const activeRound = this.currentRound(game);
    const currentRoundNumber = game.status === 'playing'
      ? activeRound?.index ?? validated
      : game.status === 'finished' && game.finishedReason === 'complete' ? totalRounds : validated;
    return { game, scores: recomputeGameScores(game.rounds, game.players), remainingRounds: Math.max(0, totalRounds - validated), currentRoundNumber, totalRounds };
  }

  joinContext(gameId: string): JoinContext {
    const game = this.get(gameId);
    if (['setup', 'waiting_players'].includes(game.status)) return { mode: 'join', gameName: game.name, players: [] };
    if (game.status === 'playing') return { mode: 'recover', gameName: game.name, players: game.players.map(({ id, name }) => ({ id, name })) };
    return { mode: 'closed', gameName: game.name, players: [] };
  }

  createRecoveryRequest(gameId: string, playerId: string): RecoveryRequestCreated {
    const game = this.get(gameId);
    if (game.status !== 'playing') throw new Error('La récupération est disponible uniquement pendant une partie en cours.');
    this.player(game, playerId); this.expireRecoveryRequests();
    if ([...this.recoveryRequests.values()].some((request) => request.gameId === gameId && request.playerId === playerId && ['pending', 'approved'].includes(request.state))) {
      throw new Error('Une demande de récupération est déjà active pour ce joueur.');
    }
    const secret = randomBytes(32).toString('base64url'); const createdAt = now(); const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString(); const id = randomUUID();
    this.recoveryRequests.set(id, { id, gameId, playerId, secretHash: hashToken(secret), state: 'pending', createdAt, expiresAt });
    this.emit('recovery-changed', gameId);
    return { requestId: id, secret, expiresAt };
  }

  recoveryStatus(gameId: string, requestId: string, secret: string): RecoveryRequestStatus {
    const request = this.requireRecoveryRequest(gameId, requestId, secret); this.expireRecoveryRequest(request);
    if (request.state === 'claimed') throw new Error('Cette demande de récupération a déjà été utilisée.');
    return { requestId: request.id, state: request.state, playerName: this.player(this.get(gameId), request.playerId).name, expiresAt: request.expiresAt };
  }

  listRecoveryRequests(gameId: string): RecoveryAdminRequest[] {
    const game = this.get(gameId); this.expireRecoveryRequests();
    return [...this.recoveryRequests.values()].filter((request) => request.gameId === gameId && (request.state === 'pending' || request.state === 'approved')).map((request) => ({ requestId: request.id, playerId: request.playerId, playerName: this.player(game, request.playerId).name, state: request.state as 'pending' | 'approved', createdAt: request.createdAt, expiresAt: request.expiresAt }));
  }

  decideRecoveryRequest(gameId: string, requestId: string, decision: 'approved' | 'rejected') {
    const game = this.get(gameId); if (game.status !== 'playing') throw new Error('La partie n’est pas en cours.');
    const request = this.recoveryRequests.get(requestId); if (!request || request.gameId !== gameId) throw new Error('Demande de récupération introuvable.');
    this.expireRecoveryRequest(request); if (request.state !== 'pending') throw new Error('Cette demande de récupération n’est plus en attente.');
    request.state = decision; this.emit('recovery-changed', gameId);
  }

  async claimRecoveryRequest(gameId: string, requestId: string, secret: string) {
    const game = this.get(gameId); if (game.status !== 'playing') throw new Error('La partie n’est pas en cours.');
    const request = this.requireRecoveryRequest(gameId, requestId, secret); this.expireRecoveryRequest(request);
    if (request.state !== 'approved') throw new Error(request.state === 'claimed' ? 'Cette demande de récupération a déjà été utilisée.' : 'Cette demande n’a pas été approuvée.');
    const player = this.player(game, request.playerId); const token = randomBytes(32).toString('base64url');
    player.tokenHash = hashToken(token); player.kind = 'phone'; player.connected = false; request.state = 'claimed';
    await this.changed(game); this.emit('player-recovered', { gameId, playerId: player.id }); this.emit('recovery-changed', gameId);
    return { token };
  }

  private async changed(game: Game) {
    game.updatedAt = now();
    await this.storage.save(game);
    this.emit('changed', game.id);
    return this.snapshot(game);
  }

  async create(name?: string, playerCount = 5) {
    const active = this.active();
    if (active) { active.statusBeforeArchive = active.status as Exclude<Game['status'], 'archived'>; active.status = 'archived'; active.archivedAt = now(); await this.changed(active); }
    const game = createGame(name, playerCount);
    this.games.set(game.id, game);
    return this.changed(game);
  }

  async activate(id: string) {
    const target = this.get(id);
    const active = this.active();
    if (active && active.id !== id) { active.statusBeforeArchive = active.status as Exclude<Game['status'], 'archived'>; active.status = 'archived'; active.archivedAt = now(); await this.changed(active); }
    if (target.status === 'archived') target.status = target.statusBeforeArchive ?? 'waiting_players';
    if (target.status === 'finished' && target.finishedReason === 'early') target.status = 'playing';
    target.archivedAt = undefined;
    return this.changed(target);
  }

  async addLocalPlayer(gameId: string, name: string) {
    const game = this.get(gameId); this.requireLobby(game);
    if (game.players.length >= game.settings.playerCount) throw new Error('Le nombre de joueurs attendu est déjà atteint.');
    const player = { id: randomUUID(), name: ensureUniqueName(game.players, name), joinedAt: now(), connected: true, kind: 'local' as const };
    game.players.push(player); game.settings.turnOrder.push(player.id); await this.changed(game); return player;
  }

  async join(gameId: string, name: string) {
    const game = this.get(gameId); this.requireLobby(game);
    if (game.players.length >= game.settings.playerCount) throw new Error('La partie est complète.');
    const token = randomBytes(32).toString('base64url');
    const player = { id: randomUUID(), name: ensureUniqueName(game.players, name), joinedAt: now(), connected: true, kind: 'phone' as const, tokenHash: hashToken(token) };
    game.players.push(player); game.settings.turnOrder.push(player.id); await this.changed(game); return { player, token };
  }

  authenticate(gameId: string, token: string) {
    const game = this.get(gameId); const tokenHash = hashToken(token);
    const player = game.players.find((item) => item.tokenHash === tokenHash);
    if (!player) throw new Error('Session joueur invalide.');
    return { game, player };
  }

  async setConnected(gameId: string, token: string, connected: boolean) {
    const { game, player } = this.authenticate(gameId, token); player.connected = connected; await this.changed(game);
  }

  async renamePlayer(gameId: string, playerId: string, name: string) {
    const game = this.get(gameId); this.requireLobby(game); const player = this.player(game, playerId);
    player.name = ensureUniqueName(game.players, name, playerId); await this.changed(game);
  }

  async removePlayer(gameId: string, playerId: string) {
    const game = this.get(gameId); this.requireLobby(game); this.player(game, playerId);
    game.players = game.players.filter((item) => item.id !== playerId); game.settings.turnOrder = game.settings.turnOrder.filter((id) => id !== playerId); await this.changed(game);
  }

  async updateSettings(gameId: string, input: { playerCount?: number; enabledContracts?: ContractCode[]; customRanks?: number | null; scoring?: Partial<ScoringSettings>; resultEntryMode?: 'organizer' | 'players'; selectedAddress?: string }) {
    const game = this.get(gameId);
    const current = this.currentRound(game);
    if (game.status === 'playing' && current?.status !== 'choosing') throw new Error('Les paramètres ne peuvent changer qu’entre deux manches.');
    if (input.playerCount !== undefined) {
      this.requireLobby(game); if (input.playerCount < game.players.length) throw new Error('Retirez des joueurs avant de réduire le nombre attendu.');
      game.settings.playerCount = input.playerCount;
    }
    if (input.enabledContracts) { this.requireLobby(game); if (!input.enabledContracts.length) throw new Error('Activez au moins un contrat.'); game.settings.enabledContracts = [...new Set(input.enabledContracts)]; }
    if (input.playerCount !== undefined || input.customRanks !== undefined) game.settings.deck = computeDeckDistribution(game.settings.playerCount, input.customRanks ?? undefined);
    if (input.scoring) {
      for (const value of Object.values(input.scoring)) if (!Number.isInteger(value)) throw new Error('Les points doivent être des nombres entiers.');
      game.settings.scoring = { ...game.settings.scoring, ...input.scoring };
      for (const round of game.rounds.filter((item) => item.status === 'validated' && item.result)) {
        round.scoreDelta = computeRoundScore(round, round.result!, game.settings, game.players);
        round.chooserSucceeded = chooserSucceeded(round, round.result!); round.bonusApplied = round.chooserSucceeded;
      }
    }
    if (input.resultEntryMode) game.settings.resultEntryMode = input.resultEntryMode;
    if (input.selectedAddress !== undefined) game.settings.selectedAddress = input.selectedAddress;
    await this.changed(game);
  }

  async setSetupStep(gameId: string, step: SetupStep) {
    const game = this.get(gameId);
    this.requireLobby(game);
    if (!['settings', 'cards', 'ready'].includes(step)) throw new Error('Étape de configuration inconnue.');
    if (step === 'cards' && (game.players.length !== game.settings.playerCount || !game.settings.enabledContracts.length)) {
      throw new Error('Complétez le nombre de joueurs et sélectionnez au moins un contrat avant de continuer.');
    }
    if (step === 'ready' && (game.players.length !== game.settings.playerCount || !game.settings.enabledContracts.length)) {
      throw new Error('La configuration de la partie est incomplète.');
    }
    game.settings.setupStep = step;
    await this.changed(game);
  }

  async reorder(gameId: string, order: string[]) {
    const game = this.get(gameId); this.requireLobby(game);
    if (order.length !== game.players.length || new Set(order).size !== order.length || order.some((id) => !game.players.some((p) => p.id === id))) throw new Error('Ordre de joueurs invalide.');
    game.settings.turnOrder = order; await this.changed(game);
  }

  async start(gameId: string) {
    const game = this.get(gameId); this.requireLobby(game);
    if (game.settings.setupStep !== 'ready') throw new Error('Validez la distribution des cartes avant de lancer la partie.');
    if (game.players.length !== game.settings.playerCount) throw new Error(`Il faut exactement ${game.settings.playerCount} joueurs.`);
    if (game.settings.turnOrder.length !== game.players.length) throw new Error('Définissez l’ordre des joueurs.');
    game.status = 'playing'; const round = createNextRound(game); if (round) game.rounds.push(round); await this.changed(game);
  }

  async selectContract(gameId: string, playerId: string, contract: ContractCode, jokerContract?: EffectiveContractCode) {
    const game = this.get(gameId); const round = this.requireCurrent(game, 'choosing');
    if (round.chooserPlayerId !== playerId) throw new Error('Seul le joueur actif peut choisir le contrat.');
    if (!availableContracts(game, playerId).includes(contract)) throw new Error('Ce contrat a déjà été utilisé ou n’est pas actif.');
    if (contract === 'J') {
      if (!jokerContract || jokerContract === ('J' as EffectiveContractCode) || !game.settings.enabledContracts.includes(jokerContract)) throw new Error('Le contrat imité par le Joker est invalide.');
      round.jokerContract = jokerContract;
    }
    round.contract = contract; round.status = 'in_progress'; await this.changed(game);
  }

  async beginScoring(gameId: string) { const game = this.get(gameId); const round = this.requireCurrent(game, 'in_progress'); round.status = 'scoring'; await this.changed(game); }

  async beginScoringByPlayer(gameId: string, playerId: string) {
    const game = this.get(gameId); const round = this.requireCurrent(game, 'in_progress');
    if (round.chooserPlayerId !== playerId) throw new Error('Seul le joueur qui a choisi le contrat peut lancer le calcul.');
    round.status = 'scoring'; await this.changed(game);
  }

  async returnToContractChoice(gameId: string, playerId: string) {
    const game = this.get(gameId); const round = this.requireCurrent(game, 'in_progress');
    if (round.chooserPlayerId !== playerId) throw new Error('Seul le joueur actif peut revenir au choix.');
    round.contract = undefined; round.jokerContract = undefined; round.status = 'choosing'; await this.changed(game);
  }

  async submitPlayer(gameId: string, playerId: string, values: PlayerSubmission['values'], source: 'player' | 'admin' = 'player') {
    const game = this.get(gameId); const round = this.currentRound(game);
    if (!round || !round.contract || !['scoring', 'countdown'].includes(round.status)) throw new Error('La manche n’est plus ouverte à la saisie.');
    this.player(game, playerId);
    this.clearCountdown(round.id);
    round.countdownEndsAt = undefined;
    const previous = round.submissions[playerId];
    round.submissions[playerId] = { playerId, values, submittedAt: previous?.submittedAt ?? now(), updatedAt: now(), source, revision: (previous?.revision ?? 0) + 1 };
    round.status = 'scoring';
    this.refreshRoundFromSubmissions(game, round);
    await this.changed(game);
  }

  async updateSubmissionField(gameId: string, playerId: string, field: keyof PlayerSubmission['values'], value: unknown) {
    const game = this.get(gameId); const round = this.currentRound(game);
    if (!round || !round.contract || !['scoring', 'countdown'].includes(round.status)) throw new Error('La manche n’est plus ouverte à la saisie.');
    const player = this.player(game, playerId);
    if (!['rank', 'hearts', 'queens', 'tricks', 'kingOfHearts', 'lastTrick'].includes(field)) throw new Error('Champ de saisie inconnu.');
    if (['hearts', 'queens', 'tricks'].includes(field) && (!Number.isInteger(value) || Number(value) < 0)) throw new Error('La valeur doit être un entier positif ou nul.');
    if (field === 'rank' && !['first', 'second', 'other'].includes(String(value))) throw new Error('Rang de réussite invalide.');
    if (['kingOfHearts', 'lastTrick'].includes(field) && typeof value !== 'boolean') throw new Error('La valeur doit être vraie ou fausse.');
    const previous = round.submissions[playerId];
    const values = { ...(previous?.values ?? {}), [field]: value } as PlayerSubmission['values'];
    await this.submitPlayer(gameId, player.id, values, 'admin');
  }

  async setFullResult(gameId: string, result: RoundResult, autoCountdown = false) {
    const game = this.get(gameId); const round = this.currentRound(game); if (!round || !round.contract || !['scoring', 'countdown'].includes(round.status)) throw new Error('La manche n’est pas en saisie.');
    this.clearCountdown(round.id); round.countdownEndsAt = undefined; result = completeRoundResult(round, result, game); const errors = validateRoundResult(round, result, game); round.validationErrors = errors; round.result = result;
    if (errors.length) round.status = 'scoring'; else if (autoCountdown) { round.status = 'countdown'; round.countdownEndsAt = new Date(Date.now() + 5000).toISOString(); this.scheduleCountdown(game, round); }
    await this.changed(game); return errors;
  }

  async cancelCountdown(gameId: string) { const game = this.get(gameId); const round = this.requireCurrent(game, 'countdown'); this.clearCountdown(round.id); round.status = 'scoring'; round.countdownEndsAt = undefined; await this.changed(game); }

  async archive(gameId: string) {
    const game = this.get(gameId);
    if (game.status !== 'finished') throw new Error('Seule une partie terminée peut revenir à l’accueil.');
    game.statusBeforeArchive = 'finished'; game.status = 'archived'; game.archivedAt = now(); await this.changed(game);
  }

  async deleteGame(gameId: string) {
    const game = this.get(gameId);
    if (game.status !== 'archived') throw new Error('Archivez cette partie avant de la supprimer.');
    this.games.delete(gameId); await this.storage.remove(gameId);
  }

  async validateCurrent(gameId: string) { const game = this.get(gameId); const round = this.currentRound(game); if (!round || !round.result || !['scoring', 'countdown'].includes(round.status)) throw new Error('Aucun résultat à valider.'); await this.finalize(game, round); }

  async correct(gameId: string, roundId: string, result: RoundResult) {
    const game = this.get(gameId); const round = game.rounds.find((item) => item.id === roundId && item.status === 'validated'); if (!round) throw new Error('Manche validée introuvable.');
    result = completeRoundResult(round, result, game);
    const errors = validateRoundResult(round, result, game); if (errors.length) throw new Error(errors.join(' '));
    round.result = result; round.scoreDelta = computeRoundScore(round, result, game.settings, game.players); round.chooserSucceeded = chooserSucceeded(round, result); round.bonusApplied = round.chooserSucceeded; round.correctedAt = now(); await this.changed(game);
  }

  async undoLast(gameId: string) {
    const game = this.get(gameId); let index = -1; for (let cursor = game.rounds.length - 1; cursor >= 0; cursor--) { if (game.rounds[cursor].status === 'validated') { index = cursor; break; } } if (index < 0) throw new Error('Aucune manche validée à annuler.');
    game.rounds.splice(index); game.status = 'playing'; game.finishedReason = undefined; const next = createNextRound(game); if (next) game.rounds.push(next); await this.changed(game);
  }

  async finish(gameId: string) { const game = this.get(gameId); if (game.status !== 'playing') throw new Error('Cette partie n’est pas en cours.'); const round = this.currentRound(game); if (round) { this.clearCountdown(round.id); round.countdownEndsAt = undefined; if (round.status === 'countdown') round.status = 'scoring'; } game.status = 'finished'; game.finishedReason = 'early'; await this.changed(game); }

  playerView(gameId: string, token: string): PlayerView {
    const { game, player } = this.authenticate(gameId, token); const round = this.currentRound(game); const chooser = round ? this.player(game, round.chooserPlayerId) : undefined;
    let message = game.status === 'finished' ? 'Partie terminée. Regarde l’écran principal.' : 'En attente de la configuration.';
    if (game.status === 'playing' && round) message = round.chooserPlayerId === player.id && round.status === 'choosing' ? "C'est à toi de choisir." : `En attente de ${chooser?.name ?? 'la suite'}.`;
    return {
      gameId, gameStatus: game.status, player: { id: player.id, name: player.name, connected: player.connected }, message,
      round: round ? { id: round.id, status: round.status, chooserName: chooser?.name ?? '', isChooser: round.chooserPlayerId === player.id, contract: round.contract, jokerContract: round.jokerContract, contractOptions: game.settings.enabledContracts, usedContracts: game.settings.enabledContracts.filter((code) => !availableContracts(game, player.id).includes(code)), availableContracts: round.chooserPlayerId === player.id && round.status === 'choosing' ? availableContracts(game, player.id) : undefined, needsSubmission: game.settings.resultEntryMode === 'players' && ['scoring', 'countdown'].includes(round.status) && !round.submissions[player.id], hasSubmission: Boolean(round.submissions[player.id]), canEditSubmission: game.settings.resultEntryMode === 'players' && ['scoring', 'countdown'].includes(round.status), submissionValues: round.submissions[player.id]?.values, maxHearts: game.settings.deck.heartsInPlay, maxQueens: game.settings.deck.queensInPlay, maxTricks: game.settings.deck.cardsPerPlayer } : undefined,
    };
  }

  private aggregate(game: Game, round: Round): RoundResult {
    const submissions = game.players.map((player) => round.submissions[player.id]).filter(Boolean); const contract = effectiveContract(round); const result: RoundResult = {};
    if (contract === 'R') { result.firstPlayerId = submissions.find((s) => s.values.rank === 'first')?.playerId; result.secondPlayerId = submissions.find((s) => s.values.rank === 'second')?.playerId; }
    const map = (key: 'hearts' | 'queens' | 'tricks') => Object.fromEntries(submissions.flatMap((submission) => { const value = submission.values[key]; return value === undefined ? [] : [[submission.playerId, value] as const]; }));
    if (contract === 'C' || contract === 'T') result.heartsByPlayer = map('hearts');
    if (contract === 'D' || contract === 'T') result.queensByPlayer = map('queens');
    if (contract === 'P' || contract === 'T') result.tricksByPlayer = map('tricks');
    if (contract === 'K' || contract === 'T') result.kingOfHeartsPlayerId = submissions.find((s) => s.values.kingOfHearts)?.playerId;
    if (contract === 'L' || contract === 'T') result.lastTrickPlayerId = submissions.find((s) => s.values.lastTrick)?.playerId;
    return completeRoundResult(round, result, game);
  }

  private refreshRoundFromSubmissions(game: Game, round: Round) {
    if (!this.submissionsReady(game, round)) {
      round.validationErrors = ['Toutes les saisies des joueurs ne sont pas encore reçues.'];
      return;
    }
    const result = this.aggregate(game, round); const errors = validateRoundResult(round, result, game);
    round.validationErrors = errors; round.result = result;
    if (!errors.length && game.settings.resultEntryMode === 'players') { round.status = 'countdown'; round.countdownEndsAt = new Date(Date.now() + 5000).toISOString(); this.scheduleCountdown(game, round); }
  }

  private submissionsReady(game: Game, round: Round) {
    const contract = effectiveContract(round); const values = (playerId: string) => round.submissions[playerId]?.values;
    const numericTotal = (field: 'hearts' | 'queens' | 'tricks', expected: number) => {
      const entered = game.players.map((player) => values(player.id)?.[field]).filter((item): item is number => item !== undefined);
      return entered.every((item) => Number.isInteger(item) && item >= 0) && entered.reduce((sum, item) => sum + item, 0) === expected;
    };
    const someone = (field: 'kingOfHearts' | 'lastTrick') => game.players.some((player) => values(player.id)?.[field] === true);
    if (contract === 'R') { const ranks = game.players.map((player) => values(player.id)?.rank); return ranks.filter((rank) => rank === 'first').length === 1 && ranks.filter((rank) => rank === 'second').length === 1; }
    if ((contract === 'C' || contract === 'T') && !numericTotal('hearts', game.settings.deck.heartsInPlay)) return false;
    if ((contract === 'D' || contract === 'T') && !numericTotal('queens', game.settings.deck.queensInPlay)) return false;
    if ((contract === 'P' || contract === 'T') && !numericTotal('tricks', game.settings.deck.cardsPerPlayer)) return false;
    if ((contract === 'K' || contract === 'T') && !someone('kingOfHearts')) return false;
    if ((contract === 'L' || contract === 'T') && !someone('lastTrick')) return false;
    return true;
  }

  private scheduleCountdown(game: Game, round: Round) { this.clearCountdown(round.id); const delay = Math.max(0, new Date(round.countdownEndsAt ?? Date.now() + 5000).getTime() - Date.now()); this.countdowns.set(round.id, setTimeout(() => void this.finalize(game, round), delay)); }
  private clearCountdown(roundId: string) { const timer = this.countdowns.get(roundId); if (timer) clearTimeout(timer); this.countdowns.delete(roundId); }
  private async finalize(game: Game, round: Round) {
    this.clearCountdown(round.id); if (!round.result) return; round.result = completeRoundResult(round, round.result, game); const errors = validateRoundResult(round, round.result, game); if (errors.length) { round.validationErrors = errors; round.status = 'scoring'; await this.changed(game); return; }
    round.scoreDelta = computeRoundScore(round, round.result, game.settings, game.players); round.chooserSucceeded = chooserSucceeded(round, round.result); round.bonusApplied = round.chooserSucceeded; round.status = 'validated'; round.validatedAt = now(); round.countdownEndsAt = undefined;
    const next = createNextRound(game); if (next) game.rounds.push(next); else { game.status = 'finished'; game.finishedReason = 'complete'; }
    await this.changed(game);
  }
  private requireLobby(game: Game) { if (!['setup', 'waiting_players'].includes(game.status)) throw new Error('Cette action est réservée au lobby.'); }
  private requireRecoveryRequest(gameId: string, requestId: string, secret: string) {
    const request = this.recoveryRequests.get(requestId);
    if (!request || request.gameId !== gameId || request.secretHash !== hashToken(secret)) throw new Error('Demande de récupération invalide.');
    return request;
  }
  private expireRecoveryRequest(request: RecoveryRequest) { if ((request.state === 'pending' || request.state === 'approved') && new Date(request.expiresAt).getTime() <= Date.now()) { request.state = 'expired'; this.emit('recovery-changed', request.gameId); } }
  private expireRecoveryRequests() { for (const request of this.recoveryRequests.values()) this.expireRecoveryRequest(request); }
  private player(game: Game, id: string) { const player = game.players.find((item) => item.id === id); if (!player) throw new Error('Joueur introuvable.'); return player; }
  private currentRound(game: Game) { return [...game.rounds].reverse().find((round) => round.status !== 'validated'); }
  private requireCurrent(game: Game, status: Round['status']) { if (game.status !== 'playing') throw new Error('La partie n’est pas en cours.'); const round = this.currentRound(game); if (!round || round.status !== status) throw new Error('La manche n’est pas dans l’état attendu.'); return round; }
}
