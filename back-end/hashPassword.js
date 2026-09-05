const bcrypt = require("bcrypt");

const password = process.argv[2];

if (!password) {
    console.error("Usage: node hashPassword.js <password>");
    process.exit(1);
}

bcrypt.hash(password, 12)
    .then((hash) => {
        console.log(hash);
    })
    .catch((error) => {
        console.error("Error hashing password:", error);
        process.exit(1);
    });