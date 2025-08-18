// @refresh reload
import { mount } from "@solidjs/start/client";
import App from "./app";
import "./index.css";

export default mount(() => <App />, document.getElementById("app")!); 