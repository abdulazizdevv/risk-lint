# risk-lint

<p align="center">
  <img src="https://img.shields.io/badge/risk--lint-code%20safety-ff4757?style=for-the-badge" alt="risk-lint badge">
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript ready">
  <img src="https://img.shields.io/badge/CLI-fast-2ed573?style=for-the-badge&logo=gnubash&logoColor=white" alt="Fast CLI">
  <img src="https://img.shields.io/badge/license-MIT-ffa502?style=for-the-badge" alt="MIT license">
</p>

<p align="center">
  <strong>Catch risky JavaScript and TypeScript code before it reaches production.</strong>
</p>

<p align="center">
  A tiny CLI scanner for fast-moving projects, AI-assisted codebases, and teams
  that want quick safety checks before commit, review, or deploy.
</p>

---

## What Is risk-lint?

`risk-lint` scans JavaScript and TypeScript projects for risky patterns such as
leaked secrets, debug leftovers, weak TypeScript usage, noisy comments,
oversized files, and build failures.

By default it focuses on files changed in git, so it stays fast and useful in
daily development.

## Quick Start

Run without installing:

```sh
npx risk-lint
```

Or install globally:

```sh
npm install -g risk-lint
risk-lint
```

Add a reusable npm script to your project:

```sh
npx risk-lint init
npm run risk
```

Scan the whole project:

```sh
risk-lint --all
```

## Why Use It?

| Signal | What it helps catch |
| --- | --- |
| High-risk secrets | API keys, tokens, and committed `.env` files |
| Debug leftovers | `debugger` and `console.*` calls before deploy |
| TypeScript weak spots | `any` usage that can hide bugs |
| Unfinished work | TODO, FIXME, and HACK comments |
| Maintainability drift | Source files growing past 500 lines |
| Build confidence | Syntax and build failures from your package scripts |

## Example Output

<table>
  <tr>
    <td colspan="3">
      <strong>Risk Lint</strong><br>
      <sub>Scanning project...</sub>
    </td>
  </tr>
  <tr>
    <td colspan="3">
      <span style="color:#2ed573;">✓ Syntax check passed</span><br>
      <span style="color:#2ed573;">✓ Scanned 42 files</span>
    </td>
  </tr>
  <tr>
    <th align="left">Level</th>
    <th align="left">Location</th>
    <th align="left">Finding</th>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/HIGH-ff4757?style=flat-square" alt="High"></td>
    <td><code>src/api.ts:12:18</code></td>
    <td>Possible secret/API key detected</td>
  </tr>
  <tr>
    <td><img src="https://img.shields.io/badge/MEDIUM-ffa502?style=flat-square" alt="Medium"></td>
    <td><code>src/App.tsx:34:3</code></td>
    <td>Console statement found</td>
  </tr>
  <tr>
    <td colspan="3">
      <strong>Summary</strong><br>
      <img src="https://img.shields.io/badge/High-1-ff4757?style=flat-square" alt="High 1">
      <img src="https://img.shields.io/badge/Medium-1-ffa502?style=flat-square" alt="Medium 1">
      <img src="https://img.shields.io/badge/Low-0-2ed573?style=flat-square" alt="Low 0">
    </td>
  </tr>
</table>

Clean project? You get a clean result and can move on.

## Checks

| Level | Check |
| --- | --- |
| High | Possible OpenAI, Google, AWS, and Telegram tokens |
| High | `.env` files |
| High | `debugger` statements |
| High | Build or syntax failures from `npm run build`, `pnpm build`, or `yarn build` |
| Medium | `console.log`, `console.warn`, `console.error`, and `console.debug` |
| Medium | TypeScript `any` annotations |
| Medium | Files over 500 lines |
| Low | TODO, FIXME, and HACK comments |

## CLI Usage

```sh
# Scan changed files only
risk-lint

# Scan the entire project
risk-lint --all

# Use through npm without installing
npx risk-lint

# Add "risk": "risk-lint" to package.json scripts
npx risk-lint init
```

## Ignored Paths

`risk-lint` skips common generated, dependency, and build folders:

```txt
node_modules
dist
build
.next
.nuxt
.astro
.vercel
.output
coverage
.git
*.d.ts
*.min.js
```

## CI Example

Add a script to your `package.json`:

```json
{
  "scripts": {
    "risk": "risk-lint"
  }
}
```

Then run it in CI:

```sh
npm run risk
```

## Local Development

```sh
npm install
npm run build
npm start
```

Run the TypeScript source directly while developing:

```sh
npm run dev
```

Scan the full project while developing:

```sh
npm run dev -- --all
```

## Publishing

Before publishing to npm:

```sh
npm install
npm run build
npm pack --dry-run
npm publish
```

The package publishes the compiled `dist` folder, this README, and the MIT
license.

## Feedback

Have an idea or found a bug?

- 🐛 Open an [Issue](https://github.com/abdulazizdevv/risk-lint/issues)
- 💡 Start a [Discussion](https://github.com/abdulazizdevv/risk-lint/discussions)
- ⭐ Star the project if it helps you

Contributions are always welcome.

## License

MIT
