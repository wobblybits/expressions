import { Component, Suspense, lazy } from 'solid-js';
import { Router, Route } from "@solidjs/router";
import "./index.css";
import IndexPage from "./routes/index";
import CameraPage from "./routes/camera";
import ArithmeticPage from "./routes/arithmetic";

const PareidoliaPage = lazy(() => import("./routes/pareidolia"));
const TransferencePage = lazy(() => import("./routes/transference"));

const App: Component = () => {
  const base = "/ellipses/.output/public";
  
  console.log("App component rendering with base:", base);
  console.log("NODE_ENV:", import.meta.env.NODE_ENV);
  console.log("Is server:", typeof window === 'undefined');
  
  return (
    <Router
      base={base}
      root={props => {
        const pathname = props.location.pathname;
        const stripped = pathname.replace(base, '');
        
        console.log("=== ROUTE DEBUG ===");
        console.log("Full pathname:", pathname);
        console.log("Stripped path:", `"${stripped}"`);
        console.log("Children:", props.children);
        
        // Import and test route components directly
        const isIndex = stripped === '' || stripped === '/';
        
        return (
          <Suspense fallback={<div id='loading'>Loading...</div>}>
            {props.children}
          </Suspense>
        );
      }}
    >
      <Route path="/" component={IndexPage} />
      <Route path="/camera" component={CameraPage} />
      <Route path="/arithmetic" component={ArithmeticPage} />
      <Route path="/pareidolia" component={PareidoliaPage} />
      <Route path="/transference" component={TransferencePage} />
    </Router>
  );
};

export default App;
