import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#edf7f3",
          100: "#d4ebe3",
          500: "#1f6f5c",
          700: "#195847"
        }
      }
    }
  },
  plugins: [typography]
};

export default config;
