import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./i18n"; // Initialize i18next before rendering
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(<App />);
