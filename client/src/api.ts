import type { GameSnapshot, JoinContext, PlayerSubmission, PlayerView, RecoveryAdminRequest, RecoveryRequestCreated, RecoveryRequestStatus, RoundResult } from '@shared/types';
import type { IdentityAdminView, PlayerStatsDetail, PlayerStatsSummary, StatsFilter } from '@shared/stats-types';

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
  joinContext: (id: string) => request<JoinContext>(`/api/games/${id}/join-context`),
  createRecovery: (id: string, playerId: string) => request<RecoveryRequestCreated>(`/api/games/${id}/recovery-requests`, { method: 'POST', body: JSON.stringify({ playerId }) }),
  recoveryStatus: (id: string, requestId: string, secret: string) => request<RecoveryRequestStatus>(`/api/games/${id}/recovery-requests/${requestId}`, { headers: { authorization: `Bearer ${secret}` } }),
  claimRecovery: (id: string, requestId: string, secret: string) => request<{ token: string }>(`/api/games/${id}/recovery-requests/${requestId}/claim`, { method: 'POST', headers: { authorization: `Bearer ${secret}` } }),
  recoveryRequests: (id: string, token: string) => request<RecoveryAdminRequest[]>(`/api/games/${id}/recovery-requests`, { headers: { 'x-admin-token': token } }),
  playerView: (id: string, token: string) => request<PlayerView>(`/api/games/${id}/player`, { headers: { authorization: `Bearer ${token}` } }),
  playerAction: (id: string, token: string, path: string, body: unknown) => request<{ ok: true }>(`/api/games/${id}/player/${path}`, { method: path === 'submission' ? 'PUT' : 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) }),
  qr: (id: string, address: string) => request<{ url: string; dataUrl: string }>(`/api/games/${id}/qr?address=${encodeURIComponent(address)}`),
  playerStats: (filter: StatsFilter) => request<PlayerStatsSummary[]>(`/api/stats/players?${statsQuery(filter)}`),
  playerStatsDetail: (id: string, filter: StatsFilter) => request<PlayerStatsDetail>(`/api/stats/players/${id}?${statsQuery(filter)}`),
  statsIdentity: (token: string) => request<IdentityAdminView>('/api/stats/identity', { headers: { 'x-admin-token': token } }),
};

const statsQuery = (filter: StatsFilter) => new URLSearchParams(Object.entries(filter).filter((entry): entry is [string, string] => typeof entry[1] === 'string')).toString();

export type { GameSnapshot, IdentityAdminView, PlayerStatsDetail, PlayerStatsSummary, PlayerSubmission, PlayerView, RoundResult, StatsFilter };
