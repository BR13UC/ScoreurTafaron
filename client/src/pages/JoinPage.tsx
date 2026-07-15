import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CONTRACT_LABELS, type EffectiveContractCode, type JoinContext, type PlayerSubmission, type RecoveryRequestCreated, type RecoveryRequestState } from '@shared/types';
import { api, type PlayerView } from '../api';
import { ContractPicker, ErrorBanner, PersonalSubmissionForm, StatusPill } from '../components';
import { usePlayerRefresh } from '../hooks';

function readStoredRecovery(key: string): RecoveryRequestCreated | undefined {
  try { const value = sessionStorage.getItem(key); return value ? JSON.parse(value) as RecoveryRequestCreated : undefined; }
  catch { return undefined; }
}

export function JoinPage() {
  const { gameId } = useParams(); const storageKey = `tafaron:${gameId}:token`; const recoveryKey = `tafaron:${gameId}:recovery`;
  const [token, setToken] = useState(() => localStorage.getItem(storageKey) ?? ''); const [view, setView] = useState<PlayerView>(); const [context, setContext] = useState<JoinContext>();
  const [recovery, setRecovery] = useState<RecoveryRequestCreated | undefined>(() => readStoredRecovery(recoveryKey)); const [recoveryState, setRecoveryState] = useState<RecoveryRequestState>('pending');
  const [name, setName] = useState(''); const [error, setError] = useState(''); const [editing, setEditing] = useState(false);
  const loadContext = useCallback(() => { if (gameId) api.joinContext(gameId).then(setContext).catch((reason) => setError(reason.message)); }, [gameId]);
  const refresh = useCallback(() => { if (gameId && token) api.playerView(gameId, token).then((next) => { setView(next); setError(''); if (!next.round?.hasSubmission) setEditing(false); }).catch((reason) => { if (reason instanceof Error && /Session joueur invalide/.test(reason.message)) { localStorage.removeItem(storageKey); setToken(''); setView(undefined); loadContext(); } else setError(reason instanceof Error ? reason.message : 'Erreur.'); }); }, [gameId, loadContext, storageKey, token]);
  useEffect(refresh, [refresh]); usePlayerRefresh(gameId, token, refresh);
  useEffect(() => { if (!token && !recovery) loadContext(); }, [loadContext, recovery, token]);
  useEffect(() => {
    if (!gameId || !recovery) return; let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const status = await api.recoveryStatus(gameId, recovery.requestId, recovery.secret); if (stopped) return; setRecoveryState(status.state); setError('');
        if (status.state === 'approved') {
          const claimed = await api.claimRecovery(gameId, recovery.requestId, recovery.secret); if (stopped) return;
          localStorage.setItem(storageKey, claimed.token); sessionStorage.removeItem(recoveryKey); setRecovery(undefined); setToken(claimed.token); setView(undefined); return;
        }
        if (status.state === 'pending') timer = setTimeout(() => void poll(), 1500);
      } catch (reason) {
        if (stopped) return; sessionStorage.removeItem(recoveryKey); setRecovery(undefined); setError(reason instanceof Error ? reason.message : 'La demande de récupération est indisponible.'); loadContext();
      }
    };
    void poll(); return () => { stopped = true; clearTimeout(timer); };
  }, [gameId, loadContext, recovery, recoveryKey, storageKey]);

  const join = async () => { if (!gameId) return; try { const result = await api.join(gameId, name); localStorage.setItem(storageKey, result.token); setToken(result.token); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erreur.'); } };
  const requestRecovery = async (playerId: string) => { if (!gameId) return; try { const created = await api.createRecovery(gameId, playerId); sessionStorage.setItem(recoveryKey, JSON.stringify(created)); setRecovery(created); setRecoveryState('pending'); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erreur.'); } };
  const restartRecovery = () => { sessionStorage.removeItem(recoveryKey); setRecovery(undefined); setRecoveryState('pending'); loadContext(); };
  const act = async (path: string, body: unknown) => { if (!gameId || !token) return; try { await api.playerAction(gameId, token, path, body); setEditing(false); refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erreur.'); } };

  if (!token) {
    if (recovery) return <div className="mobile-page"><div className="mobile-card recovery-card"><div className="logo-mark">T</div><span className="eyebrow">Récupération de session</span><h1>{recoveryState === 'pending' ? 'Demande envoyée' : recoveryState === 'approved' ? 'Reconnexion…' : recoveryState === 'rejected' ? 'Demande refusée' : 'Demande expirée'}</h1><ErrorBanner message={error} /><p>{recoveryState === 'pending' ? 'L’administrateur doit maintenant accepter la demande sur l’ordinateur principal.' : recoveryState === 'approved' ? 'La nouvelle session est en cours de préparation.' : 'Tu peux envoyer une nouvelle demande si nécessaire.'}</p>{recoveryState === 'pending' || recoveryState === 'approved' ? <div className="waiting-orbit"><div className="orbit"><span /></div></div> : <button className="primary wide" onClick={restartRecovery}>Recommencer</button>}</div></div>;
    if (!context) return <div className="mobile-page"><div className="mobile-card"><p>Connexion à la partie…</p><ErrorBanner message={error} /></div></div>;
    if (context.mode === 'recover') return <div className="mobile-page"><div className="mobile-card recovery-card"><div className="logo-mark">T</div><span className="eyebrow">Retrouver ma partie</span><h1>Qui es-tu&nbsp;?</h1><p>Choisis ton nom. L’administrateur confirmera la récupération sur l’ordinateur principal.</p><ErrorBanner message={error} /><div className="recovery-player-list">{context.players.map((player) => <button className="wide" key={player.id} onClick={() => void requestRecovery(player.id)}>{player.name}</button>)}</div></div></div>;
    if (context.mode === 'closed') return <div className="mobile-page"><div className="mobile-card"><div className="logo-mark">T</div><h1>Partie terminée</h1><p>Cette partie n’accepte plus de connexion.</p><ErrorBanner message={error} /></div></div>;
    return <div className="mobile-page"><div className="mobile-card"><div className="logo-mark">T</div><span className="eyebrow">Rejoindre Tafaron</span><h1>Quel est ton prénom&nbsp;?</h1><ErrorBanner message={error} /><input className="name-input" autoFocus maxLength={40} value={name} onChange={(event) => setName(event.target.value)} aria-label="Prénom" /><button className="primary huge" disabled={!name.trim()} onClick={() => void join()}>Rejoindre</button></div></div>;
  }
  if (!view) return <div className="mobile-page"><div className="mobile-card"><p>Connexion à la partie…</p><ErrorBanner message={error} /></div></div>;
  const round = view.round; const effective = (round?.contract === 'J' ? round.jokerContract : round?.contract) as EffectiveContractCode | undefined;
  return <div className="mobile-page"><div className="mobile-card"><div className="mobile-head"><div><span className="eyebrow">Joueur</span><h1>{view.player.name}</h1></div><StatusPill tone={view.player.connected ? 'good' : 'neutral'}>connecté</StatusPill></div><ErrorBanner message={error} />
    {round?.isChooser && round.status === 'choosing' ? <><h2>C’est à toi de choisir</h2><ContractPicker options={round.contractOptions} available={round.availableContracts} used={round.usedContracts} onChoose={(contract, jokerContract) => act('contract', { contract, jokerContract })} /></>
    : round?.isChooser && round.status === 'in_progress' && round.contract ? <><span className="eyebrow">Contrat choisi</span><h2>{round.contract === 'J' ? `Joker → ${CONTRACT_LABELS[round.jokerContract!]}` : CONTRACT_LABELS[round.contract]}</h2><p>Tu peux lancer la saisie des résultats ou choisir un autre contrat.</p><button className="primary wide" onClick={() => act('scoring', {})}>Passer au calcul des points</button><button className="ghost wide" onClick={() => act('rechoose', {})}>Revenir au choix</button></>
    : round?.hasSubmission && round.canEditSubmission && editing && effective ? <><span className="eyebrow">{round.contract === 'J' ? `Joker → ${CONTRACT_LABELS[effective]}` : CONTRACT_LABELS[effective]}</span><h2>Modifier ma saisie</h2><PersonalSubmissionForm contract={effective} initial={round.submissionValues} maxHearts={round.maxHearts} maxQueens={round.maxQueens} maxTricks={round.maxTricks} submitLabel="Envoyer la correction" onSubmit={(values: PlayerSubmission['values']) => act('submission', values)} /><button className="ghost wide" onClick={() => setEditing(false)}>Annuler la modification</button></>
    : round?.needsSubmission && effective ? <><span className="eyebrow">{round.contract === 'J' ? `Joker → ${CONTRACT_LABELS[effective]}` : CONTRACT_LABELS[effective]}</span><h2>Saisis ton résultat</h2><PersonalSubmissionForm contract={effective} maxHearts={round.maxHearts} maxQueens={round.maxQueens} maxTricks={round.maxTricks} onSubmit={(values: PlayerSubmission['values']) => act('submission', values)} /></>
    : <div className="waiting-orbit"><div className="orbit"><span /></div><h2>{round?.hasSubmission ? 'Saisie envoyée !' : view.message}</h2>{round?.hasSubmission && round.canEditSubmission && <button className="primary" onClick={() => setEditing(true)}>Modifier ma saisie</button>}{round?.contract && <p>Contrat : {round.contract === 'J' ? `J → ${round.jokerContract}` : CONTRACT_LABELS[round.contract]}</p>}<small>Regarde l’écran principal pour suivre la partie.</small></div>}
  </div></div>;
}
