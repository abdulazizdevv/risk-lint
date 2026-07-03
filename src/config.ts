export const ignore = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.astro/**",
  "**/.vercel/**",
  "**/.output/**",
  "**/coverage/**",
  "**/.git/**",
  "**/*.d.ts",
  "**/*.min.js",
]

export const patterns = ["**/*.{js,jsx,ts,tsx,vue,svelte,astro}", ".env", ".env.*"]

export const sourceFilePattern = /\.(js|jsx|ts|tsx|vue|svelte|astro)$/

export const buildErrorPattern =
  /Invalid|Expected|Unexpected|SyntaxError|Parse error|unmatched|at-rule|selector expected/i
