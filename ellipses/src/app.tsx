import { Component, Suspense } from 'solid-js';
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import "./index.css";

const App: Component = () => {
  return (
    <Router
      root={props => (
        <Suspense fallback={<div>Loading...</div>}>
          {props.children}
        </Suspense>
      )}
    >
      <FileRoutes />
    </Router>
  );
}

export default App; 