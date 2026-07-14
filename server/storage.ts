import { mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import writeFileAtomic from 'write-file-atomic';
import type { Game } from '../shared/types.js';

export class GameStorage {
  constructor(private readonly directory = path.resolve(process.cwd(), 'data/games')) {}

  async init() { await mkdir(this.directory, { recursive: true }); }

  private file(id: string) { return path.join(this.directory, `${id}.json`); }

  async save(game: Game) {
    await this.init();
    await writeFileAtomic(this.file(game.id), `${JSON.stringify(game, null, 2)}\n`, { encoding: 'utf8' });
  }

  async list(): Promise<Game[]> {
    await this.init();
    const files = (await readdir(this.directory)).filter((name) => name.endsWith('.json'));
    const games: Game[] = [];
    for (const file of files) {
      try { games.push(JSON.parse(await readFile(path.join(this.directory, file), 'utf8')) as Game); }
      catch (error) { console.error(`Sauvegarde illisible ignorée: ${file}`, error); }
    }
    return games.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string) { return (await this.list()).find((game) => game.id === id); }

  async remove(id: string) {
    try { await unlink(this.file(id)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}
