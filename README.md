### Requirements

Before running the project

- Node.js 22 or later
- MongoDB running as a replica set
- npm

MongoDB needs to run in replica set mode because the application uses transactions

### 1. Set up MongoDB

You can use Docker or your locally installed MongoDB.

**Option A: Docker**

If you have Docker installed, run:

```bash
docker compose up -d
```

Add the following connection string to your `.env` file:

```env
MONGODB_URI=mongodb://localhost:27018/payment_withdrawal?replicaSet=rs0
```

**Option B: Local MongoDB (Windows)**

If MongoDB is already installed on your system:

1. Open `C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg` with administrator permissions.
2. Add or enable the following configuration:

```yaml
replication:
  replSetName: rs0
```

3. Restart the MongoDB service using PowerShell as Administrator:

```powershell
Restart-Service MongoDB
```

4. Connect to MongoDB:

```powershell
mongosh "mongodb://127.0.0.1:27017"
```

5. From your project folder, initialize the replica set if it hasn't been initialized already:

```bash
npm run db:init-rs
```

Finally, update your `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/payment_withdrawal?replicaSet=rs0
```

The replica set only needs to be initialized once.

For more details, refer to [DATABASE_SETUP.md](./DATABASE_SETUP.md).

### 2. Install dependencies

Copy the environment file and install the required packages:

```bash
cp .env.example .env
npm install
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env
npm install
```

Make sure your `.env` file contains the correct MongoDB connection string.

### 3. Set up the database

Run the following command to create the required collections and indexes:

```bash
npm run db:setup
```

Next, add some test users with predefined wallet balances:

```bash
npm run db:seed
```

The seed script creates these users:

| User | Wallet Balance | Status |
|---|---|---|
| alice@example.com | ₹10,000 | Active |
| carol@example.com | ₹1,000 | Active |
| bob@example.com | ₹500 | Blocked |

All three accounts use the same password:

```text
Password@123
```

### 4. Start the application

```bash
npm run dev
```

By default, the API and the background withdrawal worker run in the same process.


```bash
curl http://localhost:3000/health
```

## How Withdrawals Work

The withdrawal process is fairly straightforward:

1. A user logs in and receives an authentication token.
2. The user submits a withdrawal request with an amount, payment destination, and an idempotency key.
3. The server validates the request, checks the user's account status, and verifies that the wallet has sufficient funds.
4. If everything is valid, the amount is deducted from the wallet, a transaction log is created, and the withdrawal is saved with a `pending` status.
5. The background worker picks up the request and sends it to the mock payment gateway.
6. If the payout succeeds, the withdrawal is marked as `success`. If it fails, the deducted amount is refunded and the refund is recorded in the ledger.

A withdrawal moves through these statuses:

```text
pending → processing → success
                     ↘ failed
```

The wallet debit, ledger entry, and withdrawal record are handled together using a MongoDB transaction, so a failure during the initial database operation doesn't leave the wallet in an inconsistent state.

## Testing the API

You can test the endpoints using Postman or curl.

The following examples use Alice's account.

### 1. Login

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password@123"}'
```

Copy the `data.token` value from the response. You'll need it for authenticated requests.

### 2. Check wallet balance

```bash
curl -s http://localhost:3000/api/v1/wallet \
  -H "Authorization: Bearer TOKEN"
```

Replace `TOKEN` with the token returned during login.

### 3. Request a withdrawal

For example, to withdraw ₹100:

```bash
curl -s -X POST http://localhost:3000/api/v1/withdrawals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -H "Idempotency-Key: my-withdrawal-key-001" \
  -d '{"amount":"100.00","destination":{"type":"upi","upiId":"alice@okbank"}}'
```

The `amount` field accepts the amount in rupees as a string. The application converts it into paise internally.

Each withdrawal request requires an **Idempotency-Key** header containing 16–64 characters.

This prevents the same withdrawal from being processed twice if a client retries a request with the same key.

### 4. View withdrawal history

```bash
curl -s http://localhost:3000/api/v1/withdrawals \
  -H "Authorization: Bearer TOKEN"
```

You can also check an individual withdrawal using its ID:

```text
GET /api/v1/withdrawals/:id
```

### 5. Register a user

```text
POST /api/v1/auth/register
```

Request body:

```json
{
  "email": "newuser@example.com",
  "password": "Password@123"
}
```

New users start with a zero wallet balance.

There is no deposit API in this project. For testing, wallet balances are added using the seed script or database scripts.

## API Endpoints

Base URL:

```text
http://localhost:3000/api/v1
```

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| POST | `/auth/register` | Register a new user | Not required |
| POST | `/auth/login` | Log in and get a token | Not required |
| GET | `/wallet` | Check wallet balance | Bearer token |
| POST | `/withdrawals` | Request a withdrawal | Bearer token + Idempotency-Key |
| GET | `/withdrawals` | List user withdrawals | Bearer token |
| GET | `/withdrawals/:id` | Get a withdrawal by ID | Bearer token |

The withdrawal API only accepts `amount` and `destination` in the request body.

The user ID is taken from the authenticated token instead of being passed by the client.

## Project Structure

The code is separated into a few folders to keep responsibilities clear.

```text
src/
├── models/          # MongoDB schemas
├── repositories/    # Database queries and updates
├── services/        # Withdrawal logic, gateway and worker
├── controllers/     # Request handlers
└── routes/          # API routes

scripts/             # Database setup, seed and testing scripts
```

The controllers handle incoming requests, services contain the business logic, and repositories handle database operations.

The mock gateway and worker logic are also kept inside the services folder.

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the API in development mode |
| `npm run worker` | Start the withdrawal worker separately |
| `npm run db:init-rs` | Initialize the MongoDB replica set |
| `npm run db:setup` | Create collections and indexes |
| `npm run db:seed` | Add sample users and wallet balances |
| `npm run reconcile` | Verify wallet balances against ledger entries |
| `npm run test:concurrency` | Run the concurrency test |

To run the worker separately, set:

Then start the API and worker in separate terminals.

The API server must be running before executing the concurrency test.

## Handling Common Issues

### Concurrent withdrawal requests

Multiple requests can reach the server at nearly the same time, especially when a user retries an action or makes several withdrawals quickly.

The application uses MongoDB transactions and atomic wallet debits to prevent requests from spending the same balance.

### Duplicate requests

An idempotency key is required for every withdrawal.

If a request is retried using the same key, the system treats it as the same withdrawal rather than creating another debit.

### Failed payouts

The mock gateway can return a failed payout.

When a payout is confirmed as failed, the service refunds the withdrawn amount and creates a ledger entry for that refund.

This keeps a record of both the original debit and the money returned to the wallet.

### Worker retries

Withdrawal jobs are claimed using worker locks to prevent multiple workers from processing the same job at the same time.

The gateway also uses the same reference when retrying a payout, helping avoid duplicate payments.

## A Few Implementation Details

**Wallet balances**

Money is stored as integer paise instead of floating-point rupees. This avoids calculation errors when adding or subtracting balances.

**Transaction history**

Every wallet balance change is recorded in the `transaction_logs` collection. The ledger is insert-only, so existing transaction records aren't overwritten.

**Request validation**

The API only accepts expected request fields and rejects MongoDB operators such as `$` in user input. Authentication uses signed tokens.

**Mock payment gateway**

The payout integration is implemented in:

```text
src/services/mockGateway.js
```

It's a mock service, so no real money is transferred. The gateway logic is kept separate from the withdrawal logic to make it easier to integrate a real payment provider later.

**Reconciliation**

The reconciliation script checks whether wallet balances match their recorded ledger transactions. This is useful for detecting inconsistencies during testing.