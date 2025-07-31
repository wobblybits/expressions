import type { Component } from 'solid-js';
import { Router, Route } from '@solidjs/router';
import GamePage from './pages/GamePage';
import CompositePage from './pages/CompositePage';
import PareidoliaPage from './pages/PareidoliaPage';

const App: Component = () => {
  return (
    <Router>
      <Route path="/" component={GamePage} />
      <Route path="/game" component={GamePage} />
      <Route path="/pareidolia" component={PareidoliaPage} />
    </Router>
  );
}

export default App;
