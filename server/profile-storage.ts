import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import writeFileAtomic from 'write-file-atomic';
import { validateProfileData } from '../shared/player-identity.js';
import type { PlayerProfileData } from '../shared/stats-types.js';

export class ProfileStorage {
  constructor(private readonly filename = path.resolve(process.cwd(), 'data/player-profiles.json')) {}

  async load(): Promise<PlayerProfileData> {
    try { return validateProfileData(JSON.parse(await readFile(this.filename, 'utf8'))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, profiles: [], assignments: {} };
      throw new Error(`Impossible de lire les profils joueurs : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
    }
  }

  async save(data: PlayerProfileData) {
    const valid = validateProfileData(data);
    await mkdir(path.dirname(this.filename), { recursive: true });
    await writeFileAtomic(this.filename, `${JSON.stringify(valid, null, 2)}\n`, { encoding: 'utf8' });
  }
}
