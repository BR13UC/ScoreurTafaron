import { describe, expect, it } from 'vitest';
import { identityAdminView, normalizePlayerIdentity, reconcileProfiles, resolveProfile } from './player-identity.js';
import type { Game } from './types.js';
import type { PlayerProfileData } from './stats-types.js';

const empty = (): PlayerProfileData => ({ version: 1, profiles: [], assignments: {} });
const game = (id: string, playerId: string, name: string): Game => ({ id, status: 'finished', finishedReason: 'complete', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T01:00:00Z', settings: {} as Game['settings'], players: [{ id: playerId, name, joinedAt: '', connected: false, kind: 'local' }], rounds: [] });

describe('identité joueur', () => {
  it('normalise la casse, les accents et les espaces', () => expect(normalizePlayerIdentity('  ÉMILE   du Pré ')).toBe('emile du pre'));

  it('regroupe automatiquement les variantes normalisées', () => {
    let sequence = 0;
    const data = reconcileProfiles(empty(), [game('g1', 'p1', 'Émile'), game('g2', 'p2', 'emile')], () => `profile-${++sequence}`, () => '2026-01-01T00:00:00Z');
    expect(data.profiles).toHaveLength(1);
    expect(resolveProfile(data, 'g2', 'p2', 'emile')?.id).toBe('profile-1');
  });

  it('priorise une affectation explicite pour séparer une collision', () => {
    const data = reconcileProfiles(empty(), [game('g1', 'p1', 'Alice')], () => 'alice-1', () => '2026-01-01T00:00:00Z');
    data.profiles.push({ id: 'alice-2', displayName: 'Alice R.', aliases: [], createdAt: '', updatedAt: '' });
    data.assignments['g1:p1'] = 'alice-2';
    expect(resolveProfile(data, 'g1', 'p1', 'Alice')?.id).toBe('alice-2');
    expect(identityAdminView(data, [game('g1', 'p1', 'Alice')]).appearances[0].explicitAssignment).toBe(true);
  });
});
