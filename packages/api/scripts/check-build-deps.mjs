import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const requiredBuildDeps = [
  "@nestjs/cli",
  "typescript",
];

const errors = [];

for (const dep of requiredBuildDeps) {
  if (pkg.dependencies && pkg.dependencies[dep]) {
    console.log(`  ✓ ${dep} is in dependencies`);
  } else if (pkg.devDependencies && pkg.devDependencies[dep]) {
    errors.push(`✗ ${dep} is in devDependencies (must be in dependencies for Prisma Compute build)`);
  } else {
    errors.push(`✗ ${dep} is missing entirely`);
  }
}

if (errors.length > 0) {
  console.error("");
  console.error("ERROR: Build dependencies are not properly configured.");
  console.error("Prisma Compute auto-build runs `npm install` in production mode");
  console.error("which omits devDependencies. Build tools must be in dependencies.");
  console.error("");
  for (const e of errors) console.error(e);
  process.exit(1);
} else {
  console.log("");
  console.log("All build dependencies are correctly in dependencies.");
}
