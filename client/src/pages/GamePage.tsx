import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CONTRACT_LABELS } from '@shared/types';
import { api } from '../api';
import { ContractIcon, cumulativeRows, Countdown, ErrorBanner, StatusPill } from '../components';
import { useLiveGame } from '../hooks';
import { PLAYER_COLORS } from '../palette';

function EndScoreLabel({ x, y, value, index, lastIndex, dy }: { x?: number | string; y?: number | string; value?: number | string; index?: number; lastIndex: number; dy: number }) {
  if (index !== lastIndex || x === undefined || y === undefined) return null;
  return <text className="chart-end-score" x={Number(x) + 10} y={Number(y) + dy} dominantBaseline="middle">{value}</text>;
}

export function GamePage() {
  const navigate = useNavigate();
  const [id, setId] = useState<string>(); const [adminToken, setAdminToken] = useState(''); const [error, setError] = useState('');
  useEffect(() => { api.active().then((value) => setId(value?.game.id)); api.adminSession().then((session) => setAdminToken(session.token)).catch(() => undefined); }, []);
  const { snapshot } = useLiveGame(id, 'display');
  if (!snapshot) return <div className="display-page center-stack"><h1>Tafaron</h1><p>En attente d’une partie…</p><Link to="/admin">Ouvrir l’admin</Link></div>;
  const { game, scores } = snapshot; const current = [...game.rounds].reverse().find((round) => round.status !== 'validated'); const chooser = game.players.find((player) => player.id === current?.chooserPlayerId);
  const ranking = [...game.players].sort((a, b) => scores[a.id] - scores[b.id]); const validatedCount = game.rounds.filter((round) => round.status === 'validated').length;
  const chart = [{ x: 0, ...Object.fromEntries(game.players.map((player) => [player.id, 0])) }, ...cumulativeRows(game)];
  const chartLabel = (value: number | string) => {
    if (Number(value) === 0) return 'Départ'; const round = game.rounds.find((item) => item.status === 'validated' && item.index === Number(value));
    if (!round?.contract) return `Manche ${value}`; const contract = round.contract === 'J' ? `Joker → ${CONTRACT_LABELS[round.jokerContract!]}` : CONTRACT_LABELS[round.contract];
    return `Manche ${value} · ${contract}`;
  };
  const gameAction = async (path: string, body?: unknown) => { if (!adminToken) throw new Error('Session administrateur indisponible.'); await api.admin(adminToken, `/api/games/${game.id}${path}`, 'POST', body); };
  const beginScoring = async () => { setError(''); try { await gameAction('/round/scoring'); navigate('/admin?from=game'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de lancer le calcul des points.'); } };
  const rechoose = async () => { if (!current?.chooserPlayerId) return; setError(''); try { await gameAction('/round/rechoose', { playerId: current.chooserPlayerId }); navigate('/admin?from=game'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de revenir au choix.'); } };
  const labelOffset = (playerId: string) => { const tied = game.players.filter((player) => scores[player.id] === scores[playerId]); const position = tied.findIndex((player) => player.id === playerId); return (position - (tied.length - 1) / 2) * 16; };

  return <div className="display-page"><header className="display-header"><div><span className="eyebrow">{game.name || 'Tafaron'}</span><h1>{game.status === 'finished' ? 'Partie terminée' : `${chooser?.name ?? '—'}, à toi !`}</h1><p className="contract-display">{current?.contract ? <><ContractIcon code={current.contract} className="contract-display-icon" /><strong>{current.contract === 'J' ? `Joker → ${CONTRACT_LABELS[current.jokerContract!]}` : CONTRACT_LABELS[current.contract]}</strong><small>({current.contract})</small></> : 'Choix du contrat en attente'}</p><ErrorBanner message={error} />{current?.status === 'in_progress' && <div className="display-actions"><button className="primary" disabled={!adminToken} onClick={() => void beginScoring()}>Calcul des points</button><button className="ghost" disabled={!adminToken} onClick={() => void rechoose()}>Revenir au choix</button></div>}</div><div className="round-counter"><span>Manche</span><strong>{snapshot.currentRoundNumber} / {snapshot.totalRounds}</strong></div></header>{current?.status === 'countdown' && <Countdown endsAt={current.countdownEndsAt} />}
    <main className="display-grid"><section className="display-card chart-card"><h2>Évolution des scores</h2><ResponsiveContainer width="100%" height={350}><LineChart data={chart} margin={{ top: 16, right: 76, bottom: 0, left: 0 }}><XAxis type="number" dataKey="x" domain={[0, Math.max(1, validatedCount)]} ticks={Array.from({ length: validatedCount + 1 }, (_, index) => index)} tickFormatter={(value) => value === 0 ? 'Départ' : `M${value}`} stroke="#8290ad" /><YAxis stroke="#8290ad" /><Tooltip labelFormatter={chartLabel} />{game.players.map((player, index) => <Line key={player.id} type="monotone" dataKey={player.id} name={player.name} stroke={PLAYER_COLORS[index % PLAYER_COLORS.length]} strokeWidth={4} dot={{ r: 4 }}><LabelList dataKey={player.id} content={<EndScoreLabel lastIndex={chart.length - 1} dy={labelOffset(player.id)} />} /></Line>)}</LineChart></ResponsiveContainer></section><section className="display-card ranking-card"><h2>Classement</h2><ol className="ranking large compact-ranking">{ranking.map((player, index) => { const color = PLAYER_COLORS[game.players.findIndex((item) => item.id === player.id) % PLAYER_COLORS.length]; return <li key={player.id} style={{ backgroundColor: `${color}26` }}><b>{index + 1}</b><span>{player.name}</span></li>; })}</ol></section><section className="display-card matrix-card"><div className="section-head"><h2>Contrats</h2><StatusPill>{validatedCount} joués</StatusPill></div><div className="matrix" style={{ gridTemplateColumns: `minmax(120px, 1.5fr) repeat(${game.settings.enabledContracts.length}, minmax(100px, 1fr))` }}><div />{game.settings.enabledContracts.map((code) => <strong title={CONTRACT_LABELS[code]} key={code}>{CONTRACT_LABELS[code]}</strong>)}{game.players.map((player) => <div className="matrix-row" key={player.id}><strong>{player.name}</strong>{game.settings.enabledContracts.map((code) => { const round = game.rounds.find((item) => item.status === 'validated' && item.chooserPlayerId === player.id && item.contract === code); return <span className={round ? round.chooserSucceeded ? 'success' : 'failed' : ''} key={code}>{round ? round.contract === 'J' ? `Joker → ${CONTRACT_LABELS[round.jokerContract!]}` : round.chooserSucceeded ? '✓' : '○' : '·'}</span>; })}</div>)}</div></section></main><footer className="display-footer"><Link to="/admin?from=game">Retour admin</Link><Link to="/tables">Voir les tableaux complets</Link></footer></div>;
}
