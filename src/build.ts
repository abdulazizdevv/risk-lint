import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import { promisify } from "node:util"
import { buildErrorPattern } from "./config.js"
import { getPackageManager } from "./project.js"
import type { Issue, Location } from "./types.js"

const execFileAsync = promisify(execFile)

function normalizeBuildFilePath(file: string) {
  const normalized = file
    .split("?")[0]
    .replace(`${process.cwd()}/`, "")
    .replace(/^\.\//, "")

  const sourceIndex = normalized.indexOf("src/")
  if (sourceIndex >= 0) return normalized.slice(sourceIndex)

  return normalized
}

function parseBuildLocations(output: string) {
  const locations: Location[] = []
  const locationMatch = output.match(/Location:\s*\n\s*([^:\n]+):(\d+):(\d+)/)

  if (locationMatch) {
    locations.push({
      file: normalizeBuildFilePath(locationMatch[1]),
      line: Number(locationMatch[2]),
      column: Number(locationMatch[3]),
    })
  }

  const locationPatterns = [
    /file:\s*([^\n:]+?\.(?:astro|js|jsx|ts|tsx|vue|svelte)(?:\?[^\n:]*)?):(\d+):(\d+)/g,
    /((?:\.\/|\/)?[^\s:]+?\.(?:astro|js|jsx|ts|tsx|vue|svelte)(?:\?[^\s:]*)?):(\d+):(\d+)/g,
    /([^\s()]+?\.(?:astro|js|jsx|ts|tsx|vue|svelte))\s*\((\d+):(\d+)\)/g,
    /([^\s]+?\.(?:astro|js|jsx|ts|tsx|vue|svelte))\s+(\d+):(\d+)/g,
  ]

  for (const pattern of locationPatterns) {
    for (const match of output.matchAll(pattern)) {
      locations.push({
        file: normalizeBuildFilePath(match[1]),
        line: Number(match[2]),
        column: Number(match[3]),
      })
    }
  }

  if (locations.length > 0) return locations

  return [{
    file: "package.json",
    line: 1,
    column: 1,
  }]
}

function parseBuildMessage(output: string) {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    lines.find((line) => buildErrorPattern.test(line)) ||
    lines.find((line) => /^Error:/i.test(line)) ||
    lines.find((line) => line.includes("[ERROR]")) ||
    "Project build failed"
  )
}

function isVueStyleBuildError(output: string, file: string) {
  return (
    file.endsWith(".vue") &&
    /vue&type=style|root stylesheet|\[vite:css\]|\[sass\]/i.test(output)
  )
}

async function mapVueStyleLocation(output: string, location: Location) {
  if (!isVueStyleBuildError(output, location.file)) return location

  try {
    const content = await fs.readFile(location.file, "utf8")
    const beforeStyle = content.match(/^[\s\S]*?<style\b[^>]*>\n?/)
    if (!beforeStyle) return location

    const styleStartLine = beforeStyle[0].split("\n").length

    return {
      ...location,
      line: styleStartLine + location.line - 1,
    }
  } catch {
    return location
  }
}

export async function checkBuildSyntax(files?: string[]) {
  const packageManager = await getPackageManager()
  const args = packageManager === "yarn" ? ["build"] : ["run", "build"]
  const changedFiles = files ? new Set(files) : undefined

  try {
    await execFileAsync(packageManager, args, {
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
    })
    return []
  } catch (error) {
    const execError = error as {
      stdout?: string
      stderr?: string
      killed?: boolean
      code?: string
    }

    if (execError.code === "ENOENT") {
      return [{
        level: "high",
        file: "package.json",
        line: 1,
        column: 1,
        message: `Build command failed: ${packageManager} was not found`,
      }] satisfies Issue[]
    }

    const output = `${execError.stdout || ""}\n${execError.stderr || ""}`
    const locations = parseBuildLocations(output)
    const rawLocation =
      (changedFiles
        ? locations.find((item) => changedFiles.has(item.file))
        : undefined) || locations[0]
    const message = execError.killed
      ? "Project build timed out while checking syntax"
      : parseBuildMessage(output)
    const location = await mapVueStyleLocation(output, rawLocation)

    if (changedFiles && !changedFiles.has(location.file)) {
      return []
    }

    return [{
      level: "high",
      file: location.file,
      line: location.line,
      column: location.column,
      message,
    }] satisfies Issue[]
  }
}
