const pg = require("pg");

// Get DATABASE_URL from .env
require("dotenv").config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log("Connected to database");

  const result = await client.query(
    `SELECT id, name, email, role FROM "User" WHERE name ILIKE '%Rye%'`,
  );
  console.log("Found users:", result.rows);

  if (result.rows.length === 0) {
    console.log("No user found with name containing Rye");
    return;
  }

  const user = result.rows[0];
  if (user.role === "admin") {
    console.log(`${user.name} is already an admin`);
    return;
  }

  await client.query(`UPDATE "User" SET role = 'admin' WHERE id = $1`, [user.id]);
  console.log(`Updated ${user.name} to admin!`);
}

main()
  .catch(console.error)
  .finally(() => client.end());
