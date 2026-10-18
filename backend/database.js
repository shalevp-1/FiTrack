const mysql = require('mysql2/promise');
require('dotenv').config();

const requiredDatabaseSettings = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME'
];
const missingDatabaseSettings = requiredDatabaseSettings.filter(
    setting => !process.env[setting]
);

if (missingDatabaseSettings.length > 0) {
    throw new Error(
        `Missing required database environment variables: ${missingDatabaseSettings.join(', ')}`
    );
}

const databaseCa = process.env.DB_SSL_CA?.replace(/\\n/g, '\n').trim();

if (process.env.NODE_ENV === 'production' && !databaseCa) {
    throw new Error('DB_SSL_CA must be configured in production');
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    ...(databaseCa
        ? {
            ssl: {
                ca: databaseCa,
                rejectUnauthorized: true
            }
        }
        : {})
});

module.exports = db;