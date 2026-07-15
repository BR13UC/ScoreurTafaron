import { randomUUID } from 'node:crypto';
import type { Game } from '../shared/types.js';
import { identityAdminView, normalizePlayerIdentity, reconcileProfiles, validateProfileData } from '../shared/player-identity.js';
import type { IdentityAdminView, PlayerProfileData } from '../shared/stats-types.js';
import { ProfileStorage } from './profile-storage.js';

const now = () => new Date().toISOString();

export class ProfileManager {
  private data: PlayerProfileData = { version: 1, profiles: [], assignments: {} };
  private loadError?: Error;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly storage = new ProfileStorage()) {}

  async init(games: Game[]) {
    try { this.data = await this.storage.load(); await this.reconcileUnlocked(games); }
    catch (error) { this.loadError = error instanceof Error ? error : new Error('Impossible de charger les profils joueurs.'); }
  }

  async reconcile(games: Game[]) {
    return this.lock(() => this.reconcileUnlocked(games));
  }

  private async reconcileUnlocked(games: Game[]) {
    this.assertReady(); const next = reconcileProfiles(this.data, games, randomUUID, now);
    if (JSON.stringify(next) !== JSON.stringify(this.data)) { await this.storage.save(next); this.data = next; }
    return this.data;
  }

  async adminView(games: Game[]): Promise<IdentityAdminView> { return this.lock(async () => identityAdminView(await this.reconcileUnlocked(games), games)); }

  async rename(profileId: string, displayName: string, games: Game[]) {
    return this.lock(async () => { const name = cleanName(displayName); const data = structuredClone(await this.reconcileUnlocked(games)); const profile = requireProfile(data, profileId);
      profile.displayName = name; profile.updatedAt = now(); await this.commit(data); });
  }

  async addAlias(profileId: string, aliasName: string, games: Game[]) {
    return this.lock(async () => { const alias = normalizePlayerIdentity(cleanName(aliasName)); const data = structuredClone(await this.reconcileUnlocked(games)); const profile = requireProfile(data, profileId);
      const owner = data.profiles.find((item) => item.aliases.includes(alias));
      if (owner && owner.id !== profileId) throw new Error('Cet alias appartient déjà à un autre profil. Fusionnez les profils pour le récupérer.');
      if (!profile.aliases.includes(alias)) profile.aliases.push(alias); profile.updatedAt = now(); await this.commit(data); });
  }

  async merge(sourceProfileId: string, targetProfileId: string, games: Game[]) {
    return this.lock(async () => { if (sourceProfileId === targetProfileId) throw new Error('Choisissez deux profils différents.');
      const data = structuredClone(await this.reconcileUnlocked(games)); const source = requireProfile(data, sourceProfileId); const target = requireProfile(data, targetProfileId);
      target.aliases = [...new Set([...target.aliases, ...source.aliases])]; target.updatedAt = now();
      for (const [key, value] of Object.entries(data.assignments)) if (value === source.id) data.assignments[key] = target.id;
      data.profiles = data.profiles.filter((item) => item.id !== source.id); await this.commit(data); });
  }

  async reassign(input: { appearanceKeys: string[]; targetProfileId?: string; displayName?: string }, games: Game[]) {
    return this.lock(async () => { if (!Array.isArray(input.appearanceKeys) || !input.appearanceKeys.length) throw new Error('Sélectionnez au moins une apparition.');
      const view = identityAdminView(await this.reconcileUnlocked(games), games); const validKeys = new Set(view.appearances.map((item) => item.key));
      if (input.appearanceKeys.some((key) => !validKeys.has(key))) throw new Error('Une apparition joueur est introuvable.');
      const data = structuredClone(this.data); let targetId = input.targetProfileId;
      if (targetId) requireProfile(data, targetId);
      else {
        const timestamp = now(); targetId = randomUUID();
        data.profiles.push({ id: targetId, displayName: cleanName(input.displayName ?? ''), aliases: [], createdAt: timestamp, updatedAt: timestamp });
      }
      for (const key of input.appearanceKeys) data.assignments[key] = targetId;
      requireProfile(data, targetId).updatedAt = now(); await this.commit(data); return targetId; });
  }

  async delete(profileId: string, games: Game[]) {
    return this.lock(async () => { const view = identityAdminView(await this.reconcileUnlocked(games), games); const entry = view.profiles.find((item) => item.id === profileId); if (!entry) throw new Error('Profil joueur introuvable.');
      if (entry.appearanceCount) throw new Error('Ce profil apparaît encore dans une partie sauvegardée.');
      const data = structuredClone(this.data); data.profiles = data.profiles.filter((item) => item.id !== profileId);
      for (const [key, value] of Object.entries(data.assignments)) if (value === profileId) delete data.assignments[key];
      await this.commit(data); });
  }

  private assertReady() { if (this.loadError) throw this.loadError; }
  private async commit(data: PlayerProfileData) { this.assertReady(); const valid = validateProfileData(data); await this.storage.save(valid); this.data = valid; }
  private lock<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation); this.queue = result.then(() => undefined, () => undefined); return result;
  }
}

function cleanName(value: string) {
  const name = String(value).trim().replace(/\s+/g, ' '); if (!name) throw new Error('Le nom du profil est obligatoire.'); if (name.length > 40) throw new Error('Le nom du profil ne peut pas dépasser 40 caractères.'); return name;
}
function requireProfile(data: PlayerProfileData, id: string) { const profile = data.profiles.find((item) => item.id === id); if (!profile) throw new Error('Profil joueur introuvable.'); return profile; }
