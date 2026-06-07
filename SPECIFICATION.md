# Banking Application — Technical Specification & PRD

**Document version:** 1.0  
**Last updated:** June 7, 2026  
**Status:** Living document — authoritative source of truth for implementation

This document defines the full-stack Banking Application architecture, data contracts, API behavior, validation rules, real-time features, test requirements, and user-journey scripts. Any developer or AI agent implementing or extending this system **must** follow this specification exactly. When behavior is ambiguous, this document takes precedence over assumptions.

---

## Table of Contents

1. [System Architecture & Tech Stack](#1-system-architecture--tech-stack)
2. [Database Models & Schema Design](#2-database-models--schema-design)
3. [API Endpoints, Routes & Strict Validations](#3-api-endpoints-routes--strict-validations)
4. [Real-Time & Future Interactive Features](#4-real-time--future-interactive-features)
5. [Step-by-Step User Use-Cases & Edge-Case Scenarios](#5-step-by-step-user-use-cases--edge-case-scenarios)
6. [Appendix A — Environment Variables](#appendix-a--environment-variables)
7. [Appendix B — Testing Requirements](#appendix-b--testing-requirements)
8. [Appendix C — Implementation Status Matrix](#appendix-c--implementation-status-matrix)

---

## 1. System Architecture & Tech Stack

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                              │
│  React SPA (Vite, port 3000)                                            │
│  ├── Landing / Login / Signup / Verify / Dashboard                      │
│  ├── TransferModal, ReceiptModal, NotificationCenter                    │
│  ├── BankingBot (AI assistant UI)                                       │
│  └── Socket.io-client (real-time notifications)                         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS / REST + WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express, port 5000)              │
│  ├── app.js          — Express app, CORS, Swagger, route mounting       │
│  ├── server.js       — HTTP server, MongoDB connection, Socket.io       │
│  ├── routes/         — auth, bank, notifications, bot                   │
│  ├── middleware/     — JWT auth (protect)                               │
│  ├── models/         — User, Transaction, Notification                  │
│  ├── services/       — bankingOperations, aiAssistantService           │
│  └── tests/          — Jest + Supertest integration tests               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     MongoDB (Mongoose ODM)                              │
│  Collections: users, transactions, notifications                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Backend Stack

| Technology | Version / Package | Purpose |
|---|---|---|
| Node.js | 20 (Docker base image) | Runtime |
| Express | ^5.2.1 | HTTP API framework |
| MongoDB + Mongoose | ^9.6.2 | Persistent data store & ODM |
| Socket.io | ^4.8.3 | Real-time WebSocket events |
| jsonwebtoken | ^9.0.3 | JWT issuance & verification |
| bcryptjs | ^3.0.3 | Password hashing (salt rounds: 10) |
| cors | ^2.8.6 | Cross-origin API access |
| dotenv | ^17.4.2 | Environment variable loading |
| swagger-jsdoc + swagger-ui-express | ^6.2.8 / ^5.0.1 | API documentation at `/api-docs` |
| @langchain/* + zod | various | AI banking assistant (Google Gemini) |
| Jest + Supertest | ^30.4.2 / ^7.2.2 | Backend integration tests |

**Entry points:**
- `app.js` — exports the Express application (used by tests and `server.js`).
- `server.js` — creates HTTP server, attaches Socket.io, connects to MongoDB, listens on `PORT`.

### 1.3 Frontend Stack

| Technology | Version / Package | Purpose |
|---|---|---|
| React | ^19.2.6 | UI framework |
| Vite | ^8.0.12 | Dev server & bundler (**port 3000**) |
| React Router DOM | ^7.15.1 | Client-side routing |
| Axios | ^1.16.1 | HTTP client |
| socket.io-client | ^4.8.3 | Real-time notification listener |
| Cypress | ^15.16.0 | End-to-end (E2E) tests |

**Routes (React Router):**

| Path | Component | Access |
|---|---|---|
| `/` | `Landing` (hero view) | Public |
| `/login` | `Landing` (login view) | Public |
| `/signup` | `Signup` (redirects to Landing register view) | Public |
| `/verify` | `Verify` | Public (magic-link token in query string) |
| `/dashboard` | `Dashboard` | Protected (requires `localStorage` token + user) |
| `*` | Redirect to `/` | — |

### 1.4 DevOps & Infrastructure

#### Docker (Backend)

**`Dockerfile`** (project root):
- Base image: `node:20-alpine`
- Workdir: `/app`
- Copies `package*.json`, runs `npm install`
- Copies application source (respects `.dockerignore`)
- Exposes port **5000**
- Default CMD: `npm start` (production)

**`docker-compose.yml`** (current state):
- Single service: `backend`
- Builds from project root Dockerfile
- Maps host port `${PORT:-5000}` → container port `5000`
- Loads secrets from `.env` via `env_file`
- Volume mounts for live-reload during development (`npm run dev`)
- Anonymous volume preserves container `node_modules`

**`.dockerignore`** excludes: `node_modules`, `.env*`, `frontend/`, `*.md`, `Dockerfile`, `docker-compose*.yml`.

> **Target state (planned):** Extend `docker-compose.yml` with a `frontend` service (Vite on port 3000) and optionally a `mongo` service for local development. Until then, frontend runs via `cd frontend && npm run dev` and connects to the backend URL configured in frontend source or environment.

#### Deployment (Current Production)

| Service | Host | URL |
|---|---|---|
| Backend API | Render | `https://bank-backend-frws.onrender.com` |
| Frontend SPA | Vercel | Configured via `frontend/vercel.json` |
| Database | MongoDB Atlas (or equivalent) | Via `MONGO_URI` env var |

#### Port Mapping Summary

| Service | Default Port | Configurable Via |
|---|---|---|
| Backend API | 5000 | `PORT` env var |
| Frontend dev server | 3000 | `vite.config.js` → `server.port` |
| Socket.io | Same as backend (5000) | Shares HTTP server |
| Swagger UI | Same as backend → `/api-docs` | — |

### 1.5 Testing Suite

#### Backend — Jest + Supertest

- **Config:** `jest.config.js`
- **Location:** `tests/**/*.test.js`
- **Strategy:** Integration tests against `app.js` with **mocked Mongoose models** (no live database required).
- **Run:** `npm test` (from project root)

| Test File | Coverage |
|---|---|
| `tests/health.test.js` | `GET /` returns 200 |
| `tests/auth.test.js` | `POST /api/auth/login` — success, wrong password, user not found |
| `tests/bank.test.js` | `POST /api/bank/transaction` — success with reason, insufficient balance |

#### Frontend — Cypress E2E

- **Config:** `frontend/cypress.config.js`
- **Base URL:** `http://localhost:3000`
- **Specs:** `frontend/cypress/e2e/**/*.cy.js`
- **Run:** `cd frontend && npm run cypress:run` (headless) or `npm run cypress:open` (interactive)

| Test File | Coverage (current) |
|---|---|
| `frontend/cypress/e2e/app.cy.js` | Landing page loads; login form renders |

> **Target state (planned):** Expand Cypress to cover full login → transfer → balance update flow (Scenario A below).

---

## 2. Database Models & Schema Design

### 2.1 User Model (`models/User.js`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `username` | `String` | Required, trimmed | Display name; not unique |
| `email` | `String` | Required, unique, lowercase | Primary login identifier |
| `password` | `String` | Required | Stored **hashed** via bcrypt (pre-save hook, salt rounds: 10) |
| `balance` | `Number` | Default: `1000` | Account balance in USD; non-negative enforced at transfer time |
| `isVerified` | `Boolean` | Default: `false` | Must be `true` before login is allowed |
| `verificationCode` | `String` | Optional | 64-char hex token for email verification |
| `verificationCodeExpires` | `Date` | Optional | TTL index — unverified users auto-deleted after expiry |
| `createdAt` | `Date` | Auto (`timestamps`) | — |
| `updatedAt` | `Date` | Auto (`timestamps`) | — |

**Indexes:**
- `{ email: 1 }` — unique (schema-level)
- `{ verificationCodeExpires: 1 }` — TTL with `expireAfterSeconds: 0` (document deleted when field date passes)

**Methods:**
- `comparePassword(candidatePassword)` — bcrypt compare, returns `boolean`

**Password rules:**
- Hashed on every `save()` when `password` field is modified.
- Plain-text password is **never** stored or returned in API responses.

### 2.2 Transaction Model (`models/Transaction.js`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `sender` | `ObjectId` → `User` | Required | Authenticated user initiating transfer |
| `receiver` | `ObjectId` → `User` | Required | Resolved by receiver email at transfer time |
| `amount` | `Number` | Required, `min: 0.01` | Positive numbers only; minimum $0.01 |
| `reason` | `String` | Optional, default `null` | Free-text note (e.g. "Monthly rent") |
| `createdAt` | `Date` | Auto (`timestamps`) | Serves as transaction timestamp |
| `updatedAt` | `Date` | Auto (`timestamps`) | — |

**Implicit status:** Transactions have no explicit `status` field. A record in this collection represents a **completed** transfer. Failed transfers do not create documents.

> **Future enhancement (planned):** Add `status` enum (`pending`, `completed`, `failed`, `reversed`) if async processing or rollback audit is required.

### 2.3 Notification Model (`models/Notification.js`)

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `user` | `ObjectId` → `User` | Required, indexed | Notification recipient |
| `type` | `String` | Default: `'transfer:received'` | Event type identifier |
| `message` | `String` | Required | Human-readable notification text |
| `senderEmail` | `String` | Optional | Email of transfer sender |
| `amount` | `Number` | Optional | Transfer amount |
| `read` | `Boolean` | Default: `false` | Read/unread state |
| `createdAt` | `Date` | Auto (`timestamps`) | — |
| `updatedAt` | `Date` | Auto (`timestamps`) | — |

---

## 3. API Endpoints, Routes & Strict Validations

### 3.1 Global Conventions

**Base URL (local):** `http://localhost:5000`  
**Base URL (production):** `https://bank-backend-frws.onrender.com`

**Authentication header (protected routes):**
```
Authorization: Bearer <JWT_TOKEN>
```

**Content-Type:** `application/json` for all POST/PATCH bodies.

**Standard error response shape:**
```json
{ "error": "<human-readable message>" }
```

**HTTP status codes used:**

| Code | Meaning | When Used |
|---|---|---|
| `200` | OK | Successful GET, PATCH, DELETE, login, transfer, verify |
| `201` | Created | Successful signup (pending verification) |
| `400` | Bad Request | Validation failure, duplicate email, insufficient balance, invalid token |
| `401` | Unauthorized | Missing, invalid, or expired JWT |
| `403` | Forbidden | Unverified account login attempt; accessing another user's dashboard |
| `404` | Not Found | User, receiver, sender, or notification not found |
| `500` | Internal Server Error | Unhandled exceptions, email delivery failure (signup) |
| `503` | Service Unavailable | AI assistant missing API key |

---

### 3.2 Authentication Routes (`/api/auth`)

> **Naming note:** Registration is exposed as `POST /api/auth/signup` (not `/register`). Future aliases may be added, but `signup` is canonical.

#### `POST /api/auth/signup` — Register New User

**Request body:**
```json
{
  "username": "jane_doe",
  "email": "jane@example.com",
  "password": "secret123"
}
```

**Validations:**

| Field | Rule | Error if violated |
|---|---|---|
| `username` | Required, non-empty string | Mongoose validation error → 500 |
| `email` | Required, valid email format, normalized to lowercase | 400 if duplicate |
| `password` | Required (frontend enforces `minLength={6}`) | — |

**Server behavior:**
1. Normalize email to lowercase.
2. Check for existing user with same email → `400 { error: "Email already exists" }`.
3. Create user with `isVerified: false`, default balance `1000`.
4. Generate verification token (32 random bytes → hex, 64 chars).
5. Set `verificationCodeExpires` to **now + 15 minutes**.
6. Send verification email via Brevo API.
7. On email failure: delete the created user, return `500`.

**Success response — `201`:**
```json
{
  "message": "Registration pending verification. Please check your email."
}
```

**Duplicate key race condition:** MongoDB error code `11000` → `400 { error: "Email already exists" }`.

---

#### `POST /api/auth/verify` — Verify Account (Magic Link)

**Request body:**
```json
{
  "token": "<verificationCode from email link>"
}
```

**Validations:**

| Condition | Status | Response |
|---|---|---|
| `token` missing | 400 | `{ error: "Verification token is required" }` |
| Token not found in DB | 400 | `{ error: "Invalid or expired verification token" }` |
| Token expired (`verificationCodeExpires < now`) | 400 | `{ error: "Invalid or expired verification token" }` |

**Success response — `200`:**
```json
{
  "message": "Account verified successfully",
  "user": {
    "_id": "<ObjectId>",
    "username": "jane_doe",
    "email": "jane@example.com",
    "balance": 1000
  },
  "token": "<JWT>"
}
```

**Post-verification:** Clears `verificationCode` and `verificationCodeExpires`; sets `isVerified: true`.

---

#### `POST /api/auth/resend-verification` — Resend Magic Link

**Request body:**
```json
{
  "email": "jane@example.com"
}
```

| Condition | Status | Response |
|---|---|---|
| `email` missing | 400 | `{ error: "Email is required" }` |
| Email not found | 200 | Generic message (prevents enumeration) |
| Account already verified | 400 | `{ error: "This account is already verified. Please log in." }` |
| Email send failure | 500 | `{ error: "Could not send verification email. Please try again later." }` |

**Success response — `200`:**
```json
{
  "message": "If an unverified account exists for this email, a new link has been sent."
}
```

---

#### `POST /api/auth/login` — Authenticate User

**Request body:**
```json
{
  "email": "jane@example.com",
  "password": "secret123"
}
```

**Validations & flow:**

| Step | Condition | Status | Response |
|---|---|---|---|
| 1 | User not found by email | 401 | `{ error: "Invalid credentials" }` |
| 2 | Password does not match (bcrypt) | 401 | `{ error: "Invalid credentials" }` |
| 3 | `isVerified === false` | 403 | `{ error: "Please verify your account first" }` |
| 4 | All checks pass | 200 | See below |

**Success response — `200`:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "<ObjectId string>",
    "username": "jane_doe",
    "email": "jane@example.com",
    "balance": 1000
  },
  "token": "<JWT>"
}
```

**JWT specification:**

| Property | Value |
|---|---|
| Payload | `{ id: <user._id> }` |
| Secret | `process.env.JWT_SECRET` |
| Algorithm | HS256 (jsonwebtoken default) |
| Expiration | **1 hour** (`expiresIn: '1h'`) |
| Header format | `Authorization: Bearer <token>` |

**Password constraints (enforced):**

| Layer | Rule |
|---|---|
| Frontend (`Landing.jsx` signup form) | `minLength={6}` on password input |
| Backend | No explicit length check (relies on bcrypt hashing); **recommended future rule: minimum 6 characters, maximum 128** |

---

### 3.3 Banking Routes (`/api/bank`)

All banking routes require the `protect` middleware (valid JWT).

#### `GET /api/bank/dashboard/:userId` — User Dashboard

**Authorization rules:**
1. JWT must be present and valid → otherwise `401`.
2. `req.params.userId` must equal `decoded.id` from JWT → otherwise `403 { error: "Forbidden: Access denied to this account" }`.

**Success response — `200`:**
```json
{
  "username": "jane_doe",
  "email": "jane@example.com",
  "balance": 900,
  "transactions": [
    {
      "id": "<transactionId>",
      "senderId": "<senderObjectId>",
      "receiverId": "<receiverObjectId>",
      "amount": 100,
      "reason": "Monthly rent",
      "timestamp": "2024-06-01T12:00:00.000Z",
      "type": "sent",
      "counterpartyEmail": "receiver@example.com",
      "counterpartyUsername": "receiver_user",
      "senderEmail": "sender@example.com",
      "receiverEmail": "receiver@example.com",
      "summary": "Sent $100.00 to receiver@example.com"
    }
  ]
}
```

- Returns up to **50** most recent transactions involving the user (as sender or receiver).
- Transactions sorted by `createdAt` descending.

| Condition | Status | Response |
|---|---|---|
| User not found | 404 | `{ error: "User not found" }` |
| Invalid ObjectId format | 404 | `{ error: "User not found" }` |
| Server error | 500 | `{ error: "Server error" }` |

---

#### `POST /api/bank/transaction` — Transfer Funds

**Request body:**
```json
{
  "receiverEmail": "receiver@example.com",
  "amount": 100,
  "reason": "Monthly rent"
}
```

| Field | Required | Validation |
|---|---|---|
| `receiverEmail` | Yes | Trimmed, lowercased; must match an existing verified user |
| `amount` | Yes | Must be finite number > 0 |
| `reason` | No | Trimmed string, max 200 chars (frontend); stored if non-empty |

**Server-side transfer logic (`services/bankingOperations.js`):**

1. Resolve sender from JWT `id`.
2. Resolve receiver by normalized email.
3. Reject self-transfer: `400 { error: "Cannot transfer to your own account" }`.
4. Validate amount: `400 { error: "Amount must be a positive number" }` if not finite or ≤ 0.
5. Check sender balance: `400 { error: "Insufficient balance" }` if `sender.balance < amount`.
6. Deduct from sender, credit receiver (two `save()` calls).
7. Create `Transaction` document.
8. Create `Notification` for receiver.
9. Emit Socket.io event `transfer:received` to receiver's room.

**Success response — `200`:**
```json
{
  "message": "Transaction successful",
  "transaction": {
    "id": "<transactionId>",
    "senderId": "<senderId>",
    "receiverId": "<receiverId>",
    "amount": 100,
    "reason": "Monthly rent",
    "timestamp": "2024-06-01T12:00:00.000Z",
    "type": "sent",
    "counterpartyEmail": "receiver@example.com",
    "counterpartyUsername": "receiver_user",
    "senderEmail": "sender@example.com",
    "receiverEmail": "receiver@example.com",
    "summary": "Sent $100.00 to receiver@example.com"
  }
}
```

**Error responses:**

| Condition | Status | Response |
|---|---|---|
| No JWT / invalid JWT | 401 | `{ error: "Not authorized, no token found" }` or `{ error: "Not authorized, token failed" }` |
| Sender not found | 404 | `{ error: "Sender not found" }` |
| Receiver email not in DB | 404 | `{ error: "Receiver not found" }` |
| Amount ≤ 0 or non-numeric | 400 | `{ error: "Amount must be a positive number" }` |
| Insufficient balance | 400 | `{ error: "Insufficient balance" }` |
| Self-transfer | 400 | `{ error: "Cannot transfer to your own account" }` |
| Unhandled error | 500 | `{ error: "Server error" }` |

> **Known limitation:** Transfers use sequential `save()` calls without MongoDB multi-document transactions. A failure between sender debit and receiver credit could leave inconsistent balances. **Future requirement:** wrap steps 6–8 in a Mongoose session with `startSession()` / `withTransaction()`.

---

### 3.4 Notification Routes (`/api/notifications`)

All routes require JWT.

| Method | Path | Description | Success |
|---|---|---|---|
| `GET` | `/` | List user's notifications (max 100, newest first) | 200 `{ notifications: [...] }` |
| `PATCH` | `/read-all` | Mark all unread as read | 200 `{ message: "All notifications marked as read" }` |
| `PATCH` | `/:id/read` | Mark single notification read | 200 `{ notification: {...} }` |
| `DELETE` | `/:id` | Delete single notification | 200 `{ message: "Notification deleted" }` |

Notification not found → `404 { error: "Notification not found" }`.

---

### 3.5 AI Banking Bot Routes (`/api/bot`)

#### `POST /api/bot/chat` — AI Assistant

**Request body:**
```json
{
  "message": "What is my balance?",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

**Success response — `200`:**
```json
{
  "reply": "Your current balance is $1,000.00.",
  "refreshDashboard": false
}
```

`refreshDashboard: true` when a transfer was executed during the conversation.

**AI tools available to the assistant:**
- `get_user_balance` — fetch authenticated user's balance
- `get_recent_transactions` — fetch recent activity
- `transfer_money` — execute transfer (same logic as REST API)

Requires `GOOGLE_API_KEY` environment variable. Missing key → `503`.

---

### 3.6 Health Check

#### `GET /`

**Response — `200`:**
```json
{ "message": "Bank API is running" }
```

---

## 4. Real-Time & Future Interactive Features

### 4.1 Socket.io Integration (Implemented)

**Server (`server.js`):**
- Socket.io shares the HTTP server on the same port as Express.
- CORS: `origin: '*'`, methods `GET, POST`.
- **Authentication middleware:** Reads `socket.handshake.auth.token`, verifies JWT with `JWT_SECRET`, attaches `socket.userId`.
- On connection: joins room named after `userId` (`socket.join(socket.userId)`).

**Client (`NotificationCenter.jsx`):**
- Connects: `io(SERVER_URL, { auth: { token } })`.
- Listens for event: `transfer:received`.
- On event: prepends notification to state, triggers dashboard refresh callback, shows floating toast (max 4).

**Event payload (`transfer:received`):**
```json
{
  "id": "<notificationId>",
  "type": "transfer:received",
  "message": "You received $100.00 from sender@example.com",
  "senderEmail": "sender@example.com",
  "amount": 100,
  "read": false,
  "timestamp": "2024-06-01T12:00:00.000Z"
}
```

**Socket authentication failures:**
- No token → connection rejected with `Authentication error: no token`.
- Invalid/expired JWT → `Authentication error: invalid token`.

> **Future enhancement:** Emit `balance:updated` event to sender after transfer so dashboard balance updates without manual refresh.

### 4.2 AI Banking Assistant (Implemented)

- Frontend: `BankingBot.jsx` floating chat widget on Dashboard.
- Backend: `services/aiAssistantService.js` using LangChain + Google Gemini.
- Secured by JWT; user identity derived from token, never from client input.
- Can read balance, list transactions, and initiate transfers on behalf of the user.

### 4.3 Video Consultation Feature (Planned — Not Yet Implemented)

**Requirement:** Interactive video call capabilities via **Jitsi Meet API** to allow customers to connect securely with bank support agents.

**Planned architecture:**

```
Dashboard → "Video Support" button → JitsiMeetExternalAPI iframe
                                              │
                                              ▼
                                    meet.jit.si (or self-hosted)
                                              │
                         Room name: banking-app-{userId}-{sessionId}
                         JWT (optional): server-signed Jitsi token for room access
```

**Planned specification:**

| Aspect | Requirement |
|---|---|
| Entry point | New button on Dashboard header: "Video Consultation" |
| Library | `@jitsi/react-sdk` or `JitsiMeetExternalAPI` |
| Room naming | `banking-support-{userId}-{timestamp}` — unique per session |
| Authentication | Only authenticated users (`localStorage` token present) may start a call |
| Pre-call screen | Display agent availability status; user confirms camera/mic permissions |
| Security | Room URLs not guessable; optional server-minted Jitsi JWT with 1-hour expiry |
| UI behavior | Modal overlay with embedded Jitsi iframe; "End Call" button closes modal |
| API (planned) | `POST /api/support/video-session` — returns `{ roomName, jwt, expiresAt }` |
| Edge cases | Camera denied → show error toast; agent offline → queue message |

**Implementation checklist (future):**
- [ ] Add `POST /api/support/video-session` protected route
- [ ] Add `VideoConsultationModal.jsx` component
- [ ] Configure Jitsi domain (public `meet.jit.si` or self-hosted)
- [ ] Add Cypress test: authenticated user opens video modal
- [ ] Document `JITSI_APP_ID`, `JITSI_JWT_SECRET` env vars

---

## 5. Step-by-Step User Use-Cases & Edge-Case Scenarios

Each scenario is numbered for reference. When instructing implementation, cite by scenario ID (e.g. "implement per Scenario B").

---

### Scenario A: Happy Path — Registration, Verification, Login & Transfer

**Preconditions:** No existing account for `sender@example.com` or `receiver@example.com`. Backend and MongoDB running. Email service configured.

#### A.1 — Registration

| Step | Actor | UI | API |
|---|---|---|---|
| 1 | User | Visits `/`, clicks "Open account with us" | — |
| 2 | User | Fills username, email, password (≥ 6 chars), submits | `POST /api/auth/signup` |
| 3 | System | Shows verify prompt; stores email in `localStorage` | Returns `201` |
| 4 | System | Sends verification email with link: `{FRONTEND_URL}/verify?token={code}` | Brevo API call |
| 5 | User | Navigates to `/verify?token=...` from email | `POST /api/auth/verify` |
| 6 | System | Shows "Account verified!", stores JWT + user in `localStorage` | Returns `200` + token |
| 7 | System | Redirects to `/dashboard` after 1.5s | — |

#### A.2 — Login (Returning User)

| Step | Actor | UI | API |
|---|---|---|---|
| 1 | User | Visits `/login`, enters email + password | — |
| 2 | User | Clicks "Log in" | `POST /api/auth/login` |
| 3 | System | Stores `token` and `user` in `localStorage` | Returns `200` + JWT |
| 4 | System | Navigates to `/dashboard` | — |
| 5 | Dashboard | Fetches balance and transactions | `GET /api/bank/dashboard/{userId}` with Bearer token |
| 6 | Dashboard | Displays balance (e.g. `$1000.00`) and transaction list | Returns `200` |

#### A.3 — Transfer Money

| Step | Actor | UI | API |
|---|---|---|---|
| 1 | User | On Dashboard, clicks "Send Money" | — |
| 2 | User | Enters receiver email, amount (e.g. `100`), optional reason | — |
| 3 | User | Clicks "Confirm transfer" | `POST /api/bank/transaction` |
| 4 | System | Closes modal, shows receipt modal | Returns `200` + transaction |
| 5 | System | Refreshes dashboard — balance decremented, transaction in list | `GET /api/bank/dashboard/{userId}` |
| 6 | Receiver (if online) | Sees toast notification + bell badge increment | Socket `transfer:received` |
| 7 | Tests | Jest: transaction test passes; balance math verified | `tests/bank.test.js` |
| 8 | Tests | Cypress (planned): full flow assertion | `frontend/cypress/e2e/` |

**Expected final state:**
- Sender balance: `1000 - 100 = 900`
- Receiver balance: `1000 + 100 = 1100`
- Transaction record exists with `amount: 100`, `reason: "..."`.
- Notification created for receiver.

---

### Scenario B: Security / Unauthorized Access

#### B.1 — No Token

| Step | Actor | Action | Expected Result |
|---|---|---|---|
| 1 | Client | `GET /api/bank/dashboard/{userId}` without `Authorization` header | `401 { error: "Not authorized, no token found" }` |
| 2 | UI | Dashboard `useEffect` finds no token in `localStorage` | Clears storage, redirects to `/login` |

#### B.2 — Spoofed / Tampered Token

| Step | Actor | Action | Expected Result |
|---|---|---|---|
| 1 | Client | Sends `Authorization: Bearer fake.token.here` | `401 { error: "Not authorized, token failed" }` |
| 2 | UI | Dashboard API call fails with 401 | Clears `localStorage`, redirects to `/login` |

#### B.3 — Expired Token

| Step | Actor | Action | Expected Result |
|---|---|---|---|
| 1 | System | JWT issued at login with `expiresIn: '1h'` | — |
| 2 | Client | After 1 hour, calls protected endpoint with expired JWT | `401 { error: "Not authorized, token failed" }` |
| 3 | UI | Dashboard catches 401 | Clears storage, redirects to `/login` |
| 4 | Socket | Expired token in `handshake.auth.token` | Connection rejected: `Authentication error: invalid token` |

#### B.4 — Accessing Another User's Dashboard

| Step | Actor | Action | Expected Result |
|---|---|---|---|
| 1 | Client | User A's JWT used to request `GET /api/bank/dashboard/{userB_id}` | `403 { error: "Forbidden: Access denied to this account" }` |
| 2 | UI | Dashboard catches 403 | Clears storage, redirects to `/login` |

#### B.5 — Unverified Account Login

| Step | Actor | Action | Expected Result |
|---|---|---|---|
| 1 | Client | `POST /api/auth/login` for unverified user | `403 { error: "Please verify your account first" }` |
| 2 | UI | Landing page catches 403 | Stores email, navigates to `/verify` |

---

### Scenario C: Validation Failure — Insufficient Funds

**Precondition:** Sender balance = `$100.00` (or 100 NIS equivalent in configured currency).

| Step | Actor | Action | Expected Result |
|---|---|---|---|
| 1 | User | Opens transfer modal, enters valid receiver email | — |
| 2 | User | Enters amount `150` | — |
| 3 | User | Submits transfer | `POST /api/bank/transaction` |
| 4 | Backend | Checks `sender.balance (100) < amount (150)` | `400 { error: "Insufficient balance" }` |
| 5 | Backend | Does **not** modify balances, does **not** create transaction | `sender.save()` and `receiver.save()` not called |
| 6 | UI | `TransferModal` displays error in `alert-error` div | "Insufficient balance" |
| 7 | UI | Modal stays open; user can correct amount | — |
| 8 | Test | `tests/bank.test.js` asserts 400, no saves, no `Transaction.create` | Pass |

> **Note:** Frontend `TransferModal` uses `type="number"` with `min="0.01"` but does **not** currently pre-check balance before submit. Backend is the authoritative gate. **Future enhancement:** disable submit or show warning when `amount > balance`.

---

### Scenario D: Validation Failure — Invalid Input

#### D.1 — Negative Amount

| Input | `amount: -500` |
|---|---|
| Backend check | `Number(-500)` is finite but `<= 0` |
| Response | `400 { error: "Amount must be a positive number" }` |
| DB state | No balance change, no transaction created |

#### D.2 — Zero Amount

| Input | `amount: 0` |
|---|---|
| Response | `400 { error: "Amount must be a positive number" }` |

#### D.3 — Non-Numeric Amount (String)

| Input | `amount: "abc"` (sent via API) or empty string from UI |
|---|---|
| Backend check | `Number("abc")` → `NaN`, `!Number.isFinite(NaN)` |
| Response | `400 { error: "Amount must be a positive number" }` |
| UI | HTML5 `type="number"` prevents most invalid keyboard input; API must still validate |

#### D.4 — Non-Existent Receiver Email

| Input | `receiverEmail: "nobody@example.com"` |
|---|---|
| Backend check | `User.findOne({ email })` returns null |
| Response | `404 { error: "Receiver not found" }` |
| UI | Error displayed in transfer modal alert |

#### D.5 — Self-Transfer

| Input | `receiverEmail` equals sender's own email |
|---|---|
| Response | `400 { error: "Cannot transfer to your own account" }` |

#### D.6 — Missing Required Fields

| Input | Empty `receiverEmail` or missing `amount` |
|---|---|
| UI | HTML5 `required` attribute blocks form submit |
| API | Backend treats undefined amount as invalid → 400 |

#### D.7 — Duplicate Email on Signup

| Input | Email already registered |
|---|---|
| Response | `400 { error: "Email already exists" }` |
| UI | Error shown on registration form |

---

### Scenario E: Email Verification Edge Cases

#### E.1 — Expired Verification Link

| Condition | Token exists but `verificationCodeExpires < Date.now()` |
|---|---|
| Response | `400 { error: "Invalid or expired verification token" }` |
| UI | Shows "Verification failed" with resend button; notes 15-minute validity |

#### E.2 — Missing Token in URL

| Condition | User visits `/verify` without `?token=` |
|---|---|
| UI | Shows "Invalid link" with resend option (if email in `localStorage`) |

#### E.3 — Resend Verification

| Action | `POST /api/auth/resend-verification` with stored email |
|---|---|
| Success | New token issued, new email sent, generic 200 message |
| Already verified | `400 { error: "This account is already verified. Please log in." }` |

---

### Scenario F: Notification Lifecycle

| Step | Action | Expected |
|---|---|---|
| 1 | Transfer completed to User B | `Notification` document created for User B |
| 2 | User B online | Socket emits `transfer:received`; toast appears (max 4) |
| 3 | User B clicks toast ✕ | `PATCH /api/notifications/{id}/read` — marked read, toast dismissed |
| 4 | User B opens bell panel | Notification listed; unread highlighted yellow |
| 5 | User B clicks "Mark all as read" | `PATCH /api/notifications/read-all` |
| 6 | User B deletes notification | `DELETE /api/notifications/{id}` — removed from list |

---

### Scenario G: AI Assistant Transfer

| Step | Actor | Action | Expected |
|---|---|---|---|
| 1 | User | Opens BankingBot, asks "Send $50 to friend@example.com" | — |
| 2 | Assistant | Confirms recipient and amount (unless clearly stated) | — |
| 3 | Assistant | Calls `transfer_money` tool | Same logic as `POST /api/bank/transaction` |
| 4 | System | Returns `refreshDashboard: true` | Dashboard refreshes balance |
| 5 | Error case | Insufficient funds via bot | Assistant explains error; no fabricated success |

---

## Appendix A — Environment Variables

| Variable | Required | Used By | Description |
|---|---|---|---|
| `MONGO_URI` | Yes | `server.js` | MongoDB connection string |
| `JWT_SECRET` | Yes | Auth middleware, JWT sign/verify, Socket.io | Secret key for token signing |
| `PORT` | No (default 5000) | `server.js`, Docker | HTTP listen port |
| `FRONTEND_URL` | Yes (production) | `routes/auth.js` | Base URL for verification email links |
| `BREVO_API_KEY` | Yes (signup) | `routes/auth.js` | Brevo transactional email API key |
| `EMAIL_USER` | Yes (signup) | `routes/auth.js` | Verified sender email in Brevo |
| `GOOGLE_API_KEY` | Yes (bot) | `aiAssistantService.js` | Google Gemini API key for AI assistant |

**Security rules:**
- Never commit `.env` to version control.
- `.dockerignore` excludes `.env` files.
- Docker Compose loads `.env` via `env_file`.

---

## Appendix B — Testing Requirements

### Backend (Jest + Supertest)

**Run:** `npm test`

| Test | Scenario Reference | Assertion |
|---|---|---|
| Health check | — | `GET /` → 200 |
| Login success | A.2 | 200, user object, valid JWT |
| Login wrong password | B.2 | 401, "Invalid credentials" |
| Login user not found | B.2 | 401, "Invalid credentials" |
| Transfer success | A.3 | 200, balances updated, transaction created |
| Transfer insufficient funds | C | 400, no DB writes |

**Mocking pattern:**
```javascript
jest.mock('../models/User');
jest.mock('../models/Transaction');
jest.mock('../models/Notification');
```

### Frontend (Cypress)

**Prerequisites:** Frontend dev server running on `localhost:3000`.

**Run:** `cd frontend && npm run cypress:run`

| Test (current) | Assertion |
|---|---|
| Landing page | Hero title visible, Login button visible |
| Login page | Welcome back heading, email/password inputs visible |

**Planned tests:**

| Test | Scenario Reference |
|---|---|
| Full login → dashboard | A.2 |
| Transfer happy path | A.3 |
| Transfer insufficient funds shows error | C |
| Unauthenticated dashboard redirect | B.1 |

---

## Appendix C — Implementation Status Matrix

| Feature | Status | Spec Section |
|---|---|---|
| User registration (signup) | ✅ Implemented | §3.2 |
| Email verification (magic link) | ✅ Implemented | §3.2, Scenario E |
| JWT login (1h expiry) | ✅ Implemented | §3.2 |
| Protected dashboard | ✅ Implemented | §3.3 |
| Money transfer | ✅ Implemented | §3.3, Scenario A/C/D |
| Transaction history | ✅ Implemented | §3.3 |
| Socket.io notifications | ✅ Implemented | §4.1, Scenario F |
| Notification CRUD | ✅ Implemented | §3.4 |
| AI banking bot | ✅ Implemented | §3.5, Scenario G |
| Docker backend | ✅ Implemented | §1.4 |
| Jest backend tests | ✅ Implemented | Appendix B |
| Cypress E2E (basic) | ✅ Implemented | Appendix B |
| Cypress E2E (full flows) | 🔲 Planned | Scenario A |
| MongoDB atomic transactions | 🔲 Planned | §3.3 note |
| Frontend Docker service | 🔲 Planned | §1.4 |
| Balance socket event for sender | 🔲 Planned | §4.1 |
| Video consultation (Jitsi) | 🔲 Planned | §4.3 |
| Backend password length validation | 🔲 Planned | §3.2 |
| `POST /api/auth/register` alias | 🔲 Planned | §3.2 note |

---

## Document Usage Guide

When requesting implementation from an AI agent or developer, reference this document precisely:

> **Example:** "Implement Scenario C with frontend pre-validation per §3.3 transfer rules and add a Jest test matching `tests/bank.test.js` patterns."

> **Example:** "Build the Video Consultation feature per §4.3 Planned Specification."

Changes to behavior **must** update this document first, then update code and tests to match.
