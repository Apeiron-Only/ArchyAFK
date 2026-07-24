import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#08090c",
          card: "#111318",
          hover: "#191d25",
          border: "#272d38"
        },
        ink: {
          primary: "#ffffff",
          secondary: "#9ea7b8"
        }
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        shell: "0 28px 80px rgba(0, 0, 0, 0.52)",
        panel: "0 18px 40px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
