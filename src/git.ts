import { execFileSync } from "node:child_process"
import { ignore, sourceFilePattern } from "./config.js"

export function runGit(args: string[]) {
  try {
    return execFileSync("git", args, { encoding: "utf8" })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export function isGitRepo() {
  return runGit(["rev-parse", "--is-inside-work-tree"])[0] === "true"
}

export function isIgnored(file: string) {
  const normalized = `/${file.split("\\").join("/")}`

  return ignore.some((pattern) => {
    if (pattern === "**/*.d.ts") return file.endsWith(".d.ts")
    if (pattern === "**/*.min.js") return file.endsWith(".min.js")

    const folder = pattern.split("**/").join("").split("/**").join("")
    return normalized.includes(`/${folder}/`)
  })
}

export function isScannableChangedFile(file: string) {
  if (isIgnored(file)) return false
  if (file === ".env" || file.startsWith(".env.")) return true

  return sourceFilePattern.test(file)
}

export function getChangedFiles() {
  const files = [
    ...runGit(["diff", "--name-only", "--diff-filter=ACMR"]),
    ...runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]),
    ...runGit(["ls-files", "--others", "--exclude-standard"]),
  ]

  return [...new Set(files)].filter(isScannableChangedFile)
}
