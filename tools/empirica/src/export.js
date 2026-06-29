// Research export: dump every move + dialog (orders + messages) to JSON for analysis. Read-only DB.
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const dir = process.env.RESEARCH_EXPORT_DIR || "./research-data";
await mkdir(dir, { recursive: true });
const db = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,
});

const [orders] = await db.query("SELECT * FROM wD_Orders");
const [messages] = await db.query("SELECT * FROM wD_GameMessages");
await writeFile(`${dir}/orders.json`, JSON.stringify(orders, null, 2));
await writeFile(`${dir}/messages.json`, JSON.stringify(messages, null, 2));
await db.end();
console.log(`Exported ${orders.length} orders, ${messages.length} messages to ${dir}`);
