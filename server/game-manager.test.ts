import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameManager } from './game-manager.js';
import { GameStorage } from './storage.js';

let directory: string; let manager: GameManager;
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'tafaron-')); manager = new GameManager(new GameStorage(directory)); await manager.init(); });
afterEach(async () => { vi.useRealTimers(); await rm(directory, { recursive: true, force: true }); });

describe('cycle de vie d’une partie', () => {
  it('archive la partie active lors de la création suivante et peut la réactiver', async () => {
    const first = (await manager.create('Première', 3)).game; const second = (await manager.create('Deuxième', 3)).game;
    expect(manager.get(first.id).status).toBe('archived'); expect(manager.active()?.id).toBe(second.id);
    await manager.activate(first.id); expect(manager.active()?.id).toBe(first.id); expect(manager.get(second.id).status).toBe('archived');
  });
  it('joue, valide, sauvegarde puis annule une manche', async () => {
    const game = (await manager.create('Test', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id); const chooser = manager.get(game.id).rounds[0].chooserPlayerId;
    await manager.selectContract(game.id, chooser, 'R'); await manager.beginScoring(game.id);
    const others = manager.get(game.id).players.filter((p) => p.id !== chooser);
    await manager.setFullResult(game.id, { firstPlayerId: chooser, secondPlayerId: others[0].id }); await manager.validateCurrent(game.id);
    expect(manager.snapshot(manager.get(game.id)).scores[chooser]).toBe(-125);
    await manager.undoLast(game.id); expect(manager.get(game.id).rounds.filter((r) => r.status === 'validated')).toHaveLength(0); expect(manager.get(game.id).rounds[0].chooserPlayerId).toBe(chooser);
    const restored = new GameManager(new GameStorage(directory)); await restored.init(); expect(restored.get(game.id).rounds).toHaveLength(1);
  });
  it('reconnecte un joueur par jeton et ne l’expose pas dans sa vue', async () => {
    const game = (await manager.create('Test', 3)).game; const joined = await manager.join(game.id, 'Alice');
    const view = manager.playerView(game.id, joined.token); expect(view.player.name).toBe('Alice'); expect(JSON.stringify(view)).not.toContain('tokenHash'); expect(view).not.toHaveProperty('scores');
  });
  it('persiste les étapes de configuration et accepte une correction joueur avant validation', async () => {
    const game = (await manager.create('Étapes', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); expect(manager.get(game.id).settings.setupStep).toBe('cards');
    await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    const chooser = manager.get(game.id).rounds[0].chooserPlayerId; await manager.selectContract(game.id, chooser, 'C'); await manager.beginScoring(game.id);
    const players = manager.get(game.id).players;
    const totalHearts = manager.get(game.id).settings.deck.heartsInPlay;
    await Promise.all(players.map((player, index) => manager.submitPlayer(game.id, player.id, { hearts: index === 0 ? totalHearts : 0 })));
    const round = manager.get(game.id).rounds[0]; expect(round.status).toBe('countdown');
    await manager.submitPlayer(game.id, players[0].id, { hearts: 0 });
    expect(manager.get(game.id).rounds[0].status).toBe('scoring');
    expect(manager.get(game.id).rounds[0].submissions[players[0].id].source).toBe('player');
    await manager.updateSubmissionField(game.id, players[0].id, 'hearts', totalHearts);
    expect(manager.get(game.id).rounds[0].submissions[players[0].id].source).toBe('admin');
  });
  it('archive explicitement une partie terminée', async () => {
    const game = (await manager.create('Fin', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    await manager.finish(game.id); await manager.archive(game.id);
    expect(manager.get(game.id).status).toBe('archived'); expect(manager.get(game.id).statusBeforeArchive).toBe('finished');
  });
  it('laisse le mode organisateur valider explicitement une matrice complète', async () => {
    const game = (await manager.create('Organisateur', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready');
    await manager.updateSettings(game.id, { resultEntryMode: 'organizer' }); await manager.start(game.id);
    const chooser = manager.get(game.id).rounds[0].chooserPlayerId; await manager.selectContract(game.id, chooser, 'C'); await manager.beginScoring(game.id);
    const players = manager.get(game.id).players; const total = manager.get(game.id).settings.deck.heartsInPlay;
    await manager.updateSubmissionField(game.id, players[0].id, 'hearts', total);
    await manager.updateSubmissionField(game.id, players[1].id, 'hearts', 0);
    await manager.updateSubmissionField(game.id, players[2].id, 'hearts', 0);
    expect(manager.get(game.id).rounds[0].status).toBe('scoring'); expect(manager.get(game.id).rounds[0].result).toBeTruthy();
    await manager.validateCurrent(game.id); expect(manager.get(game.id).rounds[0].status).toBe('validated');
  });
  it('permet au choisisseur de lancer la saisie ou de revenir choisir', async () => {
    const game = (await manager.create('Choix', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    const chooser = manager.get(game.id).rounds[0].chooserPlayerId;
    await manager.selectContract(game.id, chooser, 'K'); await manager.returnToContractChoice(game.id, chooser);
    expect(manager.get(game.id).rounds[0].status).toBe('choosing'); expect(manager.get(game.id).rounds[0].contract).toBeUndefined();
    await manager.selectContract(game.id, chooser, 'K'); await manager.beginScoringByPlayer(game.id, chooser);
    expect(manager.get(game.id).rounds[0].status).toBe('scoring');
  });
  it('valide un roi de cœur dès qu’un joueur le déclare, même sans saisie absente', async () => {
    const game = (await manager.create('Binaire', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    const chooser = manager.get(game.id).rounds[0].chooserPlayerId; await manager.selectContract(game.id, chooser, 'K'); await manager.beginScoring(game.id);
    const reporter = manager.get(game.id).players[0]; await manager.submitPlayer(game.id, reporter.id, { kingOfHearts: true });
    expect(manager.get(game.id).rounds[0].status).toBe('countdown'); expect(manager.get(game.id).rounds[0].result?.kingOfHeartsPlayerId).toBe(reporter.id);
  });
  it('déduit les zéros et les rangs Autre avant le compte à rebours', async () => {
    const game = (await manager.create('Déductions', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    const players = manager.get(game.id).players; const chooser = players[0].id;
    await manager.selectContract(game.id, chooser, 'R'); await manager.beginScoring(game.id);
    await manager.submitPlayer(game.id, players[0].id, { rank: 'first' }); await manager.submitPlayer(game.id, players[1].id, { rank: 'second' });
    expect(manager.get(game.id).rounds[0].status).toBe('countdown'); await manager.cancelCountdown(game.id);
  });
  it('déduit les zéros sans attendre une saisie explicite de chaque joueur', async () => {
    const game = (await manager.create('Zéros', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    const round = manager.get(game.id).rounds[0]; await manager.selectContract(game.id, round.chooserPlayerId, 'C'); await manager.beginScoring(game.id);
    await manager.submitPlayer(game.id, game.players[0].id, { hearts: game.settings.deck.heartsInPlay });
    expect(manager.get(game.id).rounds[0].result?.heartsByPlayer).toEqual(Object.fromEntries(game.players.map((player, index) => [player.id, index === 0 ? game.settings.deck.heartsInPlay : 0])));
    expect(manager.get(game.id).rounds[0].status).toBe('countdown'); await manager.cancelCountdown(game.id);
  });
  it('autorise le Joker à imiter un contrat actif déjà utilisé mais pas un contrat désactivé', async () => {
    const game = (await manager.create('Joker', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    const current = manager.get(game.id).rounds[0]; manager.get(game.id).rounds.unshift({ ...current, id: 'used', status: 'validated', contract: 'C', scoreDelta: {}, validatedAt: new Date().toISOString() });
    await manager.selectContract(game.id, current.chooserPlayerId, 'J', 'C'); expect(current.jokerContract).toBe('C');
    const disabledGame = (await manager.create('Joker désactivé', 3)).game;
    for (const name of ['D', 'E', 'F']) await manager.addLocalPlayer(disabledGame.id, name);
    await manager.updateSettings(disabledGame.id, { enabledContracts: ['J', 'R'] }); await manager.setSetupStep(disabledGame.id, 'cards'); await manager.setSetupStep(disabledGame.id, 'ready'); await manager.start(disabledGame.id);
    await expect(manager.selectContract(disabledGame.id, disabledGame.rounds[0].chooserPlayerId, 'J', 'C')).rejects.toThrow(/invalide/);
  });
  it('récupère une session téléphone, invalide l’ancien jeton et reste à usage unique', async () => {
    const game = (await manager.create('Récupération', 3)).game; const alice = await manager.join(game.id, 'Alice');
    await manager.addLocalPlayer(game.id, 'Bob'); await manager.addLocalPlayer(game.id, 'Cara');
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    const request = manager.createRecoveryRequest(game.id, alice.player.id);
    expect(() => manager.createRecoveryRequest(game.id, alice.player.id)).toThrow(/déjà active/);
    manager.decideRecoveryRequest(game.id, request.requestId, 'approved'); const claimed = await manager.claimRecoveryRequest(game.id, request.requestId, request.secret);
    expect(() => manager.authenticate(game.id, alice.token)).toThrow(/invalide/); expect(manager.authenticate(game.id, claimed.token).player.id).toBe(alice.player.id);
    await expect(manager.claimRecoveryRequest(game.id, request.requestId, request.secret)).rejects.toThrow(/déjà été utilisée/);
  });
  it('convertit un joueur local après approbation et expose les refus et expirations', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    const game = (await manager.create('Récupération locale', 3)).game;
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    const player = manager.get(game.id).players[0]; const refused = manager.createRecoveryRequest(game.id, player.id);
    manager.decideRecoveryRequest(game.id, refused.requestId, 'rejected'); expect(manager.recoveryStatus(game.id, refused.requestId, refused.secret).state).toBe('rejected');
    const expired = manager.createRecoveryRequest(game.id, player.id); vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(manager.recoveryStatus(game.id, expired.requestId, expired.secret).state).toBe('expired');
    const accepted = manager.createRecoveryRequest(game.id, player.id); manager.decideRecoveryRequest(game.id, accepted.requestId, 'approved'); const claimed = await manager.claimRecoveryRequest(game.id, accepted.requestId, accepted.secret);
    expect(manager.authenticate(game.id, claimed.token).player.kind).toBe('phone');
  });
  it('calcule le compteur de manche sans modifier les sauvegardes', async () => {
    const game = (await manager.create('Compteur', 3)).game; expect(manager.snapshot(game)).toMatchObject({ currentRoundNumber: 0, totalRounds: 24 });
    for (const name of ['A', 'B', 'C']) await manager.addLocalPlayer(game.id, name);
    await manager.setSetupStep(game.id, 'cards'); await manager.setSetupStep(game.id, 'ready'); await manager.start(game.id);
    expect(manager.snapshot(manager.get(game.id))).toMatchObject({ currentRoundNumber: 1, totalRounds: 24 });
    await manager.finish(game.id); expect(manager.snapshot(manager.get(game.id)).currentRoundNumber).toBe(0);
    manager.get(game.id).finishedReason = 'complete'; expect(manager.snapshot(manager.get(game.id)).currentRoundNumber).toBe(24);
  });
  it('supprime uniquement une partie déjà archivée', async () => {
    const archived = (await manager.create('À supprimer', 3)).game;
    await manager.create('Active', 3);
    await manager.deleteGame(archived.id);
    await expect(Promise.resolve().then(() => manager.get(archived.id))).rejects.toThrow('Partie introuvable');
    await expect(manager.deleteGame(manager.active()!.id)).rejects.toThrow(/Archivez/);
  });
});
