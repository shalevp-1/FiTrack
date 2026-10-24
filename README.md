# FiTrack

A full-stack fitness tracking and product management application built with Angular, Node.js, Express, and MySQL.

FiTrack lets users track running and strength workouts, monitor training progress, shop for products, and manage orders. It also includes role-protected administration tools for product management and inventory restocking.

**[Live Demo](https://fitrackfitness.netlify.app/home)** 

## Demo Access

Use the live application to explore FiTrack with the following demo accounts.

| Account | Username | Password |
|---|---|---|
| Regular user | `demo` | `demo` |
| Administrator | `admin` | `admin` |

The regular account provides access to workout tracking, the dashboard, products, checkout, and order history. The administrator account also provides access to product management and inventory workflows.

These are public demo credentials for evaluation purposes only. The accounts use demo data; do not store real or sensitive information in them.

## Product Tour

### Fitness Dashboard

View workout summaries, activity charts, monthly running distance, and a workout calendar.

![FiTrack dashboard demo](docs/Dashboard.gif)

### Workout Tracking

Create, view, edit, and delete running and strength workouts, with activity-specific metrics and exercise sets.

![FiTrack workout tracking demo](docs/Workouts.gif)

### Admin Inventory Management

Administrators can manage product details, monitor stock levels, and restock existing products without creating duplicate entries.

![FiTrack inventory restocking demo](docs/Admin%20restock.gif)

## Features

- **Authentication and authorization:** Registration, login, HTTP-only cookie authentication, and role-protected administrative operations.
- **Running workouts:** Record distance, pace, heart rate, and elevation.
- **Strength workouts:** Track exercises and sets.
- **Progress dashboard:** Review training activity, monthly running distance, and workout history.
- **Product catalog and checkout:** Browse products, manage a cart, place orders, and review order history.
- **Inventory administration:** Add, edit, deactivate, and manage products, including restocking existing inventory.
- **Low-stock warnings:** Identify products with fewer than five units in stock.

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | Angular, TypeScript, RxJS, HTML, CSS |
| Backend | Node.js, Express |
| Database | MySQL, `mysql2` |
| Authentication | JWT in HTTP-only cookies, bcrypt |
| Frontend hosting | Netlify |
| API hosting | Render |
| Database hosting | Aiven |

## Architecture

The Angular frontend communicates with the Express REST API. The backend handles authentication, authorization, request validation, application logic, and database operations.

![FiTrack application architecture](docs/Architecture.drawio.png)

The relational database models users, workouts, running details, strength exercises and sets, products, and orders.

![FiTrack database relationship diagram](docs/DatabaseERD.png)

## Technical Highlights

- **Secure authentication:** Password hashing with bcrypt and JWT-based authentication using HTTP-only cookies.
- **Server-side authorization:** Administrative operations enforce role checks on the backend.
- **Parameterized SQL:** User-provided values are passed as query parameters.
- **Transactional checkout:** Order creation and inventory updates use database transactions to maintain consistency.
- **Inventory integrity:** Stock availability is checked during checkout, and order items preserve purchase-price information.
- **Full-stack deployment:** Frontend, API, and database run as separate services.

## Technical Details

<details>
<summary><strong>Run locally</strong></summary>

### Prerequisites

- Node.js 20 or later
- MySQL 8.0 or later
- The MySQL command-line client

### 1. Create and initialize a local database

**Important:** Use a new, disposable local database. The schema creates tables and is intended to run once in that database. Never run these commands against production or an existing database containing data you need.

From the repository root, create the database and load the schema and demo seed:

```powershell
mysql -u root -p -e "CREATE DATABASE fitrack CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
cmd /c "mysql -u root -p fitrack < backend\sql\schema.sql"
cmd /c "mysql -u root -p fitrack < backend\sql\demo-seed.sql"
```

The seed provides local demo users, workouts, exercise types, exercise catalog entries, and products. These accounts are separate from the live demo accounts listed above.

Local demo credentials:

- Regular user: `demo` / `DemoUser2026!`
- Administrator: `admin` / `AdminDemo2026!`

If a seeded username or email conflicts with an existing record, the seed does not attach sample workouts to a different user. Re-running the seed preserves existing rows and does not reset changed local passwords. To restore the documented credentials, initialize a fresh local database.

### 2. Configure and start the API

From the repository root:

```powershell
cd backend
npm install
```

Create `backend/.env` with your local configuration:

```dotenv
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-bytes
CLIENT_ORIGINS=http://localhost:4200

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=fitrack
```

Generate a unique random JWT secret of at least 32 bytes. Replace the example database password with your own local MySQL password.

Start the API:

```powershell
npm start
```

The backend requires `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. `DB_PORT` defaults to `3306`, and `PORT` defaults to `3000`. `CLIENT_ORIGINS` accepts a comma-separated list of allowed browser origins.

### 3. Start the Angular frontend

Open a second terminal from the repository root:

```powershell
cd frontend
npm install
npm start
```

The Angular development server runs at `http://localhost:4200` and proxies `/api` requests to the local backend at `http://localhost:3000`.

### 4. Build and test the frontend

Run these commands from the `frontend` directory:

```powershell
npm run build
npx ng test --watch=false
```

</details>

<details>
<summary><strong>Deployment and environment configuration</strong></summary>

The frontend is deployed to Netlify using the repository's `netlify.toml`. The Express API runs as a separate Render service, and MySQL is hosted on Aiven.

Configure production secrets and database settings through the hosting providers' environment-variable settings. Do not commit `.env` files or real credentials.

Production deployments should use:

- `NODE_ENV=production`
- A unique JWT secret
- Separate production database credentials
- `DB_SSL_CA` containing the database TLS certificate

Local development does not use database TLS. Production database connections should use the configured TLS settings.

</details>

<details>
<summary><strong>Security considerations</strong></summary>

- New registrations require passwords of at least 8 characters and no more than 72 UTF-8 bytes. Existing shorter passwords remain usable for login.
- Login passwords exceeding bcrypt's 72-byte input limit are rejected rather than silently truncated.
- Login attempts are limited to 10 per 15 minutes per normalized login identifier. Registration is limited to 5 attempts per hour per email.
- These rate limits are in-memory, reset when the backend restarts, and are not shared across multiple backend instances.
- The API does not trust forwarded client-IP headers. Deployments requiring IP-based rate limiting should use a verified trusted-proxy configuration or enforce limits at the edge.
- Passwords are hashed with bcrypt.
- Authentication tokens are issued in HTTP-only cookies.
- Administrative API routes enforce authentication and role authorization on the backend.
- SQL queries use parameterized values for user-provided data.
- Database credentials, JWT secrets, and production TLS configuration are supplied through environment variables.

</details>

## What I Learned

- **Relational schema design:** Modeled workouts, orders, and inventory in MySQL, with relationships and constraints that keep the data consistent.
- **Full-stack development:** Built an end-to-end application with Angular, Node.js, Express, and MySQL.
- **Authentication and authorization:** Implemented cookie-based authentication with server-side role-based access control, so permissions are enforced on the backend and not only in the UI.
- **Data integrity:** Used input validation and database transactions so operations like checkout and inventory updates either complete fully or roll back safely.
- **Cross-layer debugging:** Traced and fixed issues across the frontend, API, and database, then verified each fix by testing the affected flows.
- **Deployment:** Deployed and configured the frontend, backend API, and database as separate services.

## Future Improvements

**Testing and CI**
- Add backend API and integration tests covering checkout, inventory management, cart merging, and transaction rollback.
- Run the tests automatically in CI.

**Backend architecture**
- Refactor the backend into smaller route, controller, and service modules.

**Security**
- Re-validate sessions after role or account-status changes.
- Replace in-memory rate limiting with distributed rate limiting for multi-instance deployments.

**Frontend and performance**
- Optimize workout data retrieval to reduce redundant API requests.
- Break down large components and simplify asynchronous data flows.
- Upgrade Angular to a currently supported version.

**Note:** FiTrack is a demonstration project. Checkout does not process real payments or handle shipping.
