#!/usr/bin/env node
import fg from "fast-glob";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import pc from "picocolors";
import { promisify } from "node:util";
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
];
const patterns = ["**/*.{js,jsx,ts,tsx,vue,svelte,astro}", ".env", ".env.*"];
const issues = [];
const execFileAsync = promisify(execFile);
const spinnerFrames = ["-", "\\", "|", "/"];
function writeLine(message = "") {
    process.stdout.write(`${message}\n`);
}
function writeError(message) {
    process.stderr.write(`${message}\n`);
}
function startSpinner(message) {
    if (!process.stdout.isTTY) {
        writeLine(`${pc.cyan("•")} ${message}`);
        return {
            succeed(doneMessage = message) {
                writeLine(`${pc.green("✓")} ${doneMessage}`);
            },
            fail(doneMessage = message) {
                writeLine(`${pc.red("✕")} ${doneMessage}`);
            },
        };
    }
    let index = 0;
    process.stdout.write(`${pc.cyan(spinnerFrames[index])} ${message}`);
    const clearLine = () => {
        process.stdout.write("\r\u001b[2K");
    };
    const timer = setInterval(() => {
        index = (index + 1) % spinnerFrames.length;
        clearLine();
        process.stdout.write(`${pc.cyan(spinnerFrames[index])} ${message}`);
    }, 90);
    return {
        succeed(doneMessage = message) {
            clearInterval(timer);
            clearLine();
            process.stdout.write(`${pc.green("✓")} ${doneMessage}\n`);
        },
        fail(doneMessage = message) {
            clearInterval(timer);
            clearLine();
            process.stdout.write(`${pc.red("✕")} ${doneMessage}\n`);
        },
    };
}
function getLocation(content, index) {
    const lines = content.slice(0, index).split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
}
function addIssue(level, file, message, line = 1, column = 1) {
    issues.push({ level, file, line, column, message });
}
function getIssuePath(issue) {
    return `${issue.file}:${issue.line}:${issue.column}`;
}
function formatLevel(level) {
    if (level === "high")
        return pc.red(pc.bold("HIGH"));
    if (level === "medium")
        return pc.yellow(pc.bold("MEDIUM"));
    return pc.gray(pc.bold("LOW"));
}
function checkSecrets(file, content) {
    const secretPatterns = [
        /sk-[a-zA-Z0-9]{20,}/g,
        /AIza[0-9A-Za-z\-_]{20,}/g,
        /AKIA[0-9A-Z]{16}/g,
        /bot[0-9]{8,}:[a-zA-Z0-9_-]{20,}/g,
    ];
    for (const pattern of secretPatterns) {
        for (const match of content.matchAll(pattern)) {
            const location = getLocation(content, match.index);
            addIssue("high", file, "Possible secret/API key detected", location.line, location.column);
        }
    }
    if (file.includes(".env")) {
        addIssue("high", file, ".env file detected. Make sure it is not committed");
    }
}
function checkLogs(file, content) {
    for (const match of content.matchAll(/console\.(log|warn|error|debug)/g)) {
        const location = getLocation(content, match.index);
        addIssue("medium", file, "Console statement found", location.line, location.column);
    }
    for (const match of content.matchAll(/^\s*debugger\s*;?/gm)) {
        const debuggerOffset = match[0].indexOf("debugger");
        const location = getLocation(content, match.index + debuggerOffset);
        addIssue("high", file, "Debugger statement found", location.line, location.column);
    }
}
function checkAny(file, content) {
    for (const match of content.matchAll(/:\s*any\b/g)) {
        const anyOffset = match[0].indexOf("any");
        const location = getLocation(content, match.index + anyOffset);
        addIssue("medium", file, "TypeScript any usage found", location.line, location.column);
    }
}
function checkTodos(file, content) {
    for (const comment of content.matchAll(/\/\/.*|\/\*[\s\S]*?\*\//g)) {
        for (const match of comment[0].matchAll(/\b(TODO|FIXME|HACK)\b/g)) {
            const location = getLocation(content, comment.index + match.index);
            addIssue("low", file, `${match[0]} comment found`, location.line, location.column);
        }
    }
}
function checkLargeFile(file, content) {
    const lines = content.split("\n").length;
    if (lines > 500) {
        addIssue("medium", file, `Large file: ${lines} lines`, 501, 1);
    }
}
async function fileExists(file) {
    try {
        await fs.access(file);
        return true;
    }
    catch {
        return false;
    }
}
async function getPackageManager() {
    if (await fileExists("pnpm-lock.yaml"))
        return "pnpm";
    if (await fileExists("yarn.lock"))
        return "yarn";
    return "npm";
}
function parseBuildLocation(output) {
    const locationMatch = output.match(/Location:\s*\n\s*([^:\n]+):(\d+):(\d+)/);
    if (locationMatch) {
        return {
            file: locationMatch[1].replace(`${process.cwd()}/`, ""),
            line: Number(locationMatch[2]),
            column: Number(locationMatch[3]),
        };
    }
    const fileLocationMatch = output.match(/((?:\.\/|\/)?[^\s:]+?\.(?:astro|js|jsx|ts|tsx|vue|svelte)):(\d+):(\d+)/);
    if (fileLocationMatch) {
        return {
            file: fileLocationMatch[1].replace(`${process.cwd()}/`, ""),
            line: Number(fileLocationMatch[2]),
            column: Number(fileLocationMatch[3]),
        };
    }
    return {
        file: "package.json",
        line: 1,
        column: 1,
    };
}
function parseBuildMessage(output) {
    const lines = output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    return (lines.find((line) => /Expected|Unexpected|SyntaxError|Parse error/i.test(line)) ||
        lines.find((line) => line.includes("[ERROR]")) ||
        "Project build failed");
}
async function checkBuildSyntax() {
    const packageManager = await getPackageManager();
    const args = packageManager === "yarn" ? ["build"] : ["run", "build"];
    try {
        await execFileAsync(packageManager, args, {
            cwd: process.cwd(),
            timeout: 120000,
            maxBuffer: 1024 * 1024 * 10,
        });
    }
    catch (error) {
        const execError = error;
        const output = `${execError.stdout || ""}\n${execError.stderr || ""}`;
        const location = parseBuildLocation(output);
        const message = execError.killed
            ? "Project build timed out while checking syntax"
            : parseBuildMessage(output);
        addIssue("high", location.file, message, location.line, location.column);
    }
}
async function main() {
    writeLine();
    writeLine(pc.bold("Risk Lint"));
    writeLine(pc.gray("Scanning project..."));
    writeLine();
    const buildSpinner = startSpinner("Checking project syntax");
    await checkBuildSyntax();
    const buildIssues = issues.filter((issue) => issue.message.includes("build") ||
        /Expected|Unexpected|SyntaxError|Parse error/i.test(issue.message));
    if (buildIssues.length > 0) {
        buildSpinner.fail("Syntax check found issues");
    }
    else {
        buildSpinner.succeed("Syntax check passed");
    }
    const scanSpinner = startSpinner("Scanning source files");
    const files = await fg(patterns, {
        ignore,
        dot: true,
        onlyFiles: true,
    });
    for (const file of files) {
        const content = await fs.readFile(file, "utf8");
        checkSecrets(file, content);
        checkLogs(file, content);
        checkAny(file, content);
        checkTodos(file, content);
        checkLargeFile(file, content);
    }
    scanSpinner.succeed(`Scanned ${files.length} files`);
    if (issues.length === 0) {
        writeLine();
        writeLine(`${pc.green(pc.bold("Clean"))} No risky patterns found`);
        return;
    }
    const high = issues.filter((i) => i.level === "high");
    const medium = issues.filter((i) => i.level === "medium");
    const low = issues.filter((i) => i.level === "low");
    writeLine();
    writeLine(pc.bold("Findings"));
    writeLine();
    for (const issue of issues) {
        writeLine(`${formatLevel(issue.level)} ${pc.bold(getIssuePath(issue))}`);
        writeLine(`${pc.gray("│")} ${issue.message}`);
        writeLine();
    }
    writeLine(pc.bold("Summary"));
    writeLine(`${pc.red(`High: ${high.length}`)}  ${pc.yellow(`Medium: ${medium.length}`)}  ${pc.gray(`Low: ${low.length}`)}`);
}
main().catch((error) => {
    writeError(`${pc.red("Error:")} ${error}`);
    process.exit(1);
});
