import fs from "node:fs";
import path from "node:path";

const srcDir = path.join(process.cwd(), "src", "db", "migrations");
const destDir = path.join(process.cwd(), "dist", "db", "migrations");

fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  const sql = fs.readFileSync(path.join(srcDir, file), "utf-8");
  fs.writeFileSync(path.join(destDir, file), sql, "utf-8");
}
console.log("Copied migration files to dist/db/migrations");
