import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f7f5",
          100: "#dce9e3",
          500: "#2f6b56",
          700: "#1f4a3b"
        }
      }
    }
  },
  plugins: []
};

export default config;
