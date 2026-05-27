import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PublicDashboard from './pages/PublicDashboard';
import CRTracker from './pages/CRTracker';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <Router>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#16161c',
            color: '#f5f5f7',
            border: '1px solid #22222d',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9rem',
            borderRadius: '8px'
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#16161c'
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#16161c'
            }
          }
        }}
      />
      <Routes>
        <Route path="/" element={<PublicDashboard />} />
        <Route path="/cr-tracker" element={<CRTracker />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}

export default App;
