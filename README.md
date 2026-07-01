# risk-lint

Find risky patterns in JavaScript and TypeScript projects before they reach
production.

`risk-lint` is a small CLI scanner for codebases that move fast, especially
projects with AI-assisted code. It looks for secrets, debug leftovers, weak
TypeScript spots, noisy comments, oversized files, and build or syntax failures.

## Why Use It?

- Catch leaked API keys and committed `.env` files early.
- Spot `console.*` and `debugger` statements before deploy.
- Find TypeScript `any` usage that weakens type safety.
- Surface TODO, FIXME, and HACK comments that may hide unfinished work.
- Detect large source files that are becoming harder to maintain.
- Run the project's build script to catch syntax and build errors.

## Install

Install globally:

```sh
npm install -g risk-lint
```

Or run without installing:

```sh
npx risk-lint
```

## Usage

Run `risk-lint` from the root of your project:

```sh
risk-lint
```

Example output:

```txt
Risk Lint
Scanning project...

✓ Syntax check passed
✓ Scanned 42 files

Findings

HIGH src/api.ts:12:18
│ Possible secret/API key detected

MEDIUM src/App.tsx:34:3
│ Console statement found

Summary
High: 1  Medium: 1  Low: 0
```

If no risky patterns are found, the command prints a clean result.

## What It Checks

| Check | Level |
| --- | --- |
| Possible OpenAI, Google, AWS, and Telegram tokens | High |
| `.env` files | High |
| `debugger` statements | High |
| Build or syntax failures from `npm run build`, `pnpm build`, or `yarn build` | High |
| `console.log`, `console.warn`, `console.error`, and `console.debug` | Medium |
| TypeScript `any` annotations | Medium |
| Files over 500 lines | Medium |
| TODO, FIXME, and HACK comments | Low |

## Ignored Paths

`risk-lint` skips common generated or dependency folders:

- `node_modules`
- `dist`
- `build`
- `.next`
- `.nuxt`
- `.astro`
- `.vercel`
- `.output`
- `coverage`
- `.git`
- `*.d.ts`
- `*.min.js`

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

## License

MIT
