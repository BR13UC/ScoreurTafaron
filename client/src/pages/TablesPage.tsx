import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CONTRACT_LABELS } from '@shared/types';
import { api } from '../api';
import { useLiveGame } from '../hooks';

export function TablesPage() {
  const [id, setId] = useState<string>(); useEffect(() => { api.active().then((value) => setId(value?.game.id)); }, []); const { snapshot } = useLiveGame(id, 'display');
  if (!snapshot) return <div className="center-stack"><h1>Aucune partie active</h1><Link to="/admin">Retour</Link></div>;
  const { game } = snapshot; const totals = Object.fromEntries(game.players.map((player) => [player.id, 0])); const rounds = game.rounds.filter((round) => round.status === 'validated');
  return <div className="tables-page"><header className="topbar"><div><span className="eyebrow">Vue détaillée</span><h1>Tableaux complets</h1></div><Link to="/game">Retour à l’écran de jeu</Link></header><div className="tables-grid"><section><h2>Points par manche</h2><table><thead><tr><th>Manche</th>{game.players.map((player) => <th key={player.id}>{player.name}</th>)}</tr></thead><tbody>{rounds.map((round) => <tr key={round.id}><th>M{round.index} · {round.contract === 'J' ? `Joker → ${CONTRACT_LABELS[round.jokerContract!]}` : CONTRACT_LABELS[round.contract!]}</th>{game.players.map((player) => <td key={player.id}>{round.scoreDelta[player.id] ?? 0}</td>)}</tr>)}</tbody></table></section><section><h2>Points cumulés</h2><table><thead><tr><th>Manche</th>{game.players.map((player) => <th key={player.id}>{player.name}</th>)}</tr></thead><tbody>{rounds.map((round) => { for (const player of game.players) totals[player.id] += round.scoreDelta[player.id] ?? 0; return <tr key={round.id}><th>M{round.index}</th>{game.players.map((player) => <td key={player.id}>{totals[player.id]}</td>)}</tr>; })}</tbody></table></section></div></div>;
}
