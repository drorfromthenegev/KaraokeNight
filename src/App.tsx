import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { MCView } from './pages/MCView';
import { DisplayView } from './pages/DisplayView';
import { PartyView } from './pages/PartyView';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mc/:partyId" element={<MCView />} />
        <Route path="/display/:partyId" element={<DisplayView />} />
        <Route path="/party" element={<PartyView />} />
      </Routes>
    </Router>
  );
}

export default App;