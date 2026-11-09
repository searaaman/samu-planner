import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // Tests run in Indian time: where the app is used and where UTC date bugs show up.
  test: { environment: "jsdom", env: { TZ: "Asia/Kolkata" } }
});
