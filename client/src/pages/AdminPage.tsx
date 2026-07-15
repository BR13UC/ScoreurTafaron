import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CONTRACT_CODES, CONTRACT_LABELS, type RecoveryAdminRequest, type Round, type ScoringSettings } from '@shared/types';
import { getValidDeckDistributions } from '@shared/deck';
import { api, type GameSnapshot } from '../api';
import { ContractIcon, ContractPicker, Countdown, ErrorBanner, FullResultForm, ScoreMatrix, StatusPill } from '../components';
import { useLiveGame } from '../hooks';

export function AdminPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const directFromGame = searchParams.get('from') === 'game';
  const [token, setToken] = useState('');
  const [gameId, setGameId] = useState<string>();
  const [initial, setInitial] = useState<GameSnapshot | null>();
  const [error, setError] = useState('');
  const [resumePrompt, setResumePrompt] = useState(false);
  const [newGameMode, setNewGameMode] = useState(searchParams.get('new') === '1');

  useEffect(() => {
    Promise.all([api.adminSession(), api.active()]).then(([session, active]) => {
      setToken(session.token); setInitial(active); setGameId(active?.game.id);
      setResumePrompt(Boolean(active && active.game.status !== 'finished' && !directFromGame && searchParams.get('new') !== '1'));
    }).catch((reason) => setError(reason.message));
  }, [directFromGame, searchParams]);

  const live = useLiveGame(gameId, 'admin', token);
  const snapshot = live.snapshot ?? initial ?? undefined;
  const game = snapshot?.game;
  const activeRound = game ? [...game.rounds].reverse().find((round) => round.status !== 'validated') : undefined;

  useEffect(() => {
    if (game?.status === 'playing' && activeRound?.status === 'in_progress') navigate('/game', { replace: true });
  }, [activeRound?.id, activeRound?.status, game?.status, navigate]);

  const mutate = async <T = unknown>(path: string, method = 'POST', body?: unknown): Promise<boolean> => {
    if (!token) return false;
    setError('');
    try { await api.admin<T>(token, `/api/games/${gameId}${path}`, method, body); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erreur inconnue.'); return false; }
  };
  const create = async (name: string, playerCount: number) => {
    try { const created = await api.admin<GameSnapshot>(token, '/api/games', 'POST', { name, playerCount }); setInitial(created); setGameId(created.game.id); setResumePrompt(false); setNewGameMode(false); navigate('/admin', { replace: true }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erreur inconnue.'); }
  };

  if (!token && !error) return <Shell><div className="loading">Ouverture de l’administration…</div></Shell>;
  if (newGameMode) return <Shell><button className="ghost" onClick={() => setNewGameMode(false)}>← Retour</button><CreateGame onCreate={create} /></Shell>;
  if (resumePrompt && game) return <Shell><ResumePrompt game={game} onResume={() => setResumePrompt(false)} onNew={() => setNewGameMode(true)} /></Shell>;
  if (!game) return <Shell><ErrorBanner message={error} /><CreateGame onCreate={create} /></Shell>;

  const current = activeRound;
  const chooser = current && game.players.find((player) => player.id === current.chooserPlayerId);
  const setupStep = game.settings.setupStep ?? (game.status === 'playing' || game.status === 'finished' ? 'ready' : 'settings');

  return <Shell>
    <header className="topbar"><div><span className="eyebrow">Administration</span><h1>{game.name || 'Partie de Tafaron'}</h1></div><nav><Link to="/game">Écran de jeu</Link><Link to="/tables">Tableaux</Link><Link to="/history">Historique</Link><Link to="/stats">Statistiques</Link></nav></header>
    <ErrorBanner message={error || live.error} />
    {(game.status === 'waiting_players' || game.status === 'setup') && setupStep === 'settings' && <SetupLobby snapshot={snapshot!} mutate={mutate} onContinue={() => mutate('/setup-step', 'POST', { step: 'cards' })} />}
    {(game.status === 'waiting_players' || game.status === 'setup') && setupStep === 'cards' && <CardsStep game={game} mutate={mutate} />}
    {(game.status === 'waiting_players' || game.status === 'setup') && setupStep === 'ready' && <ReadyAdmin game={game} mutate={mutate} />}
    {(game.status === 'playing' || game.status === 'finished') && <main className="admin-grid">
      <section className="panel hero-panel"><div className="section-head"><div><span className="eyebrow">Manche {current?.index ?? '—'}</span><h2>{game.status === 'finished' ? 'Partie terminée' : `${chooser?.name ?? '—'} choisit`}</h2></div><StatusPill tone={game.status === 'finished' ? 'good' : 'warn'}>{game.status}</StatusPill></div>
        {game.status === 'playing' && current?.status === 'choosing' && <ContractPicker className="admin-contract-picker" options={game.settings.enabledContracts} available={game.settings.enabledContracts.filter((code) => !game.rounds.some((r) => r.status === 'validated' && r.chooserPlayerId === current.chooserPlayerId && r.contract === code))} onChoose={(contract, jokerContract) => mutate('/round/contract', 'POST', { playerId: current.chooserPlayerId, contract, jokerContract })} />}
        {current?.status === 'in_progress' && <div className="center-stack"><div className="contract-big"><ContractIcon code={current.contract!} /><strong>{current.contract === 'J' ? `Joker → ${CONTRACT_LABELS[current.jokerContract!]}` : CONTRACT_LABELS[current.contract!]}</strong><small>{current.contract}</small></div><button className="primary" onClick={() => mutate('/round/scoring')}>Commencer la saisie</button></div>}
        {current && ['scoring', 'countdown'].includes(current.status) && <ScoringPanel game={game} round={current} mutate={mutate} />}
        {game.status === 'finished' && <div className="center-stack"><p>La partie est enregistrée dans l’historique.</p><div className="inline-form"><a className="button primary" href={`/api/games/${game.id}/export/scores.csv`}>Exporter les scores</a><button onClick={async () => { if (await mutate('/archive')) navigate('/admin?new=1'); }}>Accueil</button></div></div>}
      </section>
      <aside className="stack"><ScoreSummary snapshot={snapshot!} /><AdminActions game={game} current={current} token={token} mutate={mutate} onHome={async () => { if (await mutate('/archive')) navigate('/admin?new=1'); }} /></aside>
      <section className="panel span-all"><h3>Manches validées</h3><RoundHistory game={game} mutate={mutate} /></section>
    </main>}
  </Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <div className="app-shell">{children}</div>; }

function ResumePrompt({ game, onResume, onNew }: { game: GameSnapshot['game']; onResume: () => void; onNew: () => void }) {
  return <main className="welcome"><div className="logo-mark">T</div><span className="eyebrow">Partie sauvegardée</span><h1>{game.name || 'Tafaron'}</h1><p>Une partie non terminée a été trouvée. Veux-tu la reprendre ?</p><div className="panel action-list"><button className="primary huge" onClick={onResume}>Reprendre la partie</button><button onClick={onNew}>Créer une nouvelle partie</button><Link to="/history">Consulter l’historique</Link><Link to="/stats">Statistiques des joueurs</Link></div></main>;
}

function CreateGame({ onCreate }: { onCreate: (name: string, count: number) => void }) {
  const [name, setName] = useState(''); const [count, setCount] = useState(5);
  return <main className="welcome"><div className="logo-mark">T</div><span className="eyebrow">Compteur local</span><h1>Tafaron</h1><p>Crée une partie, puis invite les joueurs avec le QR code.</p><div className="panel create-card"><label>Nom de la partie<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Soirée en famille" /></label><label>Nombre de joueurs<select value={count} onChange={(e) => setCount(Number(e.target.value))}>{Array.from({ length: 8 }, (_, index) => index + 3).map((value) => <option key={value}>{value}</option>)}</select></label><button className="primary" onClick={() => onCreate(name, count)}>Créer la partie</button></div><div className="row-actions"><Link to="/history">Ouvrir l’historique</Link><Link to="/stats">Statistiques des joueurs</Link></div></main>;
}

function SetupLobby({ snapshot, mutate, onContinue }: { snapshot: GameSnapshot; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean>; onContinue: () => void }) {
  const { game } = snapshot; const [name, setName] = useState(''); const [runtime, setRuntime] = useState<{ port: number; addresses: { address: string; label: string }[] }>(); const [qr, setQr] = useState<{ url: string; dataUrl: string }>();
  useEffect(() => { api.runtime().then(setRuntime); }, []);
  const address = game.settings.selectedAddress || runtime?.addresses[0]?.address || 'localhost';
  useEffect(() => { if (runtime) api.qr(game.id, address).then(setQr); }, [game.id, address, runtime]);
  const order = game.settings.turnOrder.map((id) => game.players.find((player) => player.id === id)).filter(Boolean) as typeof game.players;
  const move = (index: number, direction: number) => { const next = [...game.settings.turnOrder]; const other = index + direction; if (other < 0 || other >= next.length) return; [next[index], next[other]] = [next[other], next[index]]; void mutate('/order', 'PUT', { order: next }); };
  const drop = (draggedId: string, targetId: string) => { const next = [...game.settings.turnOrder]; const from = next.indexOf(draggedId); const to = next.indexOf(targetId); if (from < 0 || to < 0 || from === to) return; next.splice(to, 0, next.splice(from, 1)[0]); void mutate('/order', 'PUT', { order: next }); };
  const canContinue = game.players.length === game.settings.playerCount && game.settings.enabledContracts.length > 0;
  return <main className="lobby-grid">
    <section className="panel join-panel"><div className="section-head"><div><span className="eyebrow">Étape 1 · Connexion locale</span><h2>Rejoindre la partie</h2></div><StatusPill tone="good">{game.players.length}/{game.settings.playerCount}</StatusPill></div>{qr && <><img className="qr" alt="QR code de connexion" src={qr.dataUrl} /><a className="join-url" href={qr.url}>{qr.url}</a></>}<label>Adresse réseau<select value={address} onChange={(e) => mutate('/settings', 'PATCH', { selectedAddress: e.target.value })}>{runtime?.addresses.map((item) => <option value={item.address} key={item.address}>{item.label} · {item.address}</option>)}{!runtime?.addresses.length && <option value="localhost">localhost</option>}</select></label></section>
    <section className="panel"><div className="section-head"><div><span className="eyebrow">Paramètres + lobby</span><h2>Joueurs</h2></div><label>Attendus<select value={game.settings.playerCount} onChange={(e) => mutate('/settings', 'PATCH', { playerCount: Number(e.target.value) })}>{Array.from({ length: 8 }, (_, index) => index + 3).map((value) => <option key={value}>{value}</option>)}</select></label></div><p className="order-instruction">Renseignez les joueurs dans le sens horaire, en commençant par le premier joueur qui choisira.</p><form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (name) { void mutate('/players/local', 'POST', { name }); setName(''); } }}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ajouter sans téléphone" /><button>Ajouter</button></form><div className="player-list">{order.map((player, index) => <div className="player-row" draggable onDragStart={(e) => e.dataTransfer.setData('text/player-id', player.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e.dataTransfer.getData('text/player-id'), player.id)} key={player.id}><span className={`connection ${player.connected ? 'online' : ''}`} /><strong>{index + 1}. {player.name}</strong><small>{player.kind === 'phone' ? 'Téléphone' : 'Local'}</small><div className="row-actions"><button aria-label="Renommer" onClick={() => { const renamed = prompt('Nouveau nom', player.name); if (renamed) void mutate(`/players/${player.id}`, 'PATCH', { name: renamed }); }}>✎</button><button aria-label="Monter" onClick={() => move(index, -1)}>↑</button><button aria-label="Descendre" onClick={() => move(index, 1)}>↓</button><button className="danger ghost" onClick={() => mutate(`/players/${player.id}`, 'DELETE')}>×</button></div></div>)}</div><button className="secondary wide" onClick={() => mutate('/order', 'PUT', { order: [...game.settings.turnOrder].sort(() => Math.random() - .5) })}>Ordre aléatoire</button></section>
    <section className="panel span-all"><div className="settings-columns"><GameOptions game={game} mutate={mutate} /><ScoringOptions scoring={game.settings.scoring} mutate={mutate} /><div><span className="eyebrow">Étape suivante</span><h3>Choisir la distribution des cartes</h3><p>Les contrats et le barème peuvent être préparés pendant que les joueurs rejoignent la partie.</p><button className="primary wide" disabled={!canContinue} onClick={onContinue}>Continuer vers les cartes</button>{!canContinue && <small>Il faut le nombre de joueurs attendu et au moins un contrat.</small>}</div></div></section>
  </main>;
}

function CardsStep({ game, mutate }: { game: GameSnapshot['game']; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean> }) {
  const options = getValidDeckDistributions(game.settings.playerCount); const selected = game.settings.deck.ranksPerSuit;
  const choose = async (ranksPerSuit: number) => { if (await mutate('/settings', 'PATCH', { customRanks: ranksPerSuit })) await mutate('/setup-step', 'POST', { step: 'ready' }); };
  return <main className="cards-step"><section className="panel"><div className="section-head"><div><span className="eyebrow">Étape 2 · Distribution</span><h1>Combien de cartes ?</h1></div><StatusPill>{game.players.length} joueurs</StatusPill></div><p>Choisis une distribution équitable. Les deux informations sont affichées pour éviter toute ambiguïté.</p><div className="deck-options">{options.map((option) => <button className={`deck-option ${selected === option.ranksPerSuit ? 'selected' : ''}`} key={option.ranksPerSuit} onClick={() => choose(option.ranksPerSuit)}><strong>De l’As au {option.keptRanks.at(-1)}</strong><span>{option.ranksPerSuit} rangs par couleur</span><b>{option.cardsPerPlayer} cartes par joueur</b><small>{option.cardsUsed} cartes · départ Réussite : {option.successStartRank}</small></button>)}</div><div className="step-actions"><button onClick={() => mutate('/setup-step', 'POST', { step: 'settings' })}>← Paramètres et lobby</button></div></section></main>;
}

function ReadyAdmin({ game, mutate }: { game: GameSnapshot['game']; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean> }) {
  return <main className="ready-step"><section className="panel"><span className="eyebrow">Étape 3 · Admin de partie</span><h1>Partie prête</h1><div className="ready-summary"><div><strong>{game.settings.deck.keepInstruction}</strong><span>{game.settings.deck.cardsPerPlayer} cartes par joueur</span></div><div><strong>{game.settings.deck.successStartRank}</strong><span>Départ Réussite</span></div><div><strong>{game.players.length}</strong><span>joueurs</span></div></div><p>Tu peux encore modifier les paramètres ou la distribution avant de lancer.</p><div className="step-actions"><button onClick={() => mutate('/setup-step', 'POST', { step: 'settings' })}>Modifier paramètres</button><button onClick={() => mutate('/setup-step', 'POST', { step: 'cards' })}>Modifier cartes</button><button className="primary" onClick={() => mutate('/start')}>Lancer la partie</button></div></section></main>;
}

function GameOptions({ game, mutate }: { game: GameSnapshot['game']; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean> }) {
  return <div><span className="eyebrow">Contrats actifs</span><div className="checks">{CONTRACT_CODES.map((code) => <label className="check" key={code}><input type="checkbox" checked={game.settings.enabledContracts.includes(code)} onChange={(e) => mutate('/settings', 'PATCH', { enabledContracts: e.target.checked ? [...game.settings.enabledContracts, code] : game.settings.enabledContracts.filter((item) => item !== code) })} /><ContractIcon code={code} className="contract-setting-icon" /><span>{CONTRACT_LABELS[code]}</span></label>)}</div><label>Mode de saisie<select value={game.settings.resultEntryMode} onChange={(e) => mutate('/settings', 'PATCH', { resultEntryMode: e.target.value })}><option value="players">Chaque téléphone</option><option value="organizer">Ordinateur admin</option></select></label></div>;
}

function ScoringOptions({ scoring, mutate }: { scoring: ScoringSettings; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean> }) {
  const labels: Record<keyof ScoringSettings, string> = { successFirst: 'Réussite 1er', successSecond: 'Réussite 2e', heart: 'Cœur', queen: 'Dame', kingOfHearts: 'Roi de cœur', trick: 'Pli', lastTrick: 'Dernier pli', bonus: 'Contrat rempli' };
  return <div><span className="eyebrow">Barème</span><div className="score-settings">{(Object.keys(scoring) as (keyof ScoringSettings)[]).map((key) => <label key={key}>{labels[key]}<input type="number" step="1" defaultValue={scoring[key]} onBlur={(e) => mutate('/settings', 'PATCH', { scoring: { [key]: Number(e.target.value) } })} /></label>)}</div></div>;
}

function ScoringPanel({ game, round, mutate }: { game: GameSnapshot['game']; round: Round; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean> }) {
  const received = Object.keys(round.submissions).length;
  const valid = Boolean(round.result && round.validationErrors.length === 0);
  return <div><div className="section-head"><div><span className="eyebrow">Saisie {game.settings.resultEntryMode === 'players' ? 'par les joueurs' : 'par l’organisateur'}</span><h3>{received}/{game.players.length} saisies reçues</h3></div>{round.status === 'countdown' && <Countdown endsAt={round.countdownEndsAt} />}</div><ErrorBanner message={round.validationErrors.join(' ')} /><ScoreMatrix game={game} round={round} onCell={(playerId, field, value) => { void mutate(`/admin/submissions/${playerId}/${field}`, 'PUT', { value }); }} />{game.settings.resultEntryMode === 'organizer' && round.status === 'scoring' && <button className="primary" disabled={!valid} onClick={() => mutate('/round/validate')}>Valider les résultats</button>}{round.status === 'countdown' && <button onClick={() => mutate('/round/countdown/cancel')}>Annuler le compte à rebours</button>}</div>;
}

function ScoreSummary({ snapshot }: { snapshot: GameSnapshot }) { const ranking = [...snapshot.game.players].sort((a, b) => snapshot.scores[a.id] - snapshot.scores[b.id]); return <section className="panel"><span className="eyebrow">Classement actuel</span><h3>Manche {snapshot.currentRoundNumber} / {snapshot.totalRounds}</h3><ol className="ranking">{ranking.map((player) => <li key={player.id}><span>{player.name}</span><strong>{snapshot.scores[player.id]} pts</strong></li>)}</ol></section>; }

function AdminActions({ game, current, token, mutate, onHome }: { game: GameSnapshot['game']; current?: Round; token: string; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean>; onHome: () => void }) {
  return <section className="panel"><span className="eyebrow">Actions</span><div className="action-list">{game.status === 'playing' && current?.status === 'choosing' && <><RecoveryPanel game={game} token={token} mutate={mutate} /><details className="action-details"><summary>Paramètres entre les manches</summary><label>Mode de saisie<select value={game.settings.resultEntryMode} onChange={(e) => mutate('/settings', 'PATCH', { resultEntryMode: e.target.value })}><option value="players">Téléphones</option><option value="organizer">Admin</option></select></label><ScoringOptions scoring={game.settings.scoring} mutate={mutate} /></details></>}<a className="button" href={`/api/games/${game.id}/export/json`}>Exporter JSON</a><a className="button" href={`/api/games/${game.id}/export/rounds.csv`}>CSV manches</a><a className="button" href={`/api/games/${game.id}/export/scores.csv`}>CSV scores</a>{game.status === 'finished' ? <button className="primary" onClick={onHome}>Accueil</button> : <button className="danger ghost" onClick={() => confirm('Terminer la partie maintenant ?') && mutate('/finish')}>Terminer plus tôt</button>}<button className="danger" onClick={() => confirm('Annuler la dernière manche validée ?') && mutate('/rounds/undo')}>Annuler la dernière manche</button></div></section>;
}

function RecoveryPanel({ game, token, mutate }: { game: GameSnapshot['game']; token: string; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean> }) {
  const [runtime, setRuntime] = useState<{ port: number; addresses: { address: string; label: string }[] }>(); const [qr, setQr] = useState<{ url: string; dataUrl: string }>(); const [requests, setRequests] = useState<RecoveryAdminRequest[]>([]); const [error, setError] = useState(''); const [addressOverride, setAddressOverride] = useState('');
  const address = addressOverride || game.settings.selectedAddress || runtime?.addresses[0]?.address || 'localhost';
  useEffect(() => { api.runtime().then(setRuntime).catch((reason) => setError(reason.message)); }, []);
  useEffect(() => { if (runtime) api.qr(game.id, address).then(setQr).catch((reason) => setError(reason.message)); }, [address, game.id, runtime]);
  useEffect(() => { let active = true; const refresh = () => api.recoveryRequests(game.id, token).then((next) => { if (active) setRequests(next); }).catch((reason) => { if (active) setError(reason.message); }); refresh(); const timer = setInterval(refresh, 1500); return () => { active = false; clearInterval(timer); }; }, [game.id, token]);
  const decide = async (requestId: string, decision: 'approve' | 'reject') => { if (await mutate(`/recovery-requests/${requestId}/${decision}`)) setRequests((current) => decision === 'reject' ? current.filter((request) => request.requestId !== requestId) : current.map((request) => request.requestId === requestId ? { ...request, state: 'approved' } : request)); };
  return <details className="action-details recovery-panel"><summary>QR et récupération de session</summary><ErrorBanner message={error} />{qr && <><img className="qr recovery-qr" alt="QR code de récupération" src={qr.dataUrl} /><a className="join-url" href={qr.url}>{qr.url}</a></>}<label className="recovery-address">Adresse utilisée par le QR<select value={address} onChange={(event) => { setAddressOverride(event.target.value); void mutate('/settings', 'PATCH', { selectedAddress: event.target.value }); }}>{runtime?.addresses.map((item) => <option value={item.address} key={item.address}>{item.label} · {item.address}</option>)}{!runtime?.addresses.length && <option value="localhost">localhost</option>}</select></label>{runtime && <div className="network-link-list"><strong>Liens disponibles</strong>{runtime.addresses.map((item) => { const url = `http://${item.address}:${runtime.port}/join/${game.id}`; return <a href={url} target="_blank" rel="noreferrer" key={item.address} onClick={() => { setAddressOverride(item.address); void mutate('/settings', 'PATCH', { selectedAddress: item.address }); }}><span>{item.label}</span>{url}</a>; })}</div>}<h4>Demandes</h4>{requests.length ? <div className="recovery-request-list">{requests.map((request) => <div className="recovery-request" key={request.requestId}><strong>{request.playerName}</strong>{request.state === 'pending' ? <div className="row-actions"><button className="primary" onClick={() => void decide(request.requestId, 'approve')}>Accepter</button><button onClick={() => void decide(request.requestId, 'reject')}>Refuser</button></div> : <small>Approuvée, reconnexion en attente…</small>}</div>)}</div> : <p className="muted">Aucune demande en attente.</p>}</details>;
}

function RoundHistory({ game, mutate }: { game: GameSnapshot['game']; mutate: (path: string, method?: string, body?: unknown) => Promise<boolean> }) {
  const [editing, setEditing] = useState<Round>(); const rounds = game.rounds.filter((round) => round.status === 'validated');
  return <>{editing ? <div><button className="ghost" onClick={() => setEditing(undefined)}>← Retour</button><h4>Corriger la manche {editing.index}</h4><FullResultForm game={game} round={editing} initial={editing.result} label="Enregistrer la correction" onSubmit={async (result) => { await mutate(`/rounds/${editing.id}`, 'PUT', result); setEditing(undefined); }} /></div> : <div className="round-list">{rounds.length ? [...rounds].reverse().map((round) => <div className="round-row" key={round.id}><strong>M{round.index}</strong><span>{game.players.find((p) => p.id === round.chooserPlayerId)?.name}</span><span>{round.contract === 'J' ? `Joker → ${CONTRACT_LABELS[round.jokerContract!]}` : CONTRACT_LABELS[round.contract!]}</span><StatusPill tone={round.chooserSucceeded ? 'good' : 'neutral'}>{round.chooserSucceeded ? '✓ réussi' : '○ non réussi'}</StatusPill><button onClick={() => setEditing(round)}>Modifier</button></div>) : <p className="muted">Aucune manche validée.</p>}</div>}</>;
}
