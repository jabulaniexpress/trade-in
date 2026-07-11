import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    // Relative asset paths so the build works both at
    // jabulaniexpress.github.io/trade-in/ and on a custom domain.
    base: "./",
    plugins: [react(), tailwindcss()],
});
