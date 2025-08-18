import { Component, Suspense } from 'solid-js';
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import "./index.css";

const App: Component = () => {
  const base = "/ellipses/.output/public/";
  
  return (
    <Router
      base={base}
      root={props => {
        // Normalize the pathname to remove .html extension for routing
        const pathname = props.location.pathname;
        const normalizedPath = pathname.replace(/\.html$/, '');
        
        console.log("Full pathname:", pathname);
        console.log("Normalized for routing:", normalizedPath);
        
        return (
          <Suspense fallback={<div id='loading'>Loading...</div>}>
            <div>
              <div>Debug: Router is working</div>
              <div>Current pathname: {pathname}</div>
              <div>Normalized path: {normalizedPath}</div>
              {props.children}
            </div>
          </Suspense>
        );
      }}
    >
      <FileRoutes />
    </Router>
  );
};

export default App;
