#!/usr/bin/env node

import fg from "fast-glob"
import { execFile, execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import pc from "picocolors"
import { promisify } from "node:util"

type Issue = {
  level: "high" | "medium" | "low"
  file: string
  line: number
  column: number
  message: string
}

const ignore = [
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

const patterns = ["**/*.{js,jsx,ts,tsx,vue,svelte,astro}", ".env", ".env.*"]

const issues: Issue[] = []
const execFileAsync = promisify(execFile)
const spinnerFrames = ["-", "\\", "|", "/"]
const sourceFilePattern = /\.(js|jsx|ts|tsx|vue|svelte|astro)$/

function writeLine(message = "") {
  process.stdout.write(`${message}\n`)
}

function writeError(message: string) {
  process.stderr.write(`${message}\n`)
}

function startSpinner(message: string) {
  if (!process.stdout.isTTY) {
    writeLine(`${pc.cyan("•")} ${message}`)
    return {
      succeed(doneMessage = message) {
        writeLine(`${pc.green("✓")} ${doneMessage}`)
      },
      fail(doneMessage = message) {
        writeLine(`${pc.red("✕")} ${doneMessage}`)
      },
    }
  }

  let index = 0
  process.stdout.write(`${pc.cyan(spinnerFrames[index])} ${message}`)

  const clearLine = () => {
    process.stdout.write("\r\u001b[2K")
  }

  const timer = setInterval(() => {
    index = (index + 1) % spinnerFrames.length
    clearLine()
    process.stdout.write(`${pc.cyan(spinnerFrames[index])} ${message}`)
  }, 90)

  return {
    succeed(doneMessage = message) {
      clearInterval(timer)
      clearLine()
      process.stdout.write(`${pc.green("✓")} ${doneMessage}\n`)
    },
    fail(doneMessage = message) {
      clearInterval(timer)
      clearLine()
      process.stdout.write(`${pc.red("✕")} ${doneMessage}\n`)
    },
  }
}

function getLocation(content: string, index: number) {
  const lines = content.slice(0, index).split("\n")
  const line = lines.length
  const column = lines[lines.length - 1].length + 1

  return { line, column }
}

function addIssue(
  level: Issue["level"],
  file: string,
  message: string,
  line = 1,
  column = 1,
) {
  issues.push({ level, file, line, column, message })
}

function getIssuePath(issue: Issue) {
  return `${issue.file}:${issue.line}:${issue.column}`
}

function formatLevel(level: Issue["level"]) {
  if (level === "high") return pc.red(pc.bold("HIGH"))
  if (level === "medium") return pc.yellow(pc.bold("MEDIUM"))
  return pc.gray(pc.bold("LOW"))
}

function getArgs() {
  return {
    all: process.argv.includes("--all"),
    help: process.argv.includes("--help") || process.argv.includes("-h"),
    init: process.argv.includes("init"),
  }
}

function printHelp() {
  writeLine()
  writeLine(pc.bold("Risk Lint"))
  writeLine()
  writeLine("Usage:")
  writeLine("  risk-lint         Scan changed files only")
  writeLine("  risk-lint --all   Scan the full project and run build syntax check")
  writeLine("  risk-lint init    Add a risk script to package.json")
  writeLine()
}

async function initProject() {
  const packageJsonPath = "package.json"

  if (!(await fileExists(packageJsonPath))) {
    writeError(`${pc.red("Error:")} package.json not found`)
    process.exitCode = 1
    return
  }

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>
  }

  packageJson.scripts ??= {}

  if (packageJson.scripts.risk === "risk-lint") {
    writeLine(`${pc.green("✓")} package.json already has ${pc.bold("risk")}`)
    return
  }

  if (packageJson.scripts.risk) {
    writeError(
      `${pc.yellow("!")} package.json already has a risk script: ${pc.bold(
        packageJson.scripts.risk,
      )}`,
    )
    writeError("Choose another script name or edit package.json manually.")
    process.exitCode = 1
    return
  }

  packageJson.scripts.risk = "risk-lint"

  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
  )

  writeLine(`${pc.green("✓")} Added ${pc.bold('"risk": "risk-lint"')}`)
  writeLine(pc.gray("Run it with: npm run risk"))
}

function runGit(args: string[]) {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function isGitRepo() {
  return runGit(["rev-parse", "--is-inside-work-tree"])[0] === "true"
}

function isIgnored(file: string) {
  const normalized = `/${file.split("\\").join("/")}`

  return ignore.some((pattern) => {
    if (pattern === "**/*.d.ts") return file.endsWith(".d.ts")
    if (pattern === "**/*.min.js") return file.endsWith(".min.js")

    const folder = pattern.split("**/").join("").split("/**").join("")
    return normalized.includes(`/${folder}/`)
  })
}

function isScannableChangedFile(file: string) {
  if (isIgnored(file)) return false
  if (file === ".env" || file.startsWith(".env.")) return true

  return sourceFilePattern.test(file)
}

function getChangedFiles() {
  const files = [
    ...runGit(["diff", "--name-only", "--diff-filter=ACMR"]),
    ...runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]),
    ...runGit(["ls-files", "--others", "--exclude-standard"]),
  ]

  return [...new Set(files)].filter(isScannableChangedFile)
}

function checkSecrets(file: string, content: string) {
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/g,
    /AIza[0-9A-Za-z\-_]{20,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /bot[0-9]{8,}:[a-zA-Z0-9_-]{20,}/g,
  ]

  for (const pattern of secretPatterns) {
    for (const match of content.matchAll(pattern)) {
      const location = getLocation(content, match.index)
      addIssue(
        "high",
        file,
        "Possible secret/API key detected",
        location.line,
        location.column,
      )
    }
  }

  if (file.includes(".env")) {
    addIssue("high", file, ".env file detected. Make sure it is not committed")
  }
}

function checkLogs(file: string, content: string) {
  for (const match of content.matchAll(/console\.(log|warn|error|debug)/g)) {
    const location = getLocation(content, match.index)
    addIssue(
      "medium",
      file,
      "Console statement found",
      location.line,
      location.column,
    )
  }

  for (const match of content.matchAll(/^\s*debugger\s*;?/gm)) {
    const debuggerOffset = match[0].indexOf("debugger")
    const location = getLocation(content, match.index + debuggerOffset)
    addIssue(
      "high",
      file,
      "Debugger statement found",
      location.line,
      location.column,
    )
  }
}

function checkAny(file: string, content: string) {
  for (const match of content.matchAll(/:\s*any\b/g)) {
    const anyOffset = match[0].indexOf("any")
    const location = getLocation(content, match.index + anyOffset)
    addIssue(
      "medium",
      file,
      "TypeScript any usage found",
      location.line,
      location.column,
    )
  }
}

function checkTodos(file: string, content: string) {
  for (const comment of content.matchAll(/\/\/.*|\/\*[\s\S]*?\*\//g)) {
    for (const match of comment[0].matchAll(/\b(TODO|FIXME|HACK)\b/g)) {
      const location = getLocation(content, comment.index + match.index)
      addIssue(
        "low",
        file,
        `${match[0]} comment found`,
        location.line,
        location.column,
      )
    }
  }
}

function checkLargeFile(file: string, content: string) {
  const lines = content.split("\n").length

  if (lines > 500) {
    addIssue("medium", file, `Large file: ${lines} lines`, 501, 1)
  }
}

function collectDeclaredNames(frontmatter: string) {
  const declared = new Set<string>()

  for (const match of frontmatter.matchAll(
    /\b(?:const|let|var|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    declared.add(match[1])
  }

  for (const match of frontmatter.matchAll(
    /\b(?:const|let|var)\s+\{([^}]+)\}/g,
  )) {
    for (const name of match[1].split(",")) {
      const cleanName = name
        .trim()
        .split(":")
        .pop()
        ?.trim()
        .match(/^[A-Za-z_$][\w$]*/)

      if (cleanName) declared.add(cleanName[0])
    }
  }

  for (const match of frontmatter.matchAll(
    /\bimport\s+([A-Za-z_$][\w$]*)\b/g,
  )) {
    declared.add(match[1])
  }

  for (const match of frontmatter.matchAll(/\bimport\s+\{([^}]+)\}/g)) {
    for (const name of match[1].split(",")) {
      const cleanName = name
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
        .match(/^[A-Za-z_$][\w$]*/)

      if (cleanName) declared.add(cleanName[0])
    }
  }

  return declared
}

function collectTemplateScopedNames(template: string) {
  const scoped = new Set<string>()

  for (const match of template.matchAll(/\(\s*\[([^\]]+)\]\s*\)\s*=>/g)) {
    for (const name of match[1].split(",")) {
      const cleanName = name.trim().match(/^[A-Za-z_$][\w$]*/)

      if (cleanName) scoped.add(cleanName[0])
    }
  }

  for (const match of template.matchAll(
    /\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>/g,
  )) {
    scoped.add(match[1])
  }

  for (const match of template.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) {
    scoped.add(match[1])
  }

  return scoped
}

function checkAstroTemplateIdentifiers(file: string, content: string) {
  if (!file.endsWith(".astro")) return

  const sections = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!sections) return

  const frontmatter = sections[1]
  const template = sections[2]
  const templateOffset = sections[0].length - template.length
  const declared = collectDeclaredNames(frontmatter)
  const scoped = collectTemplateScopedNames(template)
  const allowed = new Set([
    "Astro",
    "Array",
    "Boolean",
    "Date",
    "JSON",
    "Math",
    "Number",
    "Object",
    "String",
    "false",
    "null",
    "true",
    "undefined",
  ])

  for (const match of template.matchAll(/\{([^{}]+)\}/g)) {
    const expression = match[1].trim()

    if (!/^[A-Za-z_$][\w$]*$/.test(expression)) continue
    if (allowed.has(expression) || declared.has(expression) || scoped.has(expression)) {
      continue
    }

    const location = getLocation(content, templateOffset + match.index + 1)
    addIssue(
      "high",
      file,
      `Possible undefined Astro template variable: ${expression}`,
      location.line,
      location.column,
    )
  }
}

function checkAstroFrontmatterIdentifiers(file: string, content: string) {
  if (!file.endsWith(".astro")) return

  const sections = content.match(/^---\n([\s\S]*?)\n---/)
  if (!sections) return

  const frontmatter = sections[1]
  const frontmatterOffset = content.indexOf(frontmatter)
  const declared = collectDeclaredNames(frontmatter)
  const allowed = new Set([
    "Astro",
    "console",
    "false",
    "null",
    "true",
    "undefined",
  ])

  for (const match of frontmatter.matchAll(
    /^\s*([A-Za-z_$][\w$]*)\s*;?\s*$/gm,
  )) {
    const name = match[1]

    if (allowed.has(name) || declared.has(name)) continue
    if (/^(import|export|const|let|var|type|interface|function|class)$/.test(name)) {
      continue
    }

    const location = getLocation(
      content,
      frontmatterOffset + match.index + match[0].indexOf(name),
    )
    addIssue(
      "high",
      file,
      `Possible stray Astro frontmatter identifier: ${name}`,
      location.line,
      location.column,
    )
  }
}

async function fileExists(file: string) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function getPackageManager() {
  if (await fileExists("pnpm-lock.yaml")) return "pnpm"
  if (await fileExists("yarn.lock")) return "yarn"
  return "npm"
}

function parseBuildLocation(output: string) {
  const locationMatch = output.match(/Location:\s*\n\s*([^:\n]+):(\d+):(\d+)/)

  if (locationMatch) {
    return {
      file: locationMatch[1].replace(`${process.cwd()}/`, ""),
      line: Number(locationMatch[2]),
      column: Number(locationMatch[3]),
    }
  }

  const fileLocationMatch = output.match(
    /((?:\.\/|\/)?[^\s:]+?\.(?:astro|js|jsx|ts|tsx|vue|svelte)):(\d+):(\d+)/,
  )

  if (fileLocationMatch) {
    return {
      file: fileLocationMatch[1].replace(`${process.cwd()}/`, ""),
      line: Number(fileLocationMatch[2]),
      column: Number(fileLocationMatch[3]),
    }
  }

  return {
    file: "package.json",
    line: 1,
    column: 1,
  }
}

function parseBuildMessage(output: string) {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    lines.find((line) =>
      /Expected|Unexpected|SyntaxError|Parse error/i.test(line),
    ) ||
    lines.find((line) => line.includes("[ERROR]")) ||
    "Project build failed"
  )
}

async function checkBuildSyntax(files?: string[]) {
  const packageManager = await getPackageManager()
  const args = packageManager === "yarn" ? ["build"] : ["run", "build"]
  const changedFiles = files ? new Set(files) : undefined

  try {
    await execFileAsync(packageManager, args, {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
    })
  } catch (error) {
    const execError = error as {
      stdout?: string
      stderr?: string
      killed?: boolean
    }
    const output = `${execError.stdout || ""}\n${execError.stderr || ""}`
    const location = parseBuildLocation(output)
    const message = execError.killed
      ? "Project build timed out while checking syntax"
      : parseBuildMessage(output)

    if (changedFiles && !changedFiles.has(location.file)) {
      return
    }

    addIssue("high", location.file, message, location.line, location.column)
  }
}

async function main() {
  const args = getArgs()

  if (args.help) {
    printHelp()
    return
  }

  if (args.init) {
    await initProject()
    return
  }

  const scanAll = args.all || !isGitRepo()

  writeLine()
  writeLine(pc.bold("Risk Lint"))
  writeLine(
    pc.gray(scanAll ? "Scanning project..." : "Scanning changed files..."),
  )
  writeLine()

  const files = scanAll
    ? await fg(patterns, {
        ignore,
        dot: true,
        onlyFiles: true,
      })
    : getChangedFiles()

  if (scanAll || files.length > 0) {
    const buildSpinner = startSpinner(
      scanAll ? "Checking project syntax" : "Checking changed file syntax",
    )
    await checkBuildSyntax(scanAll ? undefined : files)
    const buildIssues = issues.filter(
      (issue) =>
        issue.message.includes("build") ||
        /Expected|Unexpected|SyntaxError|Parse error/i.test(issue.message),
    )

    if (buildIssues.length > 0) {
      buildSpinner.fail("Syntax check found issues")
    } else {
      buildSpinner.succeed("Syntax check passed")
    }
  }

  const scanSpinner = startSpinner(
    scanAll ? "Scanning source files" : "Scanning changed files",
  )

  for (const file of files) {
    const content = await fs.readFile(file, "utf8")

    checkSecrets(file, content)
    checkLogs(file, content)
    checkAny(file, content)
    checkTodos(file, content)
    checkLargeFile(file, content)
    checkAstroTemplateIdentifiers(file, content)
    checkAstroFrontmatterIdentifiers(file, content)
  }
  scanSpinner.succeed(
    scanAll
      ? `Scanned ${files.length} files`
      : `Scanned ${files.length} changed files`,
  )

  if (!scanAll && files.length === 0) {
    writeLine()
    writeLine(`${pc.green(pc.bold("Clean"))} No changed files to scan`)
    return
  }

  if (issues.length === 0) {
    writeLine()
    writeLine(`${pc.green(pc.bold("Clean"))} No risky patterns found`)
    return
  }

  const high = issues.filter((i) => i.level === "high")
  const medium = issues.filter((i) => i.level === "medium")
  const low = issues.filter((i) => i.level === "low")

  writeLine()
  writeLine(pc.bold("Findings"))
  writeLine()

  for (const issue of issues) {
    writeLine(`${formatLevel(issue.level)} ${pc.bold(getIssuePath(issue))}`)
    writeLine(`${pc.gray("│")} ${issue.message}`)
    writeLine()
  }

  writeLine(pc.bold("Summary"))
  writeLine(
    `${pc.red(`High: ${high.length}`)}  ${pc.yellow(
      `Medium: ${medium.length}`,
    )}  ${pc.gray(`Low: ${low.length}`)}`,
  )
}

main().catch((error) => {
  writeError(`${pc.red("Error:")} ${error}`)
  process.exit(1)
})
