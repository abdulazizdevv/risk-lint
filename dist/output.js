import pc from "picocolors";
import { buildErrorPattern } from "./config.js";
const spinnerFrames = ["-", "\\", "|", "/"];
export function writeLine(message = "") {
    process.stdout.write(`${message}\n`);
}
export function writeError(message) {
    process.stderr.write(`${message}\n`);
}
export function startSpinner(message) {
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
export function formatLevel(level) {
    if (level === "high")
        return pc.red(pc.bold("HIGH"));
    if (level === "medium")
        return pc.yellow(pc.bold("MEDIUM"));
    return pc.gray(pc.bold("LOW"));
}
export function getIssuePath(issue) {
    return `${issue.file}:${issue.line}:${issue.column}`;
}
export function isBuildIssue(issue) {
    return issue.message.includes("build") || buildErrorPattern.test(issue.message);
}
export function printHelp() {
    writeLine();
    writeLine(pc.bold("Risk Lint"));
    writeLine();
    writeLine("Usage:");
    writeLine("  risk-lint         Scan changed files only");
    writeLine("  risk-lint --all   Scan the full project and run build syntax check");
    writeLine("  risk-lint init    Add a risk script to package.json");
    writeLine();
}
export function printClean(message) {
    writeLine();
    writeLine(`${pc.green(pc.bold("Clean"))} ${message}`);
}
export function printFindings(issues) {
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
