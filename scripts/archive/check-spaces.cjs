require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  console.log("Checking spaces...");
  const spaces = await sql`SELECT id, slug, name, "order" FROM "Space" ORDER BY "order" ASC`;
  console.log("Spaces:");
  spaces.forEach((s) => console.log("  -", s.id, "|", s.slug, "|", s.name));

  console.log("\nChecking recent posts...");
  const posts = await sql`
    SELECT p.id, p.content, s.slug as spaceSlug, s.name as spaceName
    FROM "Post" p
    JOIN "Space" s ON p."spaceId" = s.id
    ORDER BY p."createdAt" DESC
    LIMIT 5
  `;
  console.log("Recent posts:");
  posts.forEach((p) =>
    console.log("  -", p.id, "| space:", p.spaceslug, "|", p.content.substring(0, 50)),
  );
}

main().catch(console.error);
