import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GameManager } from './game-manager.js';
import { GameStorage } from './storage.js';

let directory: string; let manager: GameManager;
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'tafaron-')); manager = new GameManager(new GameStorage(directory)); await manager.init(); });
afterEach(async () => rm(directory, { recursive: true, force: true }));

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
  it('supprime uniquement une partie déjà archivée', async () => {
    const archived = (await manager.create('À supprimer', 3)).game;
    await manager.create('Active', 3);
    await manager.deleteGame(archived.id);
    await expect(Promise.resolve().then(() => manager.get(archived.id))).rejects.toThrow('Partie introuvable');
    await expect(manager.deleteGame(manager.active()!.id)).rejects.toThrow(/Archivez/);
  });
});
