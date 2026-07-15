import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Game } from '../shared/types.js';
import { ProfileManager } from './profile-manager.js';
import { ProfileStorage } from './profile-storage.js';

let filename: string;
const game = (id: string, playerId: string, name: string): Game => ({ id, name: id, status: 'finished', finishedReason: 'complete', createdAt: '', updatedAt: '2026-01-01T00:00:00Z', settings: {} as Game['settings'], players: [{ id: playerId, name, joinedAt: '', connected: false, kind: 'local' }], rounds: [] });

beforeEach(async () => { filename = path.join(await mkdtemp(path.join(os.tmpdir(), 'tafaron-profiles-')), 'profiles.json'); });

describe('gestion persistante des profils', () => {
  it('amorce, fusionne, sépare et recharge les identités', async () => {
    const games = [game('g1', 'p1', 'Alice'), game('g2', 'p2', 'Bob')]; const manager = new ProfileManager(new ProfileStorage(filename)); await manager.init(games);
    let view = await manager.adminView(games); const alice = view.profiles.find((item) => item.displayName === 'Alice')!; const bob = view.profiles.find((item) => item.displayName === 'Bob')!;
    await manager.rename(alice.id, 'Alice A.', games); await manager.addAlias(alice.id, 'Ally', games);
    expect((await manager.adminView(games)).profiles.find((item) => item.id === alice.id)).toMatchObject({ displayName: 'Alice A.', aliases: expect.arrayContaining(['alice', 'ally']) });
    await manager.merge(bob.id, alice.id, games); expect((await manager.adminView(games)).profiles).toHaveLength(1);
    await manager.reassign({ appearanceKeys: ['g2:p2'], displayName: 'Bob restauré' }, games);
    view = await manager.adminView(games); expect(view.profiles.map((item) => item.displayName).sort()).toEqual(['Alice A.', 'Bob restauré']);
    const restored = new ProfileManager(new ProfileStorage(filename)); await restored.init(games); expect((await restored.adminView(games)).appearances.find((item) => item.key === 'g2:p2')?.profileId).not.toBe(alice.id);
  });

  it('refuse d’écraser un stockage corrompu', async () => {
    await writeFile(filename, '{invalide', 'utf8'); const manager = new ProfileManager(new ProfileStorage(filename)); await manager.init([]);
    await expect(manager.adminView([])).rejects.toThrow(/Impossible de lire/); expect(await readFile(filename, 'utf8')).toBe('{invalide');
  });

  it('sérialise deux amorçages concurrents sans changer les identifiants', async () => {
    const games = [game('g1', 'p1', 'Alice')]; const manager = new ProfileManager(new ProfileStorage(filename)); await manager.init([]);
    const [first, second] = await Promise.all([manager.adminView(games), manager.adminView(games)]);
    expect(first.profiles[0].id).toBe(second.profiles[0].id);
  });
});
