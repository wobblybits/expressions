// @refresh reload
import { mount } from "@solidjs/start/client";
import "./index.css";

console.log("entry-client.tsx is being executed");

const mountApp = () => {
  console.log("Client entry point is running!");
  
  // Debug: Check if the app element exists
  const appElement = document.getElementById("app");
  console.log("App element:", appElement);
  
  // Debug: Check what's in the app element
  console.log("App element innerHTML:", appElement?.innerHTML);
  
  try {
    console.log("About to test App import");
    
    // Test if we can import App without errors
    import("./app").then(({ default: App }) => {
      console.log("App imported successfully:", App);
      
      // Try mounting the App component
      console.log("About to mount App component");
      mount(() => <App />, appElement!);
      console.log("App component mounted successfully");
      
      // Debug: Check what's in the app element after mounting
      setTimeout(() => {
        console.log("App element after 100ms:", appElement?.innerHTML);
        console.log("App element children:", appElement?.children);
      }, 100);
      
    }).catch((error) => {
      console.error("Error importing App:", error);
    });
    
  } catch (error) {
    console.error("Error in mountApp:", error);
  }
};

mountApp();

export default mountApp; 