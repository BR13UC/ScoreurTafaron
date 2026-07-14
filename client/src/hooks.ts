import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api, type GameSnapshot } from './api';

export function useLiveGame(gameId: string | undefined, role: 'admin' | 'display', token?: string) {
  const [snapshot, setSnapshot] = useState<GameSnapshot>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!gameId) return;
    api.game(gameId).then(setSnapshot).catch((reason) => setError(reason.message));
    const socket = io({ auth: { gameId, role, token } });
    socket.on('game:snapshot', setSnapshot); socket.on('connect_error', (reason) => setError(reason.message));
    return () => { socket.close(); };
  }, [gameId, role, token]);
  return { snapshot, setSnapshot, error };
}

export function usePlayerRefresh(gameId: string | undefined, token: string | undefined, refresh: () => void) {
  useEffect(() => {
    if (!gameId || !token) return;
    const socket = io({ auth: { gameId, role: 'player', token } }); socket.on('player:refresh', refresh);
    return () => { socket.close(); };
  }, [gameId, token, refresh]);
}
