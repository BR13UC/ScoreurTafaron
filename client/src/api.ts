import type { GameSnapshot, PlayerSubmission, PlayerView, RoundResult } from '@shared/types';

export class ApiError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error ?? `Erreur HTTP ${response.status}`);
  return body as T;
}

export const api = {
  adminSession: () => request<{ token: string }>('/api/admin/session', { method: 'POST' }),
  runtime: () => request<{ port: number; addresses: { address: string; label: string }[] }>('/api/runtime'),
  games: () => request<Array<{ id: string; name?: string; status: string; updatedAt: string; playerCount: number }>>('/api/games'),
  active: () => request<GameSnapshot | null>('/api/games/active'),
  game: (id: string) => request<GameSnapshot>(`/api/games/${id}`),
  admin: <T>(token: string, path: string, method = 'POST', body?: unknown) => request<T>(path, { method, headers: { 'x-admin-token': token }, body: body === undefined ? undefined : JSON.stringify(body) }),
  join: (id: string, name: string) => request<{ token: string }>(`/api/games/${id}/join`, { method: 'POST', body: JSON.stringify({ name }) }),
  playerView: (id: string, token: string) => request<PlayerView>(`/api/games/${id}/player`, { headers: { authorization: `Bearer ${token}` } }),
  playerAction: (id: string, token: string, path: string, body: unknown) => request<{ ok: true }>(`/api/games/${id}/player/${path}`, { method: path === 'submission' ? 'PUT' : 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) }),
  qr: (id: string, address: string) => request<{ url: string; dataUrl: string }>(`/api/games/${id}/qr?address=${encodeURIComponent(address)}`),
};

export type { GameSnapshot, PlayerSubmission, PlayerView, RoundResult };
