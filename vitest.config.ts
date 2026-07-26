import { defineConfig } from "vitest/config";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src") };

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**"],
    projects: [
      {
        extends: true,
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["src/lib/__tests__/**/*.test.ts"],
        },
      },
      {
        extends: true,
        resolve: { alias },
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/components/**/*.test.tsx", "src/lib/hooks/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
  resolve: { alias },
});
