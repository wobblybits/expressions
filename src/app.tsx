import { Component, Suspense, lazy } from 'solid-js';
import { Router, Route } from "@solidjs/router";
import "./index.css";
import IndexPage from "./routes/index";
import CameraPage from "./routes/camera";
import ArithmeticPage from "./routes/arithmetic";

const PareidoliaPage = lazy(() => import("./routes/pareidolia"));
const TransferencePage = lazy(() => import("./routes/transference"));

const App: Component = () => {
  // Use DEPLOYMENT_TARGET instead of NODE_ENV
  const target = import.meta.env.DEPLOYMENT_TARGET || "development";
  const base = target === "production" 
    ? "/expressions/" 
    : target === "local" 
    ? "/ellipses/.output/public/"
    : ""; // development

  if (target !== "production") {
    console.log("App component rendering with base:", base);
    console.log("Deployment target:", target);
  }
  
  return (
    <Router base={base}>
      <Route path="/" component={IndexPage} />
      <Route path="/camera" component={CameraPage} />
      <Route path="/arithmetic" component={ArithmeticPage} />
      <Route path="/pareidolia" component={PareidoliaPage} />
      <Route path="/transference" component={TransferencePage} />
    </Router>
  );
};

export default App;