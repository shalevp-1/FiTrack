const express = require('express');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const db = require('./database');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const LOW_STOCK_THRESHOLD = 5;
const MAX_PRODUCT_STOCK = 2147483647;
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/'
};

if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes');
}

app.disable('x-powered-by');

app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    );
    next();
});

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = (
    process.env.CLIENT_ORIGINS ||
    'http://localhost:4200,https://fitrackfitness.netlify.app'
)
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true
}));

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');

        res.json({
            status: 'ok'
        });
    } catch (error) {
        console.error('HEALTH CHECK ERROR:', error);

        res.status(503).json({
            status: 'starting'
        });
    }
});

function authenticateToken(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: 'Authentication required'
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired token'
        });
    }
}


function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            message: 'Admin access required'
        });
    }
    next();
}


//Admin access granted, proceed to the next middleware or route handler
app.get('/api/admin/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [[sales]] = await db.query(`
            SELECT
                COALESCE(SUM(total_amount), 0) AS total_sales
            FROM orders
            WHERE payment_status = 'paid'
        `);

        const [[orderStats]] = await db.query(`
            SELECT COUNT(*) AS total_orders
            FROM orders
        `);

        const [[productStats]] = await db.query(`
            SELECT
                COUNT(*) AS total_products,
                COALESCE(SUM(
                    CASE
                        WHEN stock_quantity BETWEEN 1 AND ?
                             AND is_active = 1
                        THEN 1 ELSE 0
                    END
                ), 0) AS low_stock_products
            FROM products
            WHERE is_active = 1
        `, [LOW_STOCK_THRESHOLD]);

        const [recentOrders] = await db.query(`
            SELECT
                o.id,
                o.created_at,
                o.total_amount,
                o.status,
                o.payment_status,
                u.username
            FROM orders o
            JOIN users u ON u.id = o.user_id
            ORDER BY o.created_at DESC, o.id DESC
            LIMIT 5
        `);

        res.json({
            totalSales: Number(sales.total_sales),
            totalOrders: Number(orderStats.total_orders),
            totalProducts: Number(productStats.total_products),
            lowStockProducts: Number(productStats.low_stock_products),
            recentOrders
        });
    } catch (error) {
        console.error('ADMIN OVERVIEW ERROR:', error);

        res.status(500).json({
            message: 'Could not load admin overview'
        });
    }
});

/* ADMIN INVENTORY */
app.get('/api/admin/inventory', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [products] = await db.query(
            `SELECT
                id,
                name,
                description,
                price,
                image_url,
                category,
                stock_quantity,
                is_active,
                EXISTS(
                    SELECT 1
                    FROM order_items
                    WHERE order_items.product_id = products.id
                ) AS has_order_history
             FROM products
             ORDER BY name ASC, id ASC`
        );

        res.json(products);
    } catch (error) {
        console.error('GET ADMIN INVENTORY ERROR:', error);

        res.status(500).json({
            message: 'Could not load inventory'
        });
    }
});

function validateAdminProduct(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'Product details are required' };
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
        return { error: 'Product name is required' };
    }

    const name = body.name.trim();
    if (name.length > 150) {
        return { error: 'Product name must be 150 characters or fewer' };
    }

    if (
        (typeof body.price !== 'number' && typeof body.price !== 'string') ||
        !/^\d{1,8}(\.\d{1,2})?$/.test(String(body.price).trim())
    ) {
        return { error: 'Price must be a valid amount with up to two decimals' };
    }

    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 99999999.99) {
        return { error: 'Price is outside the supported range' };
    }

    if (
        !Number.isSafeInteger(body.stock_quantity) ||
        body.stock_quantity < 0 ||
        body.stock_quantity > MAX_PRODUCT_STOCK
    ) {
        return { error: 'Stock quantity must be a non-negative whole number' };
    }

    const nullableTextFields = [
        { field: 'description', maxLength: 65535 },
        { field: 'image_url', maxLength: 500 },
        { field: 'category', maxLength: 100 }
    ];

    const normalized = {};

    for (const { field, maxLength } of nullableTextFields) {
        const value = body[field];
        if (value == null || value === '') {
            normalized[field] = null;
        } else if (typeof value !== 'string') {
            return { error: `${field} must be text or empty` };
        } else if (
            value.length > maxLength ||
            (
                field === 'description' &&
                Buffer.byteLength(value, 'utf8') > maxLength
            )
        ) {
            return { error: `${field} must be ${maxLength} characters or fewer` };
        } else {
            normalized[field] = value.trim() || null;
        }
    }

    return {
        product: {
            name,
            description: normalized.description,
            price: price.toFixed(2),
            image_url: normalized.image_url,
            category: normalized.category,
            stock_quantity: body.stock_quantity
        }
    };
}

app.post('/api/admin/inventory', authenticateToken, requireAdmin, async (req, res) => {
    const validation = validateAdminProduct(req.body);
    if (validation.error) {
        return res.status(400).json({ message: validation.error });
    }

    try {
        const product = validation.product;
        const [result] = await db.query(
            `INSERT INTO products
                (name, description, price, image_url, category, stock_quantity, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
                product.name,
                product.description,
                product.price,
                product.image_url,
                product.category,
                product.stock_quantity
            ]
        );

        res.status(201).json({
            message: `${product.name} added successfully`,
            product: {
                id: result.insertId,
                ...product,
                is_active: 1,
                has_order_history: 0
            }
        });
    } catch (error) {
        console.error('CREATE ADMIN PRODUCT ERROR:', error);

        res.status(500).json({
            message: 'Could not add product'
        });
    }
});

app.put('/api/admin/inventory/:id', authenticateToken, requireAdmin, async (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ message: 'Invalid product ID' });
    }

    const validation = validateAdminProduct(req.body);
    if (validation.error) {
        return res.status(400).json({ message: validation.error });
    }

    try {
        const product = validation.product;
        const [result] = await db.query(
            `UPDATE products
             SET name = ?,
                 description = ?,
                 price = ?,
                 image_url = ?,
                 category = ?,
                 stock_quantity = ?
             WHERE id = ?`,
            [
                product.name,
                product.description,
                product.price,
                product.image_url,
                product.category,
                product.stock_quantity,
                productId
            ]
        );

        if (result.affectedRows === 0) {
            const [existingProducts] = await db.query(
                'SELECT id FROM products WHERE id = ?',
                [productId]
            );

            if (existingProducts.length === 0) {
                return res.status(404).json({ message: 'Product not found' });
            }
        }

        const [products] = await db.query(
            `SELECT id, name, description, price, image_url, category,
                    stock_quantity, is_active,
                    EXISTS(
                        SELECT 1
                        FROM order_items
                        WHERE order_items.product_id = products.id
                    ) AS has_order_history
             FROM products
             WHERE id = ?`,
            [productId]
        );

        res.json({
            message: `${product.name} updated successfully`,
            product: products[0]
        });
    } catch (error) {
        console.error('UPDATE ADMIN PRODUCT ERROR:', error);

        res.status(500).json({
            message: 'Could not update product'
        });
    }
});

app.patch(
    '/api/admin/inventory/:id/deactivate',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const productId = Number(req.params.id);

            if (!Number.isInteger(productId) || productId <= 0) {
                return res.status(400).json({
                    message: 'Invalid product ID'
                });
            }

            const [result] = await db.query(
                'UPDATE products SET is_active = 0 WHERE id = ? AND is_active = 1',
                [productId]
            );

            if (result.affectedRows === 0) {
                const [products] = await db.query(
                    'SELECT id, is_active FROM products WHERE id = ?',
                    [productId]
                );

                if (products.length === 0) {
                    return res.status(404).json({
                        message: 'Product not found'
                    });
                }
            }

            res.json({
                message: 'Product deactivated successfully',
                productId,
                is_active: 0
            });
        } catch (error) {
            console.error('DEACTIVATE ADMIN PRODUCT ERROR:', error);

            res.status(500).json({
                message: 'Could not deactivate product'
            });
        }
    }
);

app.patch(
    '/api/admin/inventory/:id/reactivate',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const productId = Number(req.params.id);

            if (!Number.isInteger(productId) || productId <= 0) {
                return res.status(400).json({
                    message: 'Invalid product ID'
                });
            }

            const [result] = await db.query(
                'UPDATE products SET is_active = 1 WHERE id = ? AND is_active = 0',
                [productId]
            );

            if (result.affectedRows === 0) {
                const [products] = await db.query(
                    'SELECT id FROM products WHERE id = ?',
                    [productId]
                );

                if (products.length === 0) {
                    return res.status(404).json({
                        message: 'Product not found'
                    });
                }
            }

            res.json({
                message: 'Product reactivated successfully',
                productId,
                is_active: 1
            });
        } catch (error) {
            console.error('REACTIVATE ADMIN PRODUCT ERROR:', error);

            res.status(500).json({
                message: 'Could not reactivate product'
            });
        }
    }
);

app.delete(
    '/api/admin/inventory/:id',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        let connection;
        let transactionStarted = false;

        try {
            const productId = Number(req.params.id);

            if (!Number.isInteger(productId) || productId <= 0) {
                return res.status(400).json({
                    message: 'Invalid product ID'
                });
            }

            connection = await db.getConnection();
            await connection.beginTransaction();
            transactionStarted = true;

            const [products] = await connection.query(
                `SELECT id, name, is_active
                 FROM products
                 WHERE id = ?
                 FOR UPDATE`,
                [productId]
            );

            if (products.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(404).json({
                    message: 'Product not found'
                });
            }

            const product = products[0];
            if (product.is_active) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    message: 'Deactivate the product before deleting it'
                });
            }

            const [orderItems] = await connection.query(
                'SELECT 1 FROM order_items WHERE product_id = ? LIMIT 1',
                [productId]
            );

            if (orderItems.length > 0) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    message: 'This product is linked to order history and cannot be deleted'
                });
            }

            await connection.query(
                'DELETE FROM products WHERE id = ? AND is_active = 0',
                [productId]
            );

            await connection.commit();
            transactionStarted = false;

            res.json({
                message: `${product.name} deleted permanently`,
                productId
            });
        } catch (error) {
            if (connection && transactionStarted) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('DELETE PRODUCT ROLLBACK ERROR:', rollbackError);
                }
            }

            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.status(409).json({
                    message: 'This product is linked to order history and cannot be deleted'
                });
            }

            console.error('DELETE ADMIN PRODUCT ERROR:', error);

            res.status(500).json({
                message: 'Could not delete product'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);

app.post(
    '/api/admin/inventory/:id/restock',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        let connection;
        let transactionStarted = false;

        try {
            const productId = Number(req.params.id);
            const { quantity } = req.body || {};

            if (!Number.isInteger(productId) || productId <= 0) {
                return res.status(400).json({
                    message: 'Invalid product ID'
                });
            }

            if (!Number.isSafeInteger(quantity) || quantity <= 0) {
                return res.status(400).json({
                    message: 'Restock quantity must be a positive integer'
                });
            }

            connection = await db.getConnection();
            await connection.beginTransaction();
            transactionStarted = true;

            const [products] = await connection.query(
                `SELECT
                    id,
                    name,
                    description,
                    price,
                    image_url,
                    category,
                    stock_quantity,
                    is_active,
                    EXISTS(
                        SELECT 1
                        FROM order_items
                        WHERE order_items.product_id = products.id
                    ) AS has_order_history
                 FROM products
                 WHERE id = ?
                 FOR UPDATE`,
                [productId]
            );

            if (products.length === 0) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(404).json({
                    message: 'Product not found'
                });
            }

            const product = products[0];
            if (!product.is_active) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    message: 'Inactive products cannot be restocked'
                });
            }

            const currentStock = Number(product.stock_quantity);
            if (
                !Number.isSafeInteger(currentStock) ||
                currentStock < 0 ||
                quantity > MAX_PRODUCT_STOCK - currentStock
            ) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(400).json({
                    message: 'Restock quantity exceeds the supported stock limit'
                });
            }

            const [updateResult] = await connection.query(
                `UPDATE products
                 SET stock_quantity = stock_quantity + ?
                 WHERE id = ?`,
                [quantity, productId]
            );

            if (updateResult.affectedRows !== 1) {
                throw new Error('Product stock could not be updated');
            }

            await connection.commit();
            transactionStarted = false;

            res.json({
                message: `${product.name} restocked successfully`,
                product: {
                    ...product,
                    stock_quantity: currentStock + quantity
                }
            });
        } catch (error) {
            if (connection && transactionStarted) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('RESTOCK ROLLBACK ERROR:', rollbackError);
                }
            }

            console.error('RESTOCK PRODUCT ERROR:', error);

            res.status(500).json({
                message: 'Could not restock product'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);



// Convert optional integer fields to numbers.
// Empty values become null; invalid values remain invalid for validation.
function normalizeOptionalInteger(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    return Number(value);
}

// Normalize optional running fields consistently.
function normalizeRunningDetails(running) {
    if (!running || typeof running !== 'object' || Array.isArray(running)) {
        return running;
    }

    return {
        ...running,
        avg_pace_seconds_per_km: normalizeOptionalInteger(
            running.avg_pace_seconds_per_km
        ),
        avg_heart_rate: normalizeOptionalInteger(
            running.avg_heart_rate
        ),
        elevation_gain_m: normalizeOptionalInteger(
            running.elevation_gain_m
        )
    };
}

// REGISTER
app.post('/api/users', async (req, res) => {
    try {
        const { username, email, password } = req.body || {};

        if (
            typeof username !== 'string' ||
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !username.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: 'Username, email and password are required'
            });
        }

        if (username.trim().length < 3 || username.trim().length > 24) {
            return res.status(400).json({
                message: 'Username must be between 3 and 24 characters'
            });
        }

        if (
            email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ) {
            return res.status(400).json({
                message: 'Please enter a valid email address'
            });
        }

        if (
            password.length < 8 ||
            password.length > 128 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                message: 'Password must be 8 or more characters and no more than 72 bytes'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES (?, ?, ?)`,
            [username.trim(), email.trim(), hashedPassword]
        );

        res.status(201).json({
            message: 'User created successfully',
            userId: result.insertId
        });

    } catch (error) {
        console.error('REGISTRATION ERROR:', error.code || 'unexpected error');

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'Username or email already exists'
            });
        }

        res.status(500).json({
            message: 'Server error'
        });
    }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    try {
        const { login, password } = req.body || {};

        if (
            typeof login !== 'string' ||
            !login.trim() ||
            typeof password !== 'string' ||
            !password
        ) {
            return res.status(400).json({
                message: 'Login and password are required'
            });
        }

        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [login.trim(), login.trim()]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: 'Incorrect password'
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '1h'
            }
        );

        res.cookie('token', token, {
            ...cookieOptions,
            maxAge: 60 * 60 * 1000
        });

        res.json({
            message: 'Logged in successfully',
            username: user.username
        });

    } catch (error) {
        console.error('LOGIN ERROR:', error.code || 'unexpected error');

        res.status(500).json({
            message: 'Server error'
        });
    }
});

// CHECK LOGIN
app.get('/api/me', async (req, res) => {
    res.set('Cache-Control', 'no-store');

    try {
        const token = req.cookies.token;

        if (!token) {
            return res.json({
                loggedIn: false
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const [users] = await db.query(
            'SELECT id, username, email, role FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: 'User not found'
            });
        }

        res.json({
            loggedIn: true,
            user: users[0]
        });

    } catch (error) {
        return res.status(401).json({
            message: 'Not logged in'
        });
    }
});

// LOGOUT
app.post('/api/logout', (req, res) => {
    res.clearCookie('token', cookieOptions);

    res.json({
        message: 'Logged out successfully'
    });
});



/* GET ACTIVE PRODUCTS */
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await db.query(
            `SELECT
                id,
                name,
                description,
                price,
                image_url,
                category,
                stock_quantity
             FROM products
             WHERE is_active = 1
             ORDER BY created_at DESC`
        );

        res.json(products);
    } catch (error) {
        console.error('GET PRODUCTS ERROR:', error);

        res.status(500).json({
            message: 'Could not load products'
        });
    }
});


/* GET ONE ACTIVE PRODUCT */
app.get('/api/products/:id', async (req, res) => {
    try {
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                message: 'Invalid product ID'
            });
        }

        const [products] = await db.query(
            `SELECT
                id,
                name,
                description,
                price,
                image_url,
                category,
                stock_quantity
             FROM products
             WHERE id = ? AND is_active = 1`,
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                message: 'Product not found'
            });
        }

        res.json(products[0]);
    } catch (error) {
        console.error('GET PRODUCT ERROR:', error);

        res.status(500).json({
            message: 'Could not load product'
        });
    }
});

// GET CURRENT USER'S ORDERS
app.get('/api/orders/my-orders', authenticateToken, async (req, res) => {
    try {
        const [orders] = await db.query(
            `SELECT
                o.id,
                o.created_at,
                o.subtotal,
                o.discount_amount,
                o.shipping_cost,
                o.total_amount,
                o.status,
                o.payment_status,
                COUNT(oi.id) AS line_count,
                COALESCE(SUM(oi.quantity), 0) AS item_count
             FROM orders o
             LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE o.user_id = ?
             GROUP BY o.id
             ORDER BY o.created_at DESC, o.id DESC`,
            [req.user.id]
        );

        return res.json(orders);
    } catch (error) {
        console.error('GET MY ORDERS ERROR:', error);

        return res.status(500).json({
            message: 'Could not load your orders'
        });
    }
});

app.get('/api/orders/my-orders/:id', authenticateToken, async (req, res) => {
    try {
        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                message: 'Invalid order ID'
            });
        }

        const [orders] = await db.query(
            `SELECT
                id,
                created_at,
                subtotal,
                discount_amount,
                shipping_cost,
                total_amount,
                status,
                payment_status
             FROM orders
             WHERE id = ? AND user_id = ?`,
            [orderId, req.user.id]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const [items] = await db.query(
            `SELECT
                id,
                product_id,
                product_name,
                quantity,
                unit_price
             FROM order_items
             WHERE order_id = ?
             ORDER BY id ASC`,
            [orderId]
        );

        return res.json({
            ...orders[0],
            items
        });
    } catch (error) {
        console.error('GET ORDER DETAILS ERROR:', error);

        return res.status(500).json({
            message: 'Could not load order details'
        });
    }
});


/* CREATE ORDER */
app.post('/api/orders', authenticateToken, async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const { items } = req.body || {};

        // Validate the cart.
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: 'Your cart must contain at least one product'
            });
        }

        if (items.length > 50) {
            return res.status(400).json({
                message: 'Too many products in one order'
            });
        }

        const seenProductIds = new Set();

        for (const item of items) {
            if (
                !item ||
                !Number.isInteger(item.product_id) ||
                item.product_id <= 0 ||
                !Number.isInteger(item.quantity) ||
                item.quantity <= 0 ||
                item.quantity > 1000
            ) {
                return res.status(400).json({
                    message: 'Each item needs a valid product ID and quantity'
                });
            }

            if (seenProductIds.has(item.product_id)) {
                return res.status(400).json({
                    message: 'Each product should appear only once in the cart'
                });
            }

            seenProductIds.add(item.product_id);
        }

        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        // Retrieve and lock the requested products.
        // Prices submitted by the browser are never trusted.
        const productIds = items.map(item => item.product_id);
        const placeholders = productIds.map(() => '?').join(', ');

        const [products] = await connection.query(
            `SELECT id, name, price, stock_quantity, is_active
             FROM products
             WHERE id IN (${placeholders})
             FOR UPDATE`,
            productIds
        );

        if (products.length !== items.length) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                message: 'One or more products do not exist'
            });
        }

        const productsById = new Map(
            products.map(product => [product.id, product])
        );

        let subtotalCents = 0;
        const orderItems = [];

        for (const item of items) {
            const product = productsById.get(item.product_id);

            if (!product.is_active) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(400).json({
                    message: `${product.name} is no longer available`
                });
            }

            if (product.stock_quantity < item.quantity) {
                await connection.rollback();
                transactionStarted = false;

                return res.status(409).json({
                    message: `Insufficient stock for ${product.name}`,
                    available: product.stock_quantity
                });
            }

            // MySQL DECIMAL values are normally returned as strings.
            // Convert the price to integer cents to avoid float math.
            const [whole, fraction = ''] = String(product.price).split('.');
            const priceCents =
                Number(whole) * 100 +
                Number(fraction.padEnd(2, '0').slice(0, 2));

            const lineTotalCents = priceCents * item.quantity;

            if (!Number.isSafeInteger(lineTotalCents)) {
                throw new Error('Order amount is too large');
            }

            subtotalCents += lineTotalCents;

            orderItems.push({
                product_id: product.id,
                product_name: product.name,
                quantity: item.quantity,
                unit_price: (priceCents / 100).toFixed(2)
            });
        }

        if (
            !Number.isSafeInteger(subtotalCents) ||
            subtotalCents > 9999999999
        ) {
            throw new Error('Order subtotal exceeds the supported amount');
        }

        // Discounts and shipping are not implemented yet.
        const discountCents = 0;
        const shippingCents = 0;
        const totalCents =
            subtotalCents - discountCents + shippingCents;

        // Create the order for the authenticated user.
        const [orderResult] = await connection.query(
            `INSERT INTO orders
                (user_id, subtotal, discount_amount,
                 shipping_cost, total_amount, status, payment_status)
             VALUES (?, ?, ?, ?, ?, 'pending', 'unpaid')`,
            [
                req.user.id,
                (subtotalCents / 100).toFixed(2),
                (discountCents / 100).toFixed(2),
                (shippingCents / 100).toFixed(2),
                (totalCents / 100).toFixed(2)
            ]
        );

        const orderId = orderResult.insertId;

        // Save each product with its purchase-time price and name.
        for (const item of orderItems) {
            await connection.query(
                `INSERT INTO order_items
                    (order_id, product_id, product_name, quantity, unit_price)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.product_id,
                    item.product_name,
                    item.quantity,
                    item.unit_price
                ]
            );

            // Reduce stock inside the same transaction.
            const [stockResult] = await connection.query(
                `UPDATE products
                 SET stock_quantity = stock_quantity - ?
                 WHERE id = ?
                   AND stock_quantity >= ?
                   AND is_active = 1`,
                [
                    item.quantity,
                    item.product_id,
                    item.quantity
                ]
            );

            if (stockResult.affectedRows !== 1) {
                throw new Error('Stock changed while processing the order');
            }
        }

        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            message: 'Order created successfully',
            orderId,
            subtotal: (subtotalCents / 100).toFixed(2),
            discount: (discountCents / 100).toFixed(2),
            shipping: (shippingCents / 100).toFixed(2),
            total: (totalCents / 100).toFixed(2),
            paymentStatus: 'unpaid'
        });

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('ORDER ROLLBACK ERROR:', rollbackError);
            }
        }

        console.error('CREATE ORDER ERROR:', error);

        return res.status(500).json({
            message: 'Could not create order'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// CREATE WORKOUT
app.post('/api/workouts', authenticateToken, async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const {
            workout_type_id,
            workout_date,
            duration_minutes,
            notes,
            exercises
        } = req.body || {};

        // Normalize running values before validating or saving.
        const running = normalizeRunningDetails(req.body?.running);

        if (!Number.isInteger(workout_type_id) || workout_type_id <= 0) {
            return res.status(400).json({
                message: 'Valid workout type is required'
            });
        }

        if (typeof workout_date !== 'string' || !workout_date.trim()) {
            return res.status(400).json({
                message: 'Workout date is required'
            });
        }

        if (!Number.isInteger(duration_minutes) || duration_minutes <= 0) {
            return res.status(400).json({
                message: 'Duration must be a positive integer'
            });
        }

        if (notes != null && typeof notes !== 'string') {
            return res.status(400).json({
                message: 'Notes must be a string or null'
            });
        }

        const [types] = await db.query(
            'SELECT id, name FROM workout_type WHERE id = ?',
            [workout_type_id]
        );

        if (types.length === 0) {
            return res.status(400).json({
                message: 'Invalid workout type'
            });
        }

        const workoutType = types[0].name;

        if (workoutType === 'Running') {
            if (
                !running ||
                typeof running.distance_km !== 'number' ||
                !Number.isFinite(running.distance_km) ||
                running.distance_km <= 0
            ) {
                return res.status(400).json({
                    message: 'A positive running distance is required'
                });
            }

            if (
                running.avg_pace_seconds_per_km != null &&
                (
                    !Number.isInteger(running.avg_pace_seconds_per_km) ||
                    running.avg_pace_seconds_per_km <= 0
                )
            ) {
                return res.status(400).json({
                    message: 'Average pace must be a positive integer in seconds per kilometer'
                });
            }

            if (
                running.avg_heart_rate != null &&
                (
                    !Number.isInteger(running.avg_heart_rate) ||
                    running.avg_heart_rate < 0
                )
            ) {
                return res.status(400).json({
                    message: 'Average heart rate must be a non-negative integer'
                });
            }

            if (
                running.elevation_gain_m != null &&
                (
                    !Number.isInteger(running.elevation_gain_m) ||
                    running.elevation_gain_m < 0
                )
            ) {
                return res.status(400).json({
                    message: 'Elevation gain must be a non-negative integer'
                });
            }
        }

        if (workoutType === 'Strength Training') {
            if (!Array.isArray(exercises) || exercises.length === 0) {
                return res.status(400).json({
                    message: 'Add at least one exercise'
                });
            }

            for (const exercise of exercises) {
                if (!Number.isInteger(exercise.exercise_id) || exercise.exercise_id <= 0) {
                    return res.status(400).json({
                        message: 'Every exercise needs a valid exercise ID'
                    });
                }

                if (exercise.notes != null && typeof exercise.notes !== 'string') {
                    return res.status(400).json({
                        message: 'Exercise notes must be a string or null'
                    });
                }

                if (!Array.isArray(exercise.sets) || exercise.sets.length === 0) {
                    return res.status(400).json({
                        message: 'Every exercise needs at least one set'
                    });
                }

                for (const set of exercise.sets) {
                    if (set.reps != null && (!Number.isInteger(set.reps) || set.reps < 0)) {
                        return res.status(400).json({
                            message: 'Reps must be a non-negative integer'
                        });
                    }

                    if (
                        set.weight_kg != null &&
                        (
                            typeof set.weight_kg !== 'number' ||
                            !Number.isFinite(set.weight_kg) ||
                            set.weight_kg < 0
                        )
                    ) {
                        return res.status(400).json({
                            message: 'Weight must be a non-negative number'
                        });
                    }

                    if (
                        set.duration_minutes != null &&
                        (!Number.isInteger(set.duration_minutes) || set.duration_minutes < 0)
                    ) {
                        return res.status(400).json({
                            message: 'Set duration must be a non-negative integer'
                        });
                    }

                    if (set.reps == null && set.duration_minutes == null) {
                        return res.status(400).json({
                            message: 'Each set needs reps or a duration'
                        });
                    }
                }
            }
        }

        if (workoutType !== 'Running' && workoutType !== 'Strength Training') {
            return res.status(400).json({
                message: 'Unsupported workout type'
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [workoutResult] = await connection.query(
            `INSERT INTO workout
                (user_id, workout_type_id, workout_date,
                 duration_minutes, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [
                req.user.id,
                workout_type_id,
                workout_date,
                duration_minutes,
                notes?.trim() || null
            ]
        );

        const workoutId = workoutResult.insertId;

        // Save running details and calculate duration in seconds.
        if (workoutType === 'Running') {
            const runningDurationSeconds =
                running.avg_pace_seconds_per_km != null
                    ? Math.round(
                        running.distance_km * running.avg_pace_seconds_per_km
                    )
                    : null;

            await connection.query(
                `INSERT INTO workout_running
                    (workout_id, distance_km, avg_pace_seconds_per_km,
                     running_duration_seconds, avg_heart_rate, elevation_gain_m)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    workoutId,
                    running.distance_km,
                    running.avg_pace_seconds_per_km,
                    runningDurationSeconds,
                    running.avg_heart_rate,
                    running.elevation_gain_m
                ]
            );
        }

        // Save strength exercises and sets.
        if (workoutType === 'Strength Training') {
            for (let i = 0; i < exercises.length; i++) {
                const exercise = exercises[i];

                const [exerciseRows] = await connection.query(
                    'SELECT id FROM exercises WHERE id = ?',
                    [exercise.exercise_id]
                );

                if (exerciseRows.length === 0) {
                    throw new Error(`Exercise ${exercise.exercise_id} does not exist`);
                }

                const [exerciseResult] = await connection.query(
                    `INSERT INTO strength_exercises
                        (workout_id, exercise_id, exercise_order, notes)
                     VALUES (?, ?, ?, ?)`,
                    [
                        workoutId,
                        exercise.exercise_id,
                        i + 1,
                        exercise.notes?.trim() || null
                    ]
                );

                const strengthExerciseId = exerciseResult.insertId;

                for (let j = 0; j < exercise.sets.length; j++) {
                    const set = exercise.sets[j];

                    await connection.query(
                        `INSERT INTO strength_sets
                            (strength_exercise_id, set_number, reps,
                             weight_kg, duration_minutes)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            strengthExerciseId,
                            j + 1,
                            set.reps ?? null,
                            set.weight_kg ?? null,
                            set.duration_minutes ?? null
                        ]
                    );
                }
            }
        }

        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            message: 'Workout created successfully',
            workoutId
        });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error('CREATE WORKOUT ERROR:', error);

        if (error.message?.includes('does not exist')) {
            return res.status(400).json({
                message: 'One of the selected exercises does not exist'
            });
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({
                message: 'Invalid workout type or exercise'
            });
        }

        return res.status(500).json({
            message: 'Could not save workout'
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// GET EXERCISE CATALOG
app.get('/api/exercises', authenticateToken, async (req, res) => {
    try {
        const [exercises] = await db.query(
            `SELECT id, exercise_name, muscle_group, equipment, description
             FROM exercises
             ORDER BY muscle_group, exercise_name`
        );

        res.json(exercises);
    } catch (error) {
        console.error('GET EXERCISES ERROR:', error);
        res.status(500).json({
            message: 'Could not load exercises'
        });
    }
});

// GET CURRENT USER WORKOUTS
app.get('/api/workouts', authenticateToken, async (req, res) => {
    try {
        const [workouts] = await db.query(
            `SELECT
                w.id,
                w.workout_type_id,
                wt.name AS workout_type,
                w.workout_date,
                w.duration_minutes,
                w.notes,
                w.created_at
             FROM workout w
             JOIN workout_type wt ON wt.id = w.workout_type_id
             WHERE w.user_id = ?
             ORDER BY w.workout_date DESC`,
            [req.user.id]
        );

        res.json(workouts);
    } catch (error) {
        console.error('GET WORKOUTS ERROR:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

// ADD RUNNING DETAILS TO AN EXISTING WORKOUT
app.post('/api/workouts/:id/running', authenticateToken, async (req, res) => {
    try {
        const workoutId = Number(req.params.id);

        const {
            distance_km
        } = req.body || {};

        const running = normalizeRunningDetails(req.body || {});

        const {
            avg_pace_seconds_per_km,
            avg_heart_rate,
            elevation_gain_m
        } = running;

        if (!Number.isInteger(workoutId) || workoutId <= 0) {
            return res.status(400).json({ message: 'Invalid workout ID' });
        }

        if (
            typeof distance_km !== 'number' ||
            !Number.isFinite(distance_km) ||
            distance_km <= 0
        ) {
            return res.status(400).json({
                message: 'Distance must be a positive number'
            });
        }

        if (
            avg_pace_seconds_per_km != null &&
            (!Number.isInteger(avg_pace_seconds_per_km) || avg_pace_seconds_per_km <= 0)
        ) {
            return res.status(400).json({
                message: 'Average pace must be a positive integer in seconds per kilometer'
            });
        }

        if (
            avg_heart_rate != null &&
            (!Number.isInteger(avg_heart_rate) || avg_heart_rate < 0)
        ) {
            return res.status(400).json({
                message: 'Average heart rate must be a non-negative integer'
            });
        }

        if (
            elevation_gain_m != null &&
            (!Number.isInteger(elevation_gain_m) || elevation_gain_m < 0)
        ) {
            return res.status(400).json({
                message: 'Elevation gain must be a non-negative integer'
            });
        }

        const [workouts] = await db.query(
            `SELECT w.id
             FROM workout w
             JOIN workout_type wt ON wt.id = w.workout_type_id
             WHERE w.id = ?
               AND w.user_id = ?
               AND wt.name = 'Running'`,
            [workoutId, req.user.id]
        );

        if (workouts.length === 0) {
            return res.status(404).json({
                message: 'Running workout not found for this user'
            });
        }

        const [existing] = await db.query(
            'SELECT workout_id FROM workout_running WHERE workout_id = ?',
            [workoutId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: 'Running details already exist for this workout'
            });
        }

        const runningDurationSeconds =
            avg_pace_seconds_per_km != null
                ? Math.round(distance_km * avg_pace_seconds_per_km)
                : null;

        await db.query(
            `INSERT INTO workout_running
                (workout_id, distance_km, avg_pace_seconds_per_km,
                 running_duration_seconds, avg_heart_rate, elevation_gain_m)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                workoutId,
                distance_km,
                avg_pace_seconds_per_km,
                runningDurationSeconds,
                avg_heart_rate,
                elevation_gain_m
            ]
        );

        return res.status(201).json({
            message: 'Running details created successfully',
            workoutId
        });
    } catch (error) {
        console.error('CREATE RUNNING DETAILS ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ADD EXERCISE TO A STRENGTH WORKOUT
app.post('/api/workouts/:id/exercises', authenticateToken, async (req, res) => {
    try {
        const workoutId = Number(req.params.id);
        const { exercise_id, exercise_order, notes } = req.body || {};

        if (!Number.isInteger(workoutId) || workoutId <= 0) {
            return res.status(400).json({
                message: 'Invalid workout ID'
            });
        }

        if (!Number.isInteger(exercise_id) || exercise_id <= 0) {
            return res.status(400).json({
                message: 'Valid exercise ID is required'
            });
        }

        if (!Number.isInteger(exercise_order) || exercise_order <= 0) {
            return res.status(400).json({
                message: 'Exercise order must be a positive integer'
            });
        }

        const [workouts] = await db.query(
            `SELECT w.id
             FROM workout w
             JOIN workout_type wt ON wt.id = w.workout_type_id
             WHERE w.id = ?
               AND w.user_id = ?
               AND wt.name = 'Strength Training'`,
            [workoutId, req.user.id]
        );

        if (workouts.length === 0) {
            return res.status(404).json({
                message: 'Strength workout not found for this user'
            });
        }

        const [exercises] = await db.query(
            'SELECT id FROM exercises WHERE id = ?',
            [exercise_id]
        );

        if (exercises.length === 0) {
            return res.status(400).json({
                message: 'Exercise does not exist'
            });
        }

        const [result] = await db.query(
            `INSERT INTO strength_exercises
                (workout_id, exercise_id, exercise_order, notes)
             VALUES (?, ?, ?, ?)`,
            [
                workoutId,
                exercise_id,
                exercise_order,
                notes ?? null
            ]
        );

        return res.status(201).json({
            message: 'Exercise added to workout successfully',
            strengthExerciseId: result.insertId
        });

    } catch (error) {
        console.error('ADD STRENGTH EXERCISE ERROR:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'This exercise order is already used in this workout'
            });
        }

        res.status(500).json({
            message: 'Server error'
        });
    }
});

// ADD SET TO A STRENGTH EXERCISE
app.post('/api/strength-exercises/:id/sets', authenticateToken, async (req, res) => {
    try {
        const strengthExerciseId = Number(req.params.id);
        const { set_number, reps, weight_kg, duration_minutes } = req.body || {};

        if (!Number.isInteger(strengthExerciseId) || strengthExerciseId <= 0) {
            return res.status(400).json({ message: 'Invalid strength exercise ID' });
        }

        if (!Number.isInteger(set_number) || set_number <= 0) {
            return res.status(400).json({ message: 'Set number must be a positive integer' });
        }

        if (reps != null && (!Number.isInteger(reps) || reps < 0)) {
            return res.status(400).json({ message: 'Reps must be a non-negative integer' });
        }

        if (
            weight_kg != null &&
            (typeof weight_kg !== 'number' || !Number.isFinite(weight_kg) || weight_kg < 0)
        ) {
            return res.status(400).json({ message: 'Weight must be a non-negative number' });
        }

        if (duration_minutes != null && (!Number.isInteger(duration_minutes) || duration_minutes < 0)) {
            return res.status(400).json({ message: 'Duration must be a non-negative integer' });
        }

        if (reps == null && duration_minutes == null) {
            return res.status(400).json({
                message: 'Provide reps or duration_minutes'
            });
        }

        const [exercises] = await db.query(
            `SELECT se.id
             FROM strength_exercises se
             JOIN workout w ON w.id = se.workout_id
             JOIN workout_type wt ON wt.id = w.workout_type_id
             WHERE se.id = ?
               AND w.user_id = ?
               AND wt.name = 'Strength Training'`,
            [strengthExerciseId, req.user.id]
        );

        if (exercises.length === 0) {
            return res.status(404).json({
                message: 'Strength exercise not found for this user'
            });
        }

        const [result] = await db.query(
            `INSERT INTO strength_sets
                (strength_exercise_id, set_number, reps, weight_kg, duration_minutes)
             VALUES (?, ?, ?, ?, ?)`,
            [
                strengthExerciseId,
                set_number,
                reps ?? null,
                weight_kg ?? null,
                duration_minutes ?? null
            ]
        );

        return res.status(201).json({
            message: 'Set added successfully',
            setId: result.insertId
        });
    } catch (error) {
        console.error('ADD STRENGTH SET ERROR:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'This set number already exists for this exercise'
            });
        }

        return res.status(500).json({ message: 'Server error' });
    }
});

// GET WORKOUT DETAILS
app.get('/api/workouts/:id', authenticateToken, async (req, res) => {
    try {
        const workoutId = Number(req.params.id);

        if (!Number.isInteger(workoutId) || workoutId <= 0) {
            return res.status(400).json({
                message: 'Invalid workout ID'
            });
        }

        const [workouts] = await db.query(
            `SELECT
                w.id,
                w.workout_type_id,
                wt.name AS workout_type,
                w.workout_date,
                w.duration_minutes,
                w.notes,
                w.created_at
             FROM workout w
             JOIN workout_type wt ON wt.id = w.workout_type_id
             WHERE w.id = ? AND w.user_id = ?`,
            [workoutId, req.user.id]
        );

        if (workouts.length === 0) {
            return res.status(404).json({
                message: 'Workout not found'
            });
        }

        const workout = workouts[0];

        if (workout.workout_type === 'Running') {
            const [runningDetails] = await db.query(
                `SELECT
                    distance_km,
                    avg_pace_seconds_per_km,
                    running_duration_seconds,
                    avg_heart_rate,
                    elevation_gain_m
                 FROM workout_running
                 WHERE workout_id = ?`,
                [workoutId]
            );

            workout.running = runningDetails[0] || null;
        }

        if (workout.workout_type === 'Strength Training') {
            const [exercises] = await db.query(
                `SELECT
                    se.id AS strength_exercise_id,
                    se.exercise_id,
                    e.exercise_name,
                    e.muscle_group,
                    e.equipment,
                    se.exercise_order,
                    se.notes
                 FROM strength_exercises se
                 JOIN exercises e ON e.id = se.exercise_id
                 WHERE se.workout_id = ?
                 ORDER BY se.exercise_order`,
                [workoutId]
            );

            for (const exercise of exercises) {
                const [sets] = await db.query(
                    `SELECT
                        id AS set_id,
                        set_number,
                        reps,
                        weight_kg,
                        duration_minutes
                     FROM strength_sets
                     WHERE strength_exercise_id = ?
                     ORDER BY set_number`,
                    [exercise.strength_exercise_id]
                );

                exercise.sets = sets;
            }

            workout.exercises = exercises;
        }

        return res.json(workout);
    } catch (error) {
        console.error('GET WORKOUT DETAILS ERROR:', error);

        return res.status(500).json({
            message: 'Server error'
        });
    }
});

// UPDATE WORKOUT AND ALL TYPE-SPECIFIC DETAILS
app.put('/api/workouts/:id', authenticateToken, async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const workoutId = Number(req.params.id);
        const {
            workout_type_id,
            workout_date,
            duration_minutes,
            notes,
            exercises
        } = req.body || {};

        const running = normalizeRunningDetails(req.body?.running);

        if (!Number.isInteger(workoutId) || workoutId <= 0) {
            return res.status(400).json({ message: 'Invalid workout ID' });
        }

        if (![1, 2].includes(workout_type_id)) {
            return res.status(400).json({ message: 'Invalid workout type' });
        }

        if (
            typeof workout_date !== 'string' ||
            !workout_date.trim() ||
            !Number.isInteger(duration_minutes) ||
            duration_minutes <= 0 ||
            (notes != null && typeof notes !== 'string')
        ) {
            return res.status(400).json({
                message: 'Invalid workout date, duration, or notes'
            });
        }

        const [types] = await db.query(
            'SELECT id, name FROM workout_type WHERE id = ?',
            [workout_type_id]
        );

        if (types.length === 0) {
            return res.status(400).json({ message: 'Invalid workout type' });
        }

        const workoutType = types[0].name;

        if (workoutType === 'Running') {
            if (
                !running ||
                typeof running.distance_km !== 'number' ||
                !Number.isFinite(running.distance_km) ||
                running.distance_km <= 0
            ) {
                return res.status(400).json({
                    message: 'A positive running distance is required'
                });
            }

            for (const field of [
                'avg_pace_seconds_per_km',
                'avg_heart_rate',
                'elevation_gain_m'
            ]) {
                const value = running[field];

                if (
                    value != null &&
                    (
                        !Number.isInteger(value) ||
                        value < (field === 'avg_pace_seconds_per_km' ? 1 : 0)
                    )
                ) {
                    return res.status(400).json({
                        message: `Invalid running field: ${field}`
                    });
                }
            }
        }

        if (workoutType === 'Strength Training') {
            if (!Array.isArray(exercises) || exercises.length === 0) {
                return res.status(400).json({
                    message: 'Add at least one exercise'
                });
            }

            for (const exercise of exercises) {
                if (
                    !Number.isInteger(exercise.exercise_id) ||
                    exercise.exercise_id <= 0 ||
                    !Array.isArray(exercise.sets) ||
                    exercise.sets.length === 0
                ) {
                    return res.status(400).json({
                        message: 'Each exercise needs a valid ID and at least one set'
                    });
                }

                for (const set of exercise.sets) {
                    if (
                        (set.reps != null && (!Number.isInteger(set.reps) || set.reps < 0)) ||
                        (set.weight_kg != null && (
                            typeof set.weight_kg !== 'number' ||
                            !Number.isFinite(set.weight_kg) ||
                            set.weight_kg < 0
                        )) ||
                        (set.duration_minutes != null && (
                            !Number.isInteger(set.duration_minutes) ||
                            set.duration_minutes < 0
                        )) ||
                        (set.reps == null && set.duration_minutes == null)
                    ) {
                        return res.status(400).json({
                            message: 'Invalid set data'
                        });
                    }
                }
            }
        }

        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [existing] = await connection.query(
            'SELECT id FROM workout WHERE id = ? AND user_id = ? FOR UPDATE',
            [workoutId, req.user.id]
        );

        if (existing.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({ message: 'Workout not found' });
        }

        await connection.query(
            `UPDATE workout
             SET workout_type_id = ?, workout_date = ?,
                 duration_minutes = ?, notes = ?
             WHERE id = ? AND user_id = ?`,
            [
                workout_type_id,
                workout_date,
                duration_minutes,
                notes?.trim() || null,
                workoutId,
                req.user.id
            ]
        );

        await connection.query(
            'DELETE FROM workout_running WHERE workout_id = ?',
            [workoutId]
        );

        await connection.query(
            'DELETE FROM strength_exercises WHERE workout_id = ?',
            [workoutId]
        );

        if (workoutType === 'Running') {
            const runningDurationSeconds =
                running.avg_pace_seconds_per_km != null
                    ? Math.round(
                        running.distance_km * running.avg_pace_seconds_per_km
                    )
                    : null;

            await connection.query(
                `INSERT INTO workout_running
                    (workout_id, distance_km, avg_pace_seconds_per_km,
                     running_duration_seconds, avg_heart_rate, elevation_gain_m)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    workoutId,
                    running.distance_km,
                    running.avg_pace_seconds_per_km,
                    runningDurationSeconds,
                    running.avg_heart_rate,
                    running.elevation_gain_m
                ]
            );

        } else if (workoutType === 'Strength Training') {
            for (let i = 0; i < exercises.length; i++) {
                const exercise = exercises[i];

                const [exerciseRows] = await connection.query(
                    'SELECT id FROM exercises WHERE id = ?',
                    [exercise.exercise_id]
                );

                if (exerciseRows.length === 0) {
                    throw new Error(`Exercise ${exercise.exercise_id} does not exist`);
                }

                const [result] = await connection.query(
                    `INSERT INTO strength_exercises
                        (workout_id, exercise_id, exercise_order, notes)
                     VALUES (?, ?, ?, ?)`,
                    [
                        workoutId,
                        exercise.exercise_id,
                        i + 1,
                        exercise.notes?.trim() || null
                    ]
                );

                for (let j = 0; j < exercise.sets.length; j++) {
                    const set = exercise.sets[j];

                    await connection.query(
                        `INSERT INTO strength_sets
                            (strength_exercise_id, set_number, reps,
                             weight_kg, duration_minutes)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            result.insertId,
                            j + 1,
                            set.reps ?? null,
                            set.weight_kg ?? null,
                            set.duration_minutes ?? null
                        ]
                    );
                }
            }
        }

        await connection.commit();
        transactionStarted = false;

        return res.json({ message: 'Workout updated successfully' });

    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        console.error('UPDATE WORKOUT ERROR:', error);

        if (error.message?.includes('does not exist')) {
            return res.status(400).json({
                message: 'One of the selected exercises does not exist'
            });
        }

        return res.status(500).json({ message: 'Could not update workout' });

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// DELETE WORKOUT
app.delete('/api/workouts/:id', authenticateToken, async (req, res) => {
    try {
        const workoutId = Number(req.params.id);

        if (!Number.isInteger(workoutId) || workoutId <= 0) {
            return res.status(400).json({
                message: 'Invalid workout ID'
            });
        }

        const [result] = await db.query(
            'DELETE FROM workout WHERE id = ? AND user_id = ?',
            [workoutId, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Workout not found'
            });
        }

        return res.json({
            message: 'Workout deleted successfully'
        });
    } catch (error) {
        console.error('DELETE WORKOUT ERROR:', error);
        return res.status(500).json({
            message: 'Server error'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
