import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, "index.html"),
                "integration-tests": resolve(__dirname, "integration-tests.html"),
                "nightly-runs": resolve(__dirname, "nightly-runs.html"),
                "performance-dashboard": resolve(__dirname, "performance-dashboard.html"),
                "msbench-nightly-runs": resolve(__dirname, "msbench-nightly-runs.html"),
            },
        },
        outDir: "dist",
    },
    server: {
        proxy: {
            "/api": "http://localhost:7071",
        },
    },
});
