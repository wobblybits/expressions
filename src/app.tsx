import { Component, Suspense } from 'solid-js';
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import "./index.css";

const App: Component = () => {
  return (
    <Router
      base={import.meta.env.SERVER_BASE_URL}
      root={props => (
        <Suspense fallback={<div id='loading'>Loading...</div>}>
          {props.children}
        </Suspense>
      )}
    >
      <FileRoutes />
    </Router>
  );
}

export default App;
