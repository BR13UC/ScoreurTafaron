import { expect, test } from '@playwright/test';

const gameSnapshot = (roundStatus: 'choosing' | 'in_progress' | 'scoring' = 'in_progress') => ({
  game: {
    id: 'g1', name: 'Soirée', status: 'playing', createdAt: '2026-01-01T20:00:00Z', updatedAt: '2026-01-01T21:00:00Z',
    settings: { playerCount: 3, enabledContracts: ['R', 'C', 'D', 'K', 'P', 'L', 'T', 'J'], turnOrder: ['p1', 'p2', 'p3'], resultEntryMode: 'players', setupStep: 'ready', lowestScoreWins: true, selectedAddress: '192.168.1.10', deck: { mode: 'tarot_suits_auto', suitsCount: 4, ranksPerSuit: 6, keptRanks: ['As', 'Roi', 'Dame', 'Cavalier', 'Valet', '10'], keepInstruction: 'De l’As au 10', cardsUsed: 24, cardsPerPlayer: 8, heartsInPlay: 6, queensInPlay: 4, successStartRank: '10', successStartRankPosition: 6 }, scoring: { successFirst: -100, successSecond: -50, heart: 20, queen: 50, kingOfHearts: 100, trick: 40, lastTrick: 100, bonus: -25 } },
    players: [{ id: 'p1', name: 'Alice', joinedAt: '', connected: true, kind: 'phone' }, { id: 'p2', name: 'Bob', joinedAt: '', connected: true, kind: 'phone' }, { id: 'p3', name: 'Cara', joinedAt: '', connected: true, kind: 'local' }],
    rounds: [{ id: 'r1', index: 1, chooserPlayerId: 'p1', contract: roundStatus === 'choosing' ? undefined : 'C', status: roundStatus, submissions: {}, scoreDelta: {}, bonusApplied: false, chooserSucceeded: false, validationErrors: [], createdAt: '' }],
  }, scores: { p1: 0, p2: 0, p3: 0 }, remainingRounds: 24, currentRoundNumber: 1, totalRounds: 24,
});

test('ouvre l’administration locale', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Tafaron' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer la partie' })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-home.png', fullPage: true });
});

test('affiche, filtre et ouvre les statistiques joueurs', async ({ page }) => {
  await page.route('**/api/stats/players?**', async (route) => route.fulfill({ json: [{ profileId: 'alice', displayName: 'Alice', aliases: ['alice'], active: true, gamesPlayed: 4, wins: 2, winRate: 50, podiums: 3, podiumRate: 75, averagePlacement: 1.75, averageScore: 12.5, bestScore: -20, worstScore: 50 }] }));
  await page.route('**/api/admin/session', async (route) => route.fulfill({ json: { token: 'test' } }));
  await page.route('**/api/stats/identity', async (route) => route.fulfill({ json: { profiles: [], appearances: [] } }));
  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Statistiques des joueurs' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alice' })).toBeVisible();
  await page.getByLabel('Rechercher un joueur').fill('absent');
  await expect(page.getByText(/Aucun joueur/)).toBeVisible();
});

test('affiche le profil, les tendances et les contrats à largeur étroite', async ({ page }) => {
  await page.setViewportSize({ width: 520, height: 900 });
  await page.route('**/api/stats/players/alice?**', async (route) => route.fulfill({ json: {
    summary: { profileId: 'alice', displayName: 'Alice', aliases: ['alice'], active: true, gamesPlayed: 1, wins: 1, winRate: 100, podiums: 1, podiumRate: 100, averagePlacement: 1, averageScore: -25, bestScore: -25, worstScore: -25 },
    games: [{ gameId: 'g1', gameName: 'Soirée', completedAt: '2026-01-02T20:00:00Z', sourcePlayerId: 'p1', sourceName: 'Alice', placement: 1, finalScore: -25, playerCount: 3, participants: ['Alice', 'Bob', 'Cara'], enabledContracts: ['J'], scoring: { successFirst: -100, successSecond: -50, heart: 20, queen: 50, kingOfHearts: 100, trick: 40, lastTrick: 100, bonus: -25 } }],
    contracts: [{ contract: 'J', chooser: { rounds: 1, successes: 1, successRate: 100, bonuses: 1, totalDelta: -25, averageDelta: -25 }, allRound: { rounds: 1, successes: 0, successRate: 0, bonuses: 0, totalDelta: -25, averageDelta: -25 }, jokerBreakdown: { C: { rounds: 1, chooserRounds: 1, totalDelta: -25 } } }],
  } }));
  await page.goto('/stats/players/alice');
  await expect(page.getByRole('heading', { name: 'Alice' })).toBeVisible();
  await expect(page.getByText('Détail du Joker')).toBeVisible();
  await page.getByRole('button', { name: 'Score' }).click();
  await expect(page.getByRole('heading', { name: 'Score final' })).toBeVisible();
});

test('demande la récupération d’un joueur depuis le QR commun', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/games/g1/join-context', (route) => route.fulfill({ json: { mode: 'recover', gameName: 'Soirée', players: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }] } }));
  await page.route('**/api/games/g1/recovery-requests', (route) => route.fulfill({ status: 201, json: { requestId: 'request', secret: 'secret', expiresAt: '2099-01-01T00:00:00Z' } }));
  await page.route('**/api/games/g1/recovery-requests/request', (route) => route.fulfill({ json: { requestId: 'request', state: 'pending', playerName: 'Alice', expiresAt: '2099-01-01T00:00:00Z' } }));
  await page.goto('/join/g1'); await page.getByRole('button', { name: 'Alice' }).click();
  await expect(page.getByRole('heading', { name: 'Demande envoyée' })).toBeVisible();
});

test('affiche tous les contrats et les choix du Joker sans défilement sur téléphone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('tafaron:g1:token', 'token'));
  await page.route('**/api/games/g1/player', (route) => route.fulfill({ json: { gameId: 'g1', gameStatus: 'playing', player: { id: 'p1', name: 'Alice', connected: true }, message: '', round: { id: 'r1', status: 'choosing', chooserName: 'Alice', isChooser: true, contractOptions: ['R', 'C', 'D', 'K', 'P', 'L', 'T', 'J'], usedContracts: ['C'], availableContracts: ['R', 'D', 'K', 'P', 'L', 'T', 'J'], needsSubmission: false, hasSubmission: false, canEditSubmission: false, maxHearts: 6, maxQueens: 4, maxTricks: 8 } } }));
  await page.goto('/join/g1'); await expect(page.locator('.contract-card')).toHaveCount(8); await page.getByRole('button', { name: 'Joker' }).click(); await expect(page.locator('.contract-card')).toHaveCount(8); await expect(page.getByRole('button', { name: 'Pas de cœur' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/contracts-mobile.png', fullPage: true });
});

test('attend le passage en saisie avant de revenir à l’admin', async ({ page }) => {
  let status: 'in_progress' | 'scoring' = 'in_progress'; await page.setViewportSize({ width: 1366, height: 768 });
  await page.route('**/api/games/active', (route) => route.fulfill({ json: gameSnapshot(status) })); await page.route('**/api/admin/session', (route) => route.fulfill({ json: { token: 'admin' } }));
  await page.route('**/api/games/g1', (route) => route.fulfill({ json: gameSnapshot(status) }));
  await page.route('**/api/games/g1/round/scoring', (route) => { status = 'scoring'; return route.fulfill({ json: { ok: true } }); });
  await page.goto('/game'); await expect(page.locator('.chart-end-score')).toHaveCount(3); await expect(page.locator('.compact-ranking li')).toHaveCount(3); await expect(page.locator('.compact-ranking li').first()).toHaveAttribute('style', /background-color/); await page.screenshot({ path: 'test-results/game-1366.png', fullPage: true });
  await page.getByRole('button', { name: 'Calcul des points' }).click(); await expect(page).toHaveURL(/\/admin\?from=game/);
});

test('reste sur le jeu et affiche une erreur si le calcul échoue', async ({ page }) => {
  await page.route('**/api/games/active', (route) => route.fulfill({ json: gameSnapshot() })); await page.route('**/api/admin/session', (route) => route.fulfill({ json: { token: 'admin' } })); await page.route('**/api/games/g1', (route) => route.fulfill({ json: gameSnapshot() }));
  await page.route('**/api/games/g1/round/scoring', (route) => route.fulfill({ status: 400, json: { error: 'Manche déjà fermée.' } }));
  await page.goto('/game'); await page.getByRole('button', { name: 'Calcul des points' }).click(); await expect(page).toHaveURL(/\/game$/); await expect(page.getByRole('alert')).toContainText('Manche déjà fermée');
});

test('montre le QR et les demandes de récupération entre les manches', async ({ page }) => {
  await page.route('**/api/admin/session', (route) => route.fulfill({ json: { token: 'admin' } })); await page.route('**/api/games/active', (route) => route.fulfill({ json: gameSnapshot('choosing') })); await page.route('**/api/games/g1', (route) => route.fulfill({ json: gameSnapshot('choosing') }));
  await page.route('**/api/runtime', (route) => route.fulfill({ json: { port: 3000, addresses: [{ address: '172.24.128.1', label: 'vEthernet (WSL)' }, { address: '192.168.1.10', label: 'Wi-Fi' }] } })); await page.route('**/api/games/g1/qr?**', (route) => route.fulfill({ json: { url: 'http://192.168.1.10:3000/join/g1', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' } }));
  await page.route('**/api/games/g1/recovery-requests', (route) => route.fulfill({ json: [{ requestId: 'r', playerId: 'p2', playerName: 'Bob', state: 'pending', createdAt: '', expiresAt: '2099-01-01T00:00:00Z' }] }));
  await page.goto('/admin?from=game'); await page.getByText('QR et récupération de session').click(); await expect(page.getByText('Bob')).toBeVisible(); await expect(page.getByRole('button', { name: 'Accepter' })).toBeVisible(); await expect(page.locator('.network-link-list a')).toHaveCount(2);
});
