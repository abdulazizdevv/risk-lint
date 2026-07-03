import fs from "node:fs/promises"
import pc from "picocolors"
import { writeError, writeLine } from "./output.js"

export async function fileExists(file: string) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

export async function getPackageManager() {
  const npmExecPath = process.env.npm_execpath || ""
  const npmUserAgent = process.env.npm_config_user_agent || ""

  if (
    npmExecPath.includes("bun") ||
    npmUserAgent.includes("bun") ||
    (await fileExists("bun.lockb")) ||
    (await fileExists("bun.lock"))
  ) {
    return "bun"
  }

  if (await fileExists("pnpm-lock.yaml")) return "pnpm"
  if (await fileExists("yarn.lock")) return "yarn"
  return "npm"
}

export async function initProject() {
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
