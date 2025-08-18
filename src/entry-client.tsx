// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import "./index.css";

const mountApp = () => {
  mount(() => <StartClient />, document.getElementById("app")!);
};

export default mountApp; 