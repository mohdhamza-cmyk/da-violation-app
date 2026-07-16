import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Builds the real app source (../frontend/src/App.tsx) so the QA harness always
// tests the actual code, never a copy.
export default defineConfig({ plugins: [react()] });
