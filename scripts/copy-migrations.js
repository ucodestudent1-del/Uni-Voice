import fs from "node:fs";
import path from "node:path";

const srcDir = path.join(process.cwd(), "src", "db", "migrations");
const destDir = path.join(process.cwd(), "dist", "db", "migrations");

fs.mkdirSync(destDir, { recursive: true });
const files = fs.readdirSync(srcDir);
for (const file of files) {
  if (file.endsWith(".sql")) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}
console.log("Copied migration files to dist/db/migrations");
