#!/usr/bin/env node
import pc from "picocolors";
import { checkBuildSyntax } from "./build.js";
import { initProject } from "./project.js";
import { getFilesToScan, scanFiles } from "./scanner.js";
import { isBuildIssue, printClean, printFindings, printHelp, startSpinner, writeError, writeLine, } from "./output.js";
function getArgs() {
    return {
        all: process.argv.includes("--all"),
        help: process.argv.includes("--help") || process.argv.includes("-h"),
        init: process.argv.includes("init"),
    };
}
async function main() {
    const args = getArgs();
    if (args.help) {
        printHelp();
        return;
    }
    if (args.init) {
        await initProject();
        return;
    }
    const { scanAll, files } = await getFilesToScan(args.all);
    const issues = [];
    writeLine();
    writeLine(pc.bold("Risk Lint"));
    writeLine(pc.gray(scanAll ? "Scanning project..." : "Scanning changed files..."));
    writeLine();
    if (scanAll || files.length > 0) {
        const buildSpinner = startSpinner(scanAll ? "Checking project syntax" : "Checking changed file syntax");
        issues.push(...(await checkBuildSyntax(scanAll ? undefined : files)));
        if (issues.some(isBuildIssue)) {
            buildSpinner.fail("Syntax check found issues");
        }
        else {
            buildSpinner.succeed("Syntax check passed");
        }
    }
    const scanSpinner = startSpinner(scanAll ? "Scanning source files" : "Scanning changed files");
    issues.push(...(await scanFiles(files)));
    scanSpinner.succeed(scanAll
        ? `Scanned ${files.length} files`
        : `Scanned ${files.length} changed files`);
    if (!scanAll && files.length === 0) {
        printClean("No changed files to scan");
        return;
    }
    if (issues.length === 0) {
        printClean("No risky patterns found");
        return;
    }
    printFindings(issues);
    process.exitCode = 1;
}
main().catch((error) => {
    writeError(`${pc.red("Error:")} ${error}`);
    process.exit(1);
});
