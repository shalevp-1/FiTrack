const db = require('./database');

async function testConnection() {
    try {
        const [rows] = await db.query('SELECT 1 AS result');

        console.log('Database connected successfully!');
        console.log(rows);
    } catch (error) {
        console.error('Database connection failed:');
        console.error(error.message);
    }
}

testConnection();