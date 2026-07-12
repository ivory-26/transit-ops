require("dotenv").config();

const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query("SELECT 1 AS ok");
  console.log(JSON.stringify(result.rows[0]));
  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
