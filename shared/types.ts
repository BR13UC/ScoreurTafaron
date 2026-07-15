export const CONTRACT_CODES = ['R', 'C', 'D', 'K', 'P', 'L', 'T', 'J'] as const;
export type ContractCode = (typeof CONTRACT_CODES)[number];
export type EffectiveContractCode = Exclude<ContractCode, 'J'>;

export const CONTRACT_LABELS: Record<ContractCode, string> = {
  R: 'Réussite', C: 'Pas de cœur', D: 'Pas de dames', K: 'Pas le roi de cœur',
  P: 'Pas de plis', L: 'Pas le dernier pli', T: 'Tafaron', J: 'Joker',
};

export const RANKS = ['As', 'Roi', 'Dame', 'Cavalier', 'Valet', '10', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type RankLabel = (typeof RANKS)[number];
export type GameStatus = 'setup' | 'waiting_players' | 'playing' | 'finished' | 'archived';
export type RoundStatus = 'choosing' | 'in_progress' | 'scoring' | 'countdown' | 'validated';
export type SetupStep = 'settings' | 'cards' | 'ready';

export interface DeckSettings {
  mode: 'tarot_suits_auto' | 'custom_ranks_per_suit';
  suitsCount: 4;
  ranksPerSuit: number;
  keptRanks: RankLabel[];
  keepInstruction: string;
  cardsUsed: number;
  cardsPerPlayer: number;
  heartsInPlay: number;
  queensInPlay: number;
  successStartRank: RankLabel;
  successStartRankPosition: number;
}

export interface ScoringSettings {
  successFirst: number;
  successSecond: number;
  heart: number;
  queen: number;
  kingOfHearts: number;
  trick: number;
  lastTrick: number;
  bonus: number;
}

export interface GameSettings {
  playerCount: number;
  enabledContracts: ContractCode[];
  deck: DeckSettings;
  scoring: ScoringSettings;
  turnOrder: string[];
  resultEntryMode: 'organizer' | 'players';
  setupStep: SetupStep;
  selectedAddress?: string;
  lowestScoreWins: true;
}

export interface Player {
  id: string;
  name: string;
  joinedAt: string;
  connected: boolean;
  kind: 'phone' | 'local';
  tokenHash?: string;
}

export interface RoundResult {
  firstPlayerId?: string;
  secondPlayerId?: string;
  heartsByPlayer?: Record<string, number>;
  queensByPlayer?: Record<string, number>;
  tricksByPlayer?: Record<string, number>;
  kingOfHeartsPlayerId?: string;
  lastTrickPlayerId?: string;
}

export interface PlayerSubmission {
  playerId: string;
  values: {
    rank?: 'first' | 'second' | 'other';
    hearts?: number;
    queens?: number;
    tricks?: number;
    kingOfHearts?: boolean;
    lastTrick?: boolean;
  };
  submittedAt: string;
  updatedAt: string;
  source: 'player' | 'admin';
  revision: number;
}

export interface Round {
  id: string;
  index: number;
  chooserPlayerId: string;
  contract?: ContractCode;
  jokerContract?: EffectiveContractCode;
  status: RoundStatus;
  result?: RoundResult;
  submissions: Record<string, PlayerSubmission>;
  scoreDelta: Record<string, number>;
  bonusApplied: boolean;
  chooserSucceeded: boolean;
  validationErrors: string[];
  createdAt: string;
  validatedAt?: string;
  correctedAt?: string;
  countdownEndsAt?: string;
}

export interface Game {
  id: string;
  name?: string;
  status: GameStatus;
  statusBeforeArchive?: Exclude<GameStatus, 'archived'>;
  finishedReason?: 'complete' | 'early';
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  settings: GameSettings;
  players: Player[];
  rounds: Round[];
}

export type ScoreMap = Record<string, number>;

export interface GameSnapshot {
  game: Game;
  scores: ScoreMap;
  remainingRounds: number;
  currentRoundNumber: number;
  totalRounds: number;
}

export interface JoinContext {
  mode: 'join' | 'recover' | 'closed';
  gameName?: string;
  players: Array<Pick<Player, 'id' | 'name'>>;
}

export type RecoveryRequestState = 'pending' | 'approved' | 'rejected' | 'expired';

export interface RecoveryRequestCreated {
  requestId: string;
  secret: string;
  expiresAt: string;
}

export interface RecoveryRequestStatus {
  requestId: string;
  state: RecoveryRequestState;
  playerName: string;
  expiresAt: string;
}

export interface RecoveryAdminRequest extends Omit<RecoveryRequestStatus, 'state'> {
  playerId: string;
  state: Extract<RecoveryRequestState, 'pending' | 'approved'>;
  createdAt: string;
}

export interface PlayerView {
  gameId: string;
  gameStatus: GameStatus;
  player: Pick<Player, 'id' | 'name' | 'connected'>;
  message: string;
  round?: {
    id: string;
    status: RoundStatus;
    chooserName: string;
    isChooser: boolean;
    contract?: ContractCode;
    jokerContract?: EffectiveContractCode;
    contractOptions?: ContractCode[];
    usedContracts?: ContractCode[];
    availableContracts?: ContractCode[];
    needsSubmission: boolean;
    hasSubmission: boolean;
    canEditSubmission: boolean;
    submissionValues?: PlayerSubmission['values'];
    maxHearts: number;
    maxQueens: number;
    maxTricks: number;
  };
}
