import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { GameManager } from './game-manager.js';
import { getPrivateNetworkAddresses } from './network.js';
import { publicGameExport, roundsCsv, scoresCsv } from './exports.js';
import type { ContractCode, EffectiveContractCode, Game, GameSnapshot, PlayerSubmission, RoundResult, SetupStep } from '../shared/types.js';

const port = Number(process.env.PORT ?? 3000);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
const manager = new GameManager();
const adminToken = randomBytes(32).toString('base64url');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const isLoopback = (request: Request) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '');
const requireAdmin = (request: Request, response: Response, next: NextFunction) => {
  if (request.header('x-admin-token') !== adminToken) return response.status(403).json({ error: 'Action administrateur refusée.' });
  next();
};
const asyncRoute = (handler: (request: Request, response: Response) => Promise<unknown> | unknown) => async (request: Request, response: Response) => {
  try { await handler(request, response); }
  catch (error) { response.status(400).json({ error: error instanceof Error ? error.message : 'Erreur inconnue.' }); }
};
const playerAuth = (request: Request) => {
  const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Session joueur absente.');
  return token;
};
const param = (request: Request, key: string) => String(request.params[key]);
const publicSnapshot = (game: Game): GameSnapshot => ({ ...manager.snapshot(game), game: publicGameExport(game) as Game });

app.get('/api/health', (_request, response) => response.json({ ok: true }));
app.get('/api/runtime', (_request, response) => response.json({ port, addresses: getPrivateNetworkAddresses() }));
app.post('/api/admin/session', (request, response) => isLoopback(request) ? response.json({ token: adminToken }) : response.status(403).json({ error: 'L’administration est disponible uniquement sur l’ordinateur principal.' }));

app.get('/api/games', (_request, response) => response.json(manager.list().map((game) => ({ id: game.id, name: game.name, status: game.status, createdAt: game.createdAt, updatedAt: game.updatedAt, playerCount: game.players.length, finishedReason: game.finishedReason }))));
app.get('/api/games/active', (_request, response) => { const game = manager.active(); response.json(game ? publicSnapshot(game) : null); });
app.get('/api/games/:id', asyncRoute((request, response) => response.json(publicSnapshot(manager.get(param(request, 'id'))))));
app.delete('/api/games/:id', requireAdmin, asyncRoute(async (request, response) => { await manager.deleteGame(param(request, 'id')); response.json({ ok: true }); }));
app.post('/api/games', requireAdmin, asyncRoute(async (request, response) => response.status(201).json(await manager.create(request.body.name, request.body.playerCount))));
app.post('/api/games/:id/activate', requireAdmin, asyncRoute(async (request, response) => response.json(await manager.activate(param(request, 'id')))));
app.post('/api/games/:id/players/local', requireAdmin, asyncRoute(async (request, response) => response.status(201).json(await manager.addLocalPlayer(param(request, 'id'), request.body.name))));
app.patch('/api/games/:id/players/:playerId', requireAdmin, asyncRoute(async (request, response) => { await manager.renamePlayer(param(request, 'id'), param(request, 'playerId'), request.body.name); response.json({ ok: true }); }));
app.delete('/api/games/:id/players/:playerId', requireAdmin, asyncRoute(async (request, response) => { await manager.removePlayer(param(request, 'id'), param(request, 'playerId')); response.json({ ok: true }); }));
app.patch('/api/games/:id/settings', requireAdmin, asyncRoute(async (request, response) => { await manager.updateSettings(param(request, 'id'), request.body); response.json({ ok: true }); }));
app.post('/api/games/:id/setup-step', requireAdmin, asyncRoute(async (request, response) => { await manager.setSetupStep(param(request, 'id'), request.body.step as SetupStep); response.json({ ok: true }); }));
app.put('/api/games/:id/order', requireAdmin, asyncRoute(async (request, response) => { await manager.reorder(param(request, 'id'), request.body.order); response.json({ ok: true }); }));
app.post('/api/games/:id/start', requireAdmin, asyncRoute(async (request, response) => { await manager.start(param(request, 'id')); response.json({ ok: true }); }));
app.post('/api/games/:id/round/contract', requireAdmin, asyncRoute(async (request, response) => { await manager.selectContract(param(request, 'id'), request.body.playerId, request.body.contract as ContractCode, request.body.jokerContract as EffectiveContractCode | undefined); response.json({ ok: true }); }));
app.post('/api/games/:id/round/scoring', requireAdmin, asyncRoute(async (request, response) => { await manager.beginScoring(param(request, 'id')); response.json({ ok: true }); }));
app.post('/api/games/:id/round/rechoose', requireAdmin, asyncRoute(async (request, response) => { await manager.returnToContractChoice(param(request, 'id'), request.body.playerId); response.json({ ok: true }); }));
app.put('/api/games/:id/round/result', requireAdmin, asyncRoute(async (request, response) => response.json({ errors: await manager.setFullResult(param(request, 'id'), request.body as RoundResult, Boolean(request.query.auto)) })));
app.post('/api/games/:id/round/validate', requireAdmin, asyncRoute(async (request, response) => { await manager.validateCurrent(param(request, 'id')); response.json({ ok: true }); }));
app.post('/api/games/:id/round/countdown/cancel', requireAdmin, asyncRoute(async (request, response) => { await manager.cancelCountdown(param(request, 'id')); response.json({ ok: true }); }));
app.put('/api/games/:id/rounds/:roundId', requireAdmin, asyncRoute(async (request, response) => { await manager.correct(param(request, 'id'), param(request, 'roundId'), request.body as RoundResult); response.json({ ok: true }); }));
app.post('/api/games/:id/rounds/undo', requireAdmin, asyncRoute(async (request, response) => { await manager.undoLast(param(request, 'id')); response.json({ ok: true }); }));
app.post('/api/games/:id/finish', requireAdmin, asyncRoute(async (request, response) => { await manager.finish(param(request, 'id')); response.json({ ok: true }); }));
app.post('/api/games/:id/archive', requireAdmin, asyncRoute(async (request, response) => { await manager.archive(param(request, 'id')); response.json({ ok: true }); }));

app.post('/api/games/:id/join', asyncRoute(async (request, response) => response.status(201).json(await manager.join(param(request, 'id'), request.body.name))));
app.get('/api/games/:id/player', asyncRoute((request, response) => response.json(manager.playerView(param(request, 'id'), playerAuth(request)))));
app.post('/api/games/:id/player/contract', asyncRoute(async (request, response) => { const token = playerAuth(request); const { player } = manager.authenticate(param(request, 'id'), token); await manager.selectContract(param(request, 'id'), player.id, request.body.contract as ContractCode, request.body.jokerContract as EffectiveContractCode | undefined); response.json({ ok: true }); }));
app.post('/api/games/:id/player/scoring', asyncRoute(async (request, response) => { const token = playerAuth(request); const { player } = manager.authenticate(param(request, 'id'), token); await manager.beginScoringByPlayer(param(request, 'id'), player.id); response.json({ ok: true }); }));
app.post('/api/games/:id/player/rechoose', asyncRoute(async (request, response) => { const token = playerAuth(request); const { player } = manager.authenticate(param(request, 'id'), token); await manager.returnToContractChoice(param(request, 'id'), player.id); response.json({ ok: true }); }));
app.put('/api/games/:id/player/submission', asyncRoute(async (request, response) => { const token = playerAuth(request); const { player } = manager.authenticate(param(request, 'id'), token); await manager.submitPlayer(param(request, 'id'), player.id, request.body as PlayerSubmission['values'], 'player'); response.json({ ok: true }); }));
app.put('/api/games/:id/admin/submissions/:playerId/:field', requireAdmin, asyncRoute(async (request, response) => { await manager.updateSubmissionField(param(request, 'id'), param(request, 'playerId'), param(request, 'field') as keyof PlayerSubmission['values'], request.body.value); response.json({ ok: true }); }));

app.get('/api/games/:id/qr', asyncRoute(async (request, response) => {
  const address = String(request.query.address ?? 'localhost'); const url = `http://${address}:${port}/join/${param(request, 'id')}`;
  response.json({ url, dataUrl: await QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: '#172039', light: '#ffffff' } }) });
}));
const downloadName = (gameName: string | undefined, suffix: string) => `${new Date().toISOString().slice(0, 10)}-${(gameName || 'tafaron').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${suffix}`;
app.get('/api/games/:id/export/json', asyncRoute((request, response) => { const game = manager.get(param(request, 'id')); response.attachment(`${downloadName(game.name, 'complet')}.json`).json(publicGameExport(game)); }));
app.get('/api/games/:id/export/rounds.csv', asyncRoute((request, response) => { const game = manager.get(param(request, 'id')); response.attachment(`${downloadName(game.name, 'manches')}.csv`).type('text/csv').send(roundsCsv(game)); }));
app.get('/api/games/:id/export/scores.csv', asyncRoute((request, response) => { const game = manager.get(param(request, 'id')); response.attachment(`${downloadName(game.name, 'scores')}.csv`).type('text/csv').send(scoresCsv(game)); }));

io.use((socket, next) => {
  try {
    const gameId = String(socket.handshake.auth.gameId ?? ''); const role = String(socket.handshake.auth.role ?? 'display');
    manager.get(gameId);
    if (role === 'admin' && socket.handshake.auth.token !== adminToken) throw new Error('Session admin invalide.');
    if (role === 'player') manager.authenticate(gameId, String(socket.handshake.auth.token ?? ''));
    socket.data.gameId = gameId; socket.data.role = role; socket.data.token = socket.handshake.auth.token; next();
  } catch (error) { next(error instanceof Error ? error : new Error('Connexion refusée.')); }
});
io.on('connection', (socket) => {
  const { gameId, role, token } = socket.data as { gameId: string; role: string; token?: string };
  socket.join(`game:${gameId}:${role}`);
  if (role === 'player' && token) void manager.setConnected(gameId, token, true);
  socket.on('disconnect', () => { if (role === 'player' && token) void manager.setConnected(gameId, token, false); });
});
manager.on('changed', (gameId: string) => {
  const game = manager.get(gameId); const snapshot = manager.snapshot(game);
  io.to(`game:${gameId}:admin`).emit('game:snapshot', snapshot); io.to(`game:${gameId}:display`).emit('game:snapshot', publicSnapshot(game));
  // Player sockets share a room; each client refreshes its own filtered REST view on this signal.
  io.to(`game:${gameId}:player`).emit('player:refresh');
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(currentDir, '../client');
app.use(express.static(clientDir));
app.get(/.*/, (request, response, next) => request.path.startsWith('/api/') ? next() : response.sendFile(path.join(clientDir, 'index.html')));

await manager.init();
httpServer.listen(port, '0.0.0.0', () => console.log(`Tafaron est disponible sur http://localhost:${port}/admin`));
