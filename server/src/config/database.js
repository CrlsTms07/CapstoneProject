const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.error("❌ PostgreSQL connection failed:");
        console.error(err.message);
    } else {
        console.log("✅ Connected to PostgreSQL database!");
        console.log("🕐 Database time:", result.rows[0].now);
    }
});

module.exports = pool;