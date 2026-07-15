import { useEffect, useState } from 'react';
import { CONTRACT_CODES, CONTRACT_LABELS, type ContractCode, type Game, type PlayerSubmission, type Round, type RoundResult } from '@shared/types';
import iconR from './assets/contracts/R.png';
import iconC from './assets/contracts/C.png';
import iconD from './assets/contracts/D.png';
import iconK from './assets/contracts/K.png';
import iconP from './assets/contracts/P.png';
import iconL from './assets/contracts/L.png';
import iconT from './assets/contracts/T.png';
import iconJ from './assets/contracts/J.png';

export function ErrorBanner({ message }: { message?: string }) { return message ? <div className="alert error" role="alert">{message}</div> : null; }
export function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' }) { return <span className={`pill ${tone}`}>{children}</span>; }
const CONTRACT_ICON_IMAGES: Record<ContractCode, string> = { R: iconR, C: iconC, D: iconD, K: iconK, P: iconP, L: iconL, T: iconT, J: iconJ };
export function ContractIcon({ code, className = '' }: { code: ContractCode; className?: string }) { return <img className={`contract-art contract-art-${code} ${className}`} src={CONTRACT_ICON_IMAGES[code]} alt="" aria-hidden="true" />; }

export function ContractPicker({ options = CONTRACT_CODES as unknown as ContractCode[], available = options, used = [], onChoose, className = '' }: { options?: ContractCode[]; available?: ContractCode[]; used?: ContractCode[]; onChoose: (contract: ContractCode, joker?: Exclude<ContractCode, 'J'>) => void; className?: string }) {
  const [jokerSelecting, setJokerSelecting] = useState(false);
  const visibleCount = jokerSelecting ? options.filter((item) => item !== 'J').length + 1 : options.length;
  const gridStyle = { '--contract-rows-wide': Math.ceil(visibleCount / 4), '--contract-rows-mobile': Math.ceil(visibleCount / 2) } as React.CSSProperties;
  if (jokerSelecting) {
    return <div className={`contract-grid ${className} joker-contract-grid`.trim()} style={gridStyle}>
      {options.filter((item) => item !== 'J').map((item) => <button type="button" className="contract-card joker-choice" key={item} onClick={() => onChoose('J', item as Exclude<ContractCode, 'J'>)}><ContractIcon code={item} /><strong>{CONTRACT_LABELS[item]}</strong></button>)}
      <button type="button" className="contract-card joker-back" onClick={() => setJokerSelecting(false)}>← Retour</button>
    </div>;
  }
  return <div className={`contract-grid ${className}`.trim()} style={gridStyle}>{options.map((code) => {
    const disabled = used.includes(code) || !available.includes(code);
    return code === 'J'
      ? <button type="button" className={`contract-card joker ${disabled ? 'disabled' : ''}`} disabled={disabled} key={code} onClick={() => setJokerSelecting(true)}><ContractIcon code={code} /><strong>{CONTRACT_LABELS[code]}</strong></button>
      : <button className={`contract-card ${disabled ? 'disabled' : ''}`} disabled={disabled} key={code} onClick={() => onChoose(code)}><ContractIcon code={code} /><strong>{CONTRACT_LABELS[code]}</strong></button>;
  })}</div>;
}

function NumberFields({ players, values, onChange, label }: { players: Game['players']; values: Record<string, number>; onChange: (values: Record<string, number>) => void; label: string }) {
  return <div className="score-grid">{players.map((player) => <label key={player.id}><span>{player.name}</span><input aria-label={`${label} de ${player.name}`} type="number" min="0" step="1" value={values[player.id] ?? 0} onChange={(event) => onChange({ ...values, [player.id]: Number(event.target.value) })} /></label>)}</div>;
}

export function FullResultForm({ game, round, initial, onSubmit, label = 'Enregistrer les résultats' }: { game: Game; round: Round; initial?: RoundResult; onSubmit: (result: RoundResult) => void; label?: string }) {
  const effective = round.contract === 'J' ? round.jokerContract : round.contract;
  const [result, setResult] = useState<RoundResult>(initial ?? {});
  useEffect(() => setResult(initial ?? {}), [initial, round.id]);
  const playerOptions = <><option value="">Choisir…</option>{game.players.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}</>;
  return <form className="result-form" onSubmit={(event) => { event.preventDefault(); onSubmit(result); }}>
    {effective === 'R' && <div className="two-cols"><label>Premier<select value={result.firstPlayerId ?? ''} onChange={(e) => setResult({ ...result, firstPlayerId: e.target.value })}>{playerOptions}</select></label><label>Deuxième<select value={result.secondPlayerId ?? ''} onChange={(e) => setResult({ ...result, secondPlayerId: e.target.value })}>{playerOptions}</select></label></div>}
    {(effective === 'C' || effective === 'T') && <><h4>Cœurs</h4><NumberFields players={game.players} label="Cœurs" values={result.heartsByPlayer ?? {}} onChange={(values) => setResult({ ...result, heartsByPlayer: values })} /></>}
    {(effective === 'D' || effective === 'T') && <><h4>Dames</h4><NumberFields players={game.players} label="Dames" values={result.queensByPlayer ?? {}} onChange={(values) => setResult({ ...result, queensByPlayer: values })} /></>}
    {(effective === 'P' || effective === 'T') && <><h4>Plis</h4><NumberFields players={game.players} label="Plis" values={result.tricksByPlayer ?? {}} onChange={(values) => setResult({ ...result, tricksByPlayer: values })} /></>}
    {(effective === 'K' || effective === 'T') && <label>Roi de cœur pris par<select value={result.kingOfHeartsPlayerId ?? ''} onChange={(e) => setResult({ ...result, kingOfHeartsPlayerId: e.target.value })}>{playerOptions}</select></label>}
    {(effective === 'L' || effective === 'T') && <label>Dernier pli pris par<select value={result.lastTrickPlayerId ?? ''} onChange={(e) => setResult({ ...result, lastTrickPlayerId: e.target.value })}>{playerOptions}</select></label>}
    <button className="primary" type="submit">{label}</button>
  </form>;
}

type SubmissionField = keyof PlayerSubmission['values'];

export function ScoreMatrix({ game, round, onCell }: { game: Game; round: Round; onCell: (playerId: string, field: SubmissionField, value: unknown) => void }) {
  const effective = round.contract === 'J' ? round.jokerContract : round.contract;
  const submissions = round.submissions ?? {};
  const values = (playerId: string) => submissions[playerId]?.values ?? {};
  const numberRow = (label: string, field: 'hearts' | 'queens' | 'tricks', expected: number, max: number) => {
    const entered = game.players.reduce((sum, player) => sum + (values(player.id)[field] ?? 0), 0);
    const explicitValid = game.players.every((player) => values(player.id)[field] === undefined || Number.isInteger(values(player.id)[field]));
    const valid = explicitValid && entered === expected;
    return <MatrixRow label={label} expected={`${entered} / ${expected}`} valid={valid}>
      {game.players.map((player) => { const submission = submissions[player.id]; const inferred = valid && values(player.id)[field] === undefined; return <div className="matrix-cell" key={player.id}><span className="cell-value" title={submission ? `${submission.source === 'player' ? 'joueur' : 'admin'} · ${new Date(submission.updatedAt).toLocaleTimeString()}` : inferred ? 'Valeur déduite automatiquement' : undefined}>{inferred ? 0 : values(player.id)[field] ?? '—'}</span><small className="cell-source">{inferred ? 'déduit' : submission?.source === 'admin' ? 'admin' : submission ? 'joueur' : ''}</small><div className="value-buttons">{Array.from({ length: max + 1 }, (_, value) => <button className={(inferred ? 0 : values(player.id)[field]) === value ? 'selected' : ''} key={value} onClick={() => onCell(player.id, field, value)}>{value}</button>)}</div></div>; })}
    </MatrixRow>;
  };
  const exclusiveRow = (label: string, field: 'kingOfHearts' | 'lastTrick') => {
    const selected = game.players.filter((player) => values(player.id)[field] === true).length;
    return <MatrixRow label={label} expected={`${selected} / 1`} valid={selected === 1}>
      {game.players.map((player) => { const submission = submissions[player.id]; return <div className="matrix-cell" key={player.id}><button className={`exclusive-button ${values(player.id)[field] ? 'selected' : ''}`} title={submission ? `${submission.source === 'player' ? 'joueur' : 'admin'} · ${new Date(submission.updatedAt).toLocaleTimeString()}` : undefined} onClick={() => game.players.forEach((candidate) => onCell(candidate.id, field, candidate.id === player.id))}>{values(player.id)[field] ? '✓' : '—'}</button><small className="cell-source">{submission?.source === 'admin' ? 'admin' : submission ? 'joueur' : ''}</small></div>; })}
    </MatrixRow>;
  };
  const rankRow = (rank: 'first' | 'second' | 'other', label: string) => {
    const selected = game.players.filter((player) => values(player.id).rank === rank).length;
    const firstAndSecondKnown = game.players.filter((player) => values(player.id).rank === 'first').length === 1 && game.players.filter((player) => values(player.id).rank === 'second').length === 1;
    const expected = rank === 'other' ? game.players.length - 2 : 1; const effectiveSelected = rank === 'other' && firstAndSecondKnown ? expected : selected;
    return <MatrixRow label={label} expected={`${effectiveSelected} / ${expected}`} valid={effectiveSelected === expected}>
      {game.players.map((player) => { const submission = submissions[player.id]; const inferred = rank === 'other' && firstAndSecondKnown && values(player.id).rank === undefined; const isSelected = values(player.id).rank === rank || inferred; return <div className="matrix-cell" key={player.id}><button className={`exclusive-button ${isSelected ? 'selected' : ''}`} title={submission ? `${submission.source === 'player' ? 'joueur' : 'admin'} · ${new Date(submission.updatedAt).toLocaleTimeString()}` : inferred ? 'Rang déduit automatiquement' : undefined} onClick={() => onCell(player.id, 'rank', rank)}>{isSelected ? '✓' : '—'}</button><small className="cell-source">{inferred ? 'déduit' : submission?.source === 'admin' ? 'admin' : submission ? 'joueur' : ''}</small></div>; })}
    </MatrixRow>;
  };
  if (!effective) return null;
  return <div className="score-matrix" style={{ '--matrix-players': game.players.length } as React.CSSProperties}><div className="matrix-header"><span>Critère</span>{game.players.map((player) => <strong key={player.id}>{player.name}</strong>)}<span>État</span></div>
    {effective === 'R' && <>{rankRow('first', '1er')}{rankRow('second', '2e')}{rankRow('other', 'Autre')}</>}
    {(effective === 'C' || effective === 'T') && numberRow('Cœurs', 'hearts', game.settings.deck.heartsInPlay, game.settings.deck.heartsInPlay)}
    {(effective === 'D' || effective === 'T') && numberRow('Dames', 'queens', game.settings.deck.queensInPlay, game.settings.deck.queensInPlay)}
    {(effective === 'K' || effective === 'T') && exclusiveRow('Roi de cœur', 'kingOfHearts')}
    {(effective === 'P' || effective === 'T') && numberRow('Plis', 'tricks', game.settings.deck.cardsPerPlayer, game.settings.deck.cardsPerPlayer)}
    {(effective === 'L' || effective === 'T') && exclusiveRow('Dernier pli', 'lastTrick')}
  </div>;
}

function MatrixRow({ label, expected, valid, children }: { label: string; expected: string; valid: boolean; children: React.ReactNode }) {
  return <div className={`matrix-line ${valid ? 'valid' : 'invalid'}`}><strong>{label}</strong>{children}<span className="matrix-state">{expected} {valid ? '✓' : '!'}</span></div>;
}

export function PersonalSubmissionForm({ contract, onSubmit, initial, maxHearts, maxQueens, maxTricks, submitLabel = 'Confirmer ma saisie' }: { contract: Exclude<ContractCode, 'J'>; onSubmit: (values: PlayerSubmission['values']) => void; initial?: PlayerSubmission['values']; maxHearts?: number; maxQueens?: number; maxTricks?: number; submitLabel?: string }) {
  const [values, setValues] = useState<PlayerSubmission['values']>(initial ?? {});
  useEffect(() => setValues(initial ?? {}), [initial]);
  const buttons = (field: 'hearts' | 'queens' | 'tricks', max: number) => <div className="value-buttons mobile-values">{Array.from({ length: max + 1 }, (_, value) => <button type="button" className={values[field] === value ? 'selected' : ''} key={value} onClick={() => setValues({ ...values, [field]: value })}>{value}</button>)}</div>;
  return <form className="result-form mobile-form" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
    {contract === 'R' && <label>Mon arrivée<select required value={values.rank ?? ''} onChange={(e) => setValues({ ...values, rank: e.target.value as 'first' | 'second' | 'other' })}><option value="">Choisir…</option><option value="first">1er</option><option value="second">2e</option><option value="other">Autre</option></select></label>}
    {(contract === 'C' || contract === 'T') && <fieldset><legend>Mes cœurs</legend>{buttons('hearts', maxHearts ?? 14)}</fieldset>}
    {(contract === 'D' || contract === 'T') && <fieldset><legend>Mes dames</legend>{buttons('queens', maxQueens ?? 4)}</fieldset>}
    {(contract === 'P' || contract === 'T') && <fieldset><legend>Mes plis</legend>{buttons('tricks', maxTricks ?? 14)}</fieldset>}
    {(contract === 'K' || contract === 'T') && <label className="check"><input type="checkbox" checked={values.kingOfHearts ?? false} onChange={(e) => setValues({ ...values, kingOfHearts: e.target.checked })} /> J’ai pris le roi de cœur</label>}
    {(contract === 'L' || contract === 'T') && <label className="check"><input type="checkbox" checked={values.lastTrick ?? false} onChange={(e) => setValues({ ...values, lastTrick: e.target.checked })} /> J’ai pris le dernier pli</label>}
    <button className="primary" type="submit">{submitLabel}</button>
  </form>;
}

export function Countdown({ endsAt }: { endsAt?: string }) {
  const [left, setLeft] = useState(0);
  useEffect(() => { const update = () => setLeft(Math.max(0, Math.ceil((new Date(endsAt ?? 0).getTime() - Date.now()) / 1000))); update(); const timer = setInterval(update, 200); return () => clearInterval(timer); }, [endsAt]);
  return <div className="countdown" aria-live="polite">Validation dans <strong>{left}</strong></div>;
}

export function cumulativeRows(game: Game) {
  const totals = Object.fromEntries(game.players.map((player) => [player.id, 0]));
  return game.rounds.filter((round) => round.status === 'validated').map((round) => {
    for (const player of game.players) totals[player.id] += round.scoreDelta[player.id] ?? 0;
    return { x: round.index, ...totals };
  });
}
