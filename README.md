## 1. Setup

**Requirements**
- Node.js 22+
- MongoDB (Replica Set)
- npm

MongoDB replica set is required for transactions.

**Option A: Docker**

```bash
docker compose up -d
```

Add to `.env`:

```env
MONGODB_URI=mongodb://localhost:27018/payment_withdrawal?replicaSet=rs0
```

**Option B: Local MongoDB**

Enable replica set in `mongod.cfg`:

```yaml
replication:
  replSetName: rs0
```

Restart MongoDB:

```powershell
Restart-Service MongoDB
```

Initialize the replica set once (if not already initialized):

```bash
npm run db:init-rs
```

Add to `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/payment_withdrawal?replicaSet=rs0
```

## 2. Run the Project

```bash
npm install
```

Copy `.env.example` to `.env` and update the MongoDB connection string.

```bash
npm run db:setup
npm run db:seed
npm run dev
```

The API runs at `http://localhost:3000`.

**Test users**

| Email | Balance | Status |
|---|---|---|
| alice@example.com | ₹10,000 | Active |
| carol@example.com | ₹1,000 | Active |
| bob@example.com | ₹500 | Blocked |

Password: `Password@123`

## 3. Architecture

The application follows a simple layered structure:

- **Routes & Controllers:** Handle API requests and responses.
- **Services:** Handle withdrawal validation, wallet debits, refunds, and payout processing.
- **Repositories & Models:** Handle MongoDB operations.
- **Background Worker:** Processes pending withdrawals through a mock gateway.

**Withdrawal flow:**

```text
Login → Request Withdrawal → Validate Balance
       ↓
Debit Wallet + Create Ledger Entry
       ↓
Pending → Processing → Success
                    ↘ Failed → Refund
```

## 4. Concurrency Handling

To avoid balance issues when multiple withdrawal requests happen together:

- MongoDB transactions keep wallet updates and withdrawal records consistent.
- Atomic balance updates prevent users from withdrawing more than their available balance.
- Idempotency keys prevent duplicate withdrawal requests.
- Worker locks prevent multiple workers from processing the same withdrawal.

## 5. Security Decisions

- JWT authentication protects wallet and withdrawal APIs.
- User ID is taken from the token, not the request body.
- Input validation prevents invalid amounts and unexpected fields.
- MongoDB operators are rejected from user input.
- Blocked users cannot request withdrawals.

## 6. Assumptions

- This is a demo project, so payouts use a mock gateway.
- All money is stored in paise to avoid floating-point issues.
- New users start with a zero balance.
- There is no deposit API; test balances are added using the seed script.
- Failed payouts are refunded and recorded in the transaction ledger.
- MongoDB must run as a replica set.

## 7. Useful Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API |
| `npm run worker` | Run worker separately |
| `npm run db:seed` | Add test users |
| `npm run reconcile` | Verify wallet balances |
| `npm run test:concurrency` | Test concurrent withdrawals |