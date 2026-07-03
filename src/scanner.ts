import fg from "fast-glob"
import fs from "node:fs/promises"
import { ignore, patterns } from "./config.js"
import { checkFile } from "./checks.js"
import { getChangedFiles, isGitRepo } from "./git.js"

export async function getFilesToScan(scanAllFlag: boolean) {
  const scanAll = scanAllFlag || !isGitRepo()
  const files = scanAll
    ? await fg(patterns, {
        ignore,
        dot: true,
        onlyFiles: true,
      })
    : getChangedFiles()

  return { scanAll, files }
}

export async function scanFiles(files: string[]) {
  const issues = []

  for (const file of files) {
    const content = await fs.readFile(file, "utf8")
    issues.push(...checkFile(file, content))
  }

  return issues
}
