import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Refueling from './pages/Refueling';
import Maintenance from './pages/Maintenance';
import DailyReport from './pages/DailyReport';
import RequestMaintenance from './pages/RequestMaintenance';
import Vehicles from './pages/Vehicles';
import Journeys from './pages/Journeys';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/refueling" element={<Refueling />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/journeys" element={<Journeys />} />
        <Route path="/daily-report" element={<DailyReport />} />
        <Route path="/request-maintenance" element={<RequestMaintenance />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
