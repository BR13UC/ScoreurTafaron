import type { Game } from './types.js';
import type { PlayerAppearance, PlayerProfile, PlayerProfileData } from './stats-types.js';

export const appearanceKey = (gameId: string, playerId: string) => `${gameId}:${playerId}`;

export function normalizePlayerIdentity(name: string): string {
  return name.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR');
}

export function validateProfileData(value: unknown): PlayerProfileData {
  if (!value || typeof value !== 'object') throw new Error('Le fichier des profils joueurs est invalide.');
  const data = value as Partial<PlayerProfileData>;
  if (data.version !== 1 || !Array.isArray(data.profiles) || !data.assignments || typeof data.assignments !== 'object') throw new Error('Le fichier des profils joueurs est invalide.');
  const ids = new Set<string>(); const aliases = new Set<string>();
  for (const profile of data.profiles) {
    if (!profile || typeof profile.id !== 'string' || !profile.id || typeof profile.displayName !== 'string' || !profile.displayName.trim() || !Array.isArray(profile.aliases) || typeof profile.createdAt !== 'string' || typeof profile.updatedAt !== 'string') throw new Error('Un profil joueur est invalide.');
    if (ids.has(profile.id)) throw new Error('Deux profils joueurs utilisent le même identifiant.');
    ids.add(profile.id);
    for (const alias of profile.aliases) {
      if (typeof alias !== 'string' || alias !== normalizePlayerIdentity(alias) || aliases.has(alias)) throw new Error('Les alias des profils joueurs sont invalides ou ambigus.');
      aliases.add(alias);
    }
  }
  for (const profileId of Object.values(data.assignments)) if (!ids.has(profileId)) throw new Error('Une affectation joueur référence un profil absent.');
  return data as PlayerProfileData;
}

export function resolveProfile(data: PlayerProfileData, gameId: string, playerId: string, name: string): PlayerProfile | undefined {
  const assigned = data.assignments[appearanceKey(gameId, playerId)];
  if (assigned) return data.profiles.find((profile) => profile.id === assigned);
  const normalized = normalizePlayerIdentity(name);
  return data.profiles.find((profile) => profile.aliases.includes(normalized));
}

export function reconcileProfiles(data: PlayerProfileData, games: Game[], idFactory: () => string, timestamp: () => string): PlayerProfileData {
  const next = structuredClone(data);
  for (const game of games) for (const player of game.players) {
    if (resolveProfile(next, game.id, player.id, player.name)) continue;
    const now = timestamp();
    next.profiles.push({ id: idFactory(), displayName: player.name.trim().replace(/\s+/g, ' '), aliases: [normalizePlayerIdentity(player.name)], createdAt: now, updatedAt: now });
  }
  return validateProfileData(next);
}

export function identityAdminView(data: PlayerProfileData, games: Game[]): IdentityAdminViewBuilderResult {
  const appearances: PlayerAppearance[] = [];
  for (const game of games) for (const player of game.players) {
    const profile = resolveProfile(data, game.id, player.id, player.name);
    if (!profile) continue;
    const key = appearanceKey(game.id, player.id);
    appearances.push({ key, gameId: game.id, gameName: game.name, gameStatus: game.status, playerId: player.id, sourceName: player.name, profileId: profile.id, explicitAssignment: Boolean(data.assignments[key]), qualifies: game.finishedReason === 'complete' });
  }
  return {
    appearances,
    profiles: data.profiles.map((profile) => {
      const linked = appearances.filter((item) => item.profileId === profile.id);
      const qualifyingAppearanceCount = linked.filter((item) => item.qualifies).length;
      return { ...profile, active: qualifyingAppearanceCount > 0, appearanceCount: linked.length, qualifyingAppearanceCount };
    }),
  };
}

type IdentityAdminViewBuilderResult = {
  profiles: Array<PlayerProfile & { active: boolean; appearanceCount: number; qualifyingAppearanceCount: number }>;
  appearances: PlayerAppearance[];
};
