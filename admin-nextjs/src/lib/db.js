import mysql from "mysql2/promise";

let pool;

function getPool() {
  if (pool) return pool;
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  const password = process.env.DB_PASSWORD || "";
  const port = Number(process.env.DB_PORT || "3306");
  if (!host || !user || !database) {
    throw new Error("DB_HOST/DB_USER/DB_NAME are required");
  }

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return pool;
}

export function table(name) {
  const prefix = process.env.DB_TABLE_PREFIX || "bai_";
  return prefix + name;
}

export async function query(sql, params) {
  const p = getPool();
  const [rows] = await p.execute(sql, params || []);
  return rows;
}

