function getLocation(content, index) {
    const lines = content.slice(0, index).split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
}
function createIssue(level, file, message, line = 1, column = 1) {
    return { level, file, line, column, message };
}
function checkSecrets(file, content) {
    const issues = [];
    const secretPatterns = [
        /sk-[a-zA-Z0-9]{20,}/g,
        /AIza[0-9A-Za-z\-_]{20,}/g,
        /AKIA[0-9A-Z]{16}/g,
        /bot[0-9]{8,}:[a-zA-Z0-9_-]{20,}/g,
    ];
    for (const pattern of secretPatterns) {
        for (const match of content.matchAll(pattern)) {
            const location = getLocation(content, match.index);
            issues.push(createIssue("high", file, "Possible secret/API key detected", location.line, location.column));
        }
    }
    if (file.includes(".env")) {
        issues.push(createIssue("high", file, ".env file detected. Make sure it is not committed"));
    }
    return issues;
}
function checkLogs(file, content) {
    const issues = [];
    for (const match of content.matchAll(/console\.(log|warn|error|debug)/g)) {
        const location = getLocation(content, match.index);
        issues.push(createIssue("medium", file, "Console statement found", location.line, location.column));
    }
    for (const match of content.matchAll(/^\s*debugger\s*;?/gm)) {
        const debuggerOffset = match[0].indexOf("debugger");
        const location = getLocation(content, match.index + debuggerOffset);
        issues.push(createIssue("high", file, "Debugger statement found", location.line, location.column));
    }
    return issues;
}
function checkAny(file, content) {
    const issues = [];
    for (const match of content.matchAll(/:\s*any\b/g)) {
        const anyOffset = match[0].indexOf("any");
        const location = getLocation(content, match.index + anyOffset);
        issues.push(createIssue("medium", file, "TypeScript any usage found", location.line, location.column));
    }
    return issues;
}
function checkTodos(file, content) {
    const issues = [];
    for (const comment of content.matchAll(/\/\/.*|\/\*[\s\S]*?\*\//g)) {
        for (const match of comment[0].matchAll(/\b(TODO|FIXME|HACK)\b/g)) {
            const location = getLocation(content, comment.index + match.index);
            issues.push(createIssue("low", file, `${match[0]} comment found`, location.line, location.column));
        }
    }
    return issues;
}
function checkLargeFile(file, content) {
    const lines = content.split("\n").length;
    if (lines > 500) {
        return [createIssue("medium", file, `Large file: ${lines} lines`, 501, 1)];
    }
    return [];
}
function collectDeclaredNames(frontmatter) {
    const declared = new Set();
    for (const match of frontmatter.matchAll(/\b(?:const|let|var|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/g)) {
        declared.add(match[1]);
    }
    for (const match of frontmatter.matchAll(/\b(?:const|let|var)\s+\{([^}]+)\}/g)) {
        for (const name of match[1].split(",")) {
            const cleanName = name
                .trim()
                .split(":")
                .pop()
                ?.trim()
                .match(/^[A-Za-z_$][\w$]*/);
            if (cleanName)
                declared.add(cleanName[0]);
        }
    }
    for (const match of frontmatter.matchAll(/\bimport\s+([A-Za-z_$][\w$]*)\b/g)) {
        declared.add(match[1]);
    }
    for (const match of frontmatter.matchAll(/\bimport\s+\{([^}]+)\}/g)) {
        for (const name of match[1].split(",")) {
            const cleanName = name
                .trim()
                .split(/\s+as\s+/)
                .pop()
                ?.trim()
                .match(/^[A-Za-z_$][\w$]*/);
            if (cleanName)
                declared.add(cleanName[0]);
        }
    }
    return declared;
}
function collectTemplateScopedNames(template) {
    const scoped = new Set();
    for (const match of template.matchAll(/\(\s*\[([^\]]+)\]\s*\)\s*=>/g)) {
        for (const name of match[1].split(",")) {
            const cleanName = name.trim().match(/^[A-Za-z_$][\w$]*/);
            if (cleanName)
                scoped.add(cleanName[0]);
        }
    }
    for (const match of template.matchAll(/\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>/g)) {
        scoped.add(match[1]);
    }
    for (const match of template.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) {
        scoped.add(match[1]);
    }
    return scoped;
}
function checkAstroTemplateIdentifiers(file, content) {
    const issues = [];
    if (!file.endsWith(".astro"))
        return issues;
    const sections = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!sections)
        return issues;
    const frontmatter = sections[1];
    const template = sections[2];
    const templateOffset = sections[0].length - template.length;
    const declared = collectDeclaredNames(frontmatter);
    const scoped = collectTemplateScopedNames(template);
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
    ]);
    for (const match of template.matchAll(/\{([^{}]+)\}/g)) {
        const expression = match[1].trim();
        if (!/^[A-Za-z_$][\w$]*$/.test(expression))
            continue;
        if (allowed.has(expression) || declared.has(expression) || scoped.has(expression)) {
            continue;
        }
        const location = getLocation(content, templateOffset + match.index + 1);
        issues.push(createIssue("high", file, `Possible undefined Astro template variable: ${expression}`, location.line, location.column));
    }
    return issues;
}
function checkAstroFrontmatterIdentifiers(file, content) {
    const issues = [];
    if (!file.endsWith(".astro"))
        return issues;
    const sections = content.match(/^---\n([\s\S]*?)\n---/);
    if (!sections)
        return issues;
    const frontmatter = sections[1];
    const frontmatterOffset = content.indexOf(frontmatter);
    const declared = collectDeclaredNames(frontmatter);
    const allowed = new Set([
        "Astro",
        "console",
        "false",
        "null",
        "true",
        "undefined",
    ]);
    for (const match of frontmatter.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*;?\s*$/gm)) {
        const name = match[1];
        if (allowed.has(name) || declared.has(name))
            continue;
        if (/^(import|export|const|let|var|type|interface|function|class)$/.test(name)) {
            continue;
        }
        const location = getLocation(content, frontmatterOffset + match.index + match[0].indexOf(name));
        issues.push(createIssue("high", file, `Possible stray Astro frontmatter identifier: ${name}`, location.line, location.column));
    }
    return issues;
}
export function checkFile(file, content) {
    return [
        ...checkSecrets(file, content),
        ...checkLogs(file, content),
        ...checkAny(file, content),
        ...checkTodos(file, content),
        ...checkLargeFile(file, content),
        ...checkAstroTemplateIdentifiers(file, content),
        ...checkAstroFrontmatterIdentifiers(file, content),
    ];
}
