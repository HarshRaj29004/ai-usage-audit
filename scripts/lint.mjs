import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(process.cwd());
const requiredFiles = [
  "README.md",
  "ARCHITECTURE.md",
  "DEVLOG.md",
  "REFLECTION.md",
  "TESTS.md",
  "PROMPTS.md",
  "GTM.md",
  "ECONOMICS.md",
  "USER_INTERVIEWS.md",
  "LANDING_COPY.md",
  "METRICS.md",
  "PRICING_DATA.md",
  ".github/workflows/ci.yml",
];

const problems = [];

for (const relativePath of requiredFiles) {
  const absolutePath = resolve(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    problems.push(`Missing required file: ${relativePath}`);
    continue;
  }

  const content = readFileSync(absolutePath, "utf8").trim();
  if (!content) {
    problems.push(`Empty required file: ${relativePath}`);
  }

  if (relativePath.endsWith(".md") && content.includes("...")) {
    problems.push(`Placeholder ellipsis found in: ${relativePath}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("Foundation lint passed.");