import { Component, lazy } from 'solid-js';
import { Router, Route } from "@solidjs/router";
import "./index.css";
import IndexRoute from "./routes/index";
import CameraRoute from "./routes/camera";
import ArithmeticRoute from "./routes/arithmetic";
import SynthRoute from "./routes/synth"
import PareidoliaRoute from "./routes/pareidolia";
import TransferenceRoute from "./routes/transference";

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
      <Route path="/" component={IndexRoute} />
      <Route path="/camera" component={CameraRoute} />
      <Route path="/arithmetic" component={ArithmeticRoute} />
      <Route path="/pareidolia" component={PareidoliaRoute} />
      <Route path="/transference" component={TransferenceRoute} />
      <Route path="/synth" component={SynthRoute} />
    </Router>
  );
};

export default App;