// Creates the database tables by running every .sql file in /migrations, in order.
// Safe to run more than once.

const fs = require("fs");
const path = require("path");
const pool = require("../db");

(async () => {
  const dir = path.join(__dirname, "..", "migrations");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    console.log(`Running ${file}…`);
    await pool.query(fs.readFileSync(path.join(dir, file), "utf8"));
  }
  console.log("Database tables are ready.");
  await pool.end();
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
