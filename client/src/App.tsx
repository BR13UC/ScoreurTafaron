import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { GamePage } from './pages/GamePage';
import { TablesPage } from './pages/TablesPage';
import { JoinPage } from './pages/JoinPage';
import { HistoryPage } from './pages/HistoryPage';
import { PlayerStatsPage, StatsPage } from './pages/StatsPage';

export function App() {
  return <Routes><Route path="/" element={<Navigate to="/admin" replace />} /><Route path="/admin" element={<AdminPage />} /><Route path="/game" element={<GamePage />} /><Route path="/tables" element={<TablesPage />} /><Route path="/history" element={<HistoryPage />} /><Route path="/stats" element={<StatsPage />} /><Route path="/stats/players/:profileId" element={<PlayerStatsPage />} /><Route path="/join/:gameId" element={<JoinPage />} /><Route path="*" element={<Navigate to="/admin" replace />} /></Routes>;
}
