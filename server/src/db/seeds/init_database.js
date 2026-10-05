// HIPO 2.0 – Login / 4.3 Users & Roles (database seed)
// One-time setup: creates the base tables, seeds the default roles and the admin account.
// Run from server/: npm run db:init
require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("../../config/database");
const { createBaseTables } = require("./baseSchema");

const initDatabase = async () => {
    try {
        console.log("🔄 Starting database initialization...\n");

        // 1. Create tables (src/db/seeds/baseSchema.js)
        console.log("📋 Creating tables...");
        await createBaseTables(pool);
        console.log("✅ Tables created successfully!\n");

        // 2. Insert default roles
        console.log("📌 Inserting default roles...");
        await pool.query(`
            UPDATE roles
            SET role_name = 'Guest'
            WHERE LOWER(role_name) = 'student'
              AND NOT EXISTS (
                  SELECT 1 FROM roles WHERE LOWER(role_name) = 'guest'
              )
        `);

        const rolesData = [
            'Admin',
            'Grade Level Chairperson',
            'Master Teacher',
            'Teacher'
        ];

        for (const role_name of rolesData) {
            await pool.query(
                `INSERT INTO roles (role_name)
                 VALUES ($1)
                 ON CONFLICT (role_name) DO NOTHING`,
                [role_name]
            );
        }
        console.log("✅ Default roles inserted!\n");

        // 3. Create admin user
        console.log("👤 Creating admin account...");
        const adminUsername = process.env.ADMIN_USERNAME;
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminUsername || !adminEmail || !adminPassword) {
            throw new Error("ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD must be configured in .env");
        }
        
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        const result = await pool.query(
            `INSERT INTO users (username, full_name, email, school_id, password_hash, role_id, is_approved)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (username) DO UPDATE SET
                 full_name = EXCLUDED.full_name,
                 email = EXCLUDED.email,
                 school_id = EXCLUDED.school_id,
                 password_hash = EXCLUDED.password_hash,
                 role_id = EXCLUDED.role_id,
                 is_approved = EXCLUDED.is_approved
             RETURNING user_id, username, email, role_id`,
            [adminUsername, "System Administrator", adminEmail, "ADMIN-001", hashedPassword, 1, true]
        );

        console.log("✅ Secure admin account is ready.");
        console.log(`   Login email: ${result.rows[0].email}`);
        console.log("   Password: read ADMIN_PASSWORD from server/.env\n");

        console.log("🎉 Database initialization completed successfully!");
        console.log("\n📝 You can now login with:");
        console.log(`   Login email: ${adminEmail}`);
        console.log("   Password: read ADMIN_PASSWORD from server/.env\n");

        process.exit(0);
    } catch (error) {
        console.error("❌ Database initialization failed:");
        console.error(error.message);
        process.exit(1);
    }
};

// Run initialization
initDatabase();
