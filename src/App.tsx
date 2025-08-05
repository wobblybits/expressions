import type { Component } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import GamePage from './pages/GamePage';
import CompositePage from './pages/CompositePage';
import PareidoliaPage from './pages/PareidoliaPage';
import CameraPage from './pages/CameraPage';

const App: Component = () => {
  return (
    <Router>
      <Route path="/" component={GamePage} />
      <Route path="/game" component={GamePage} />
      <Route path="/pareidolia" component={PareidoliaPage} />
      <Route path="/camera" component={CameraPage} />
    </Router>
  );
}

export default App;
