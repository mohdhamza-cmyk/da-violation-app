import { createRoot } from "react-dom/client";
// App.generated.tsx is synced from ../frontend/src/App.tsx by `npm run sync`
// (gitignored) so the harness always tests the real source with correct module
// resolution — no committed duplication.
import App from "./App.generated";
createRoot(document.getElementById("root")!).render(<App />);
