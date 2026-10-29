// The connection to the Supabase database, shared by the server and the scripts.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.log("Warning: no DATABASE_URL found. Add it to your .env file.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase signs its connections with its own certificate. Checking against it
  // proves we're really talking to Supabase, and keeps the connection encrypted.
  ssl: { ca: fs.readFileSync(path.join(__dirname, "supabase-ca.crt"), "utf8") },
  max: 5,
});

module.exports = pool;
