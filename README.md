# Aegis Retail

> **Offline-first, cryptographically verifiable POS and inventory platform engineered for low-connectivity and micro-retail environments.**

---

## 📖 Overview

**Aegis Retail** is a resilient point-of-sale (POS), inventory management, and store management platform designed for emerging-market and low-connectivity retail (such as Philippine *sari-sari* stores, convenience outlets, and community marts).

In environments with intermittent 2G/cellular connectivity or complete network blackouts, conventional cloud-dependent retail systems fail. Aegis Retail eliminates network bottlenecks by guaranteeing **sub-50ms local transaction commits**, non-blocking offline operation, deterministic delta-synchronization, and tamper-evident cryptographic auditability.

```
+-----------------------------------------------------------------------------+
|                                AEGIS RETAIL                                 |
|                                                                             |
|   +-----------------------+     Delta Sync      +-----------------------+   |
|   |  Edge Cashier POS     | <=================> |  Cloud Backend API    |   |
|   |  - Sub-50ms Commit    |  (Idempotent Push/  |  - Conflict Engine    |   |
|   |  - Offline Credit     |   Cursor-Based Pull)|  - SHA-256 Audit Chain|   |
|   |  - Bulk Unit Breaking |                     |  - Multi-Tenant RLS   |   |
|   +-----------------------+                     +-----------------------+   |
|                                                             ^               |
|                                                             | REST / Auth   |
|                                                             v               |
|                                                 +-----------------------+   |
|                                                 |   Manager Dashboard   |   |
|                                                 |   - Terminal Health   |   |
|                                                 |   - Anomaly Triage    |   |
|                                                 |   - Credit & Pricing  |   |
|                                                 +-----------------------+   |
+-----------------------------------------------------------------------------+
```

---

## ⚡ Key Features & Engineering Capabilities

### 1. Offline-First Cashier Engine (<50ms Write Latency)
- **Zero Blocking**: Complete cashier transactions, barcode scans, and receipt generation continue seamlessly without network connectivity.
- **Local Write-Ahead Store**: Mutations are staged locally with strict monotonic sequence tracking and offline queueing.

### 2. Delta Synchronization & Conflict Resolution
- **Cursor-Based Pull / Idempotent Push**: Bi-directional delta synchronization ensures atomic commits and replay protection across unreliable network links.
- **Concurrent Stock Reconciliation**: If an item is sold offline while a manager records damaged stock or restocks, Aegis prevents transaction failure via **soft stock clamping** and queues the discrepancy in the **Conflict & Anomaly Queue** for manager reconciliation.

### 3. Tamper-Evident Cryptographic Audit Trail
- **SHA-256 Hash Chaining**: Every business mutation (price updates, damage write-offs, credit limit changes, device authorization changes) is cryptographically chained starting from a deterministic Genesis block.
- **Mathematical Integrity**: Full ledger auditability with mathematical verification against unauthorized tampering.

### 4. Community Micro-Credit (*Bukas-Bayad* Ledger)
- **Local Credit Rules**: Track customer credit accounts, approved credit limits, and balances.
- **Offline Credit Enforcement**: Cashiers can securely approve credit purchases offline up to the customer's cached credit threshold.

### 5. Bulk-to-Unit Inventory Breaking
- **Atomic Unit Conversion**: Break wholesale packaging (e.g., 1 carton of 100 coffee packs) into individual retail units at the POS register without data drift or concurrency race conditions.

### 6. Hardware Terminal Security & Remote Revocation
- **Asymmetric Device Authentication**: Edge terminals authenticate using cryptographic device keypairs.
- **Remote Revocation**: Managers can instantly revoke compromised or lost POS terminals, cutting off cloud sync access immediately.

---

## 📂 Monorepo Architecture

The repository is structured as a TypeScript npm workspaces monorepo:

```
aegis-retail/
├── packages/
│   ├── core/                  # Shared domain types, Zod schemas & cryptographic engine
│   │   ├── src/
│   │   │   ├── crypto/        # SHA-256 hash chaining, device signing & verification
│   │   │   ├── schemas/       # Zod validation schemas for all entities
│   │   │   ├── sync/          # Delta sync message contracts & idempotency helpers
│   │   │   └── types/         # Core TypeScript domain models
│   │
│   ├── server/                # Fastify cloud backend & synchronization service
│   │   ├── src/
│   │   │   ├── auth/          # JWT tokens & device asymmetric key verification
│   │   │   ├── db/            # Storage repository & tenant-isolated data layer
│   │   │   ├── routes/        # Auth, sync, pricing, credit & dashboard REST routes
│   │   │   ├── sync/          # Conflict resolution & inventory discrepancy engine
│   │   │   └── worker/        # Background audit chain & sync health processors
│   │
│   ├── client-pos/            # Local-first Cashier POS runtime & sync client
│   │   ├── src/
│   │   │   ├── db/            # Embedded local store & transaction log
│   │   │   ├── pos/           # Cash/Credit checkout, bulk breaking & catalog search
│   │   │   └── sync/          # Exponential backoff delta sync client
│   │
│   └── manager-dashboard/     # React 18 + Vite store management SPA
│       └── src/
│           ├── api/           # Typed API client bridge
│           ├── design-system/ # Aegis warm earthy design tokens (CSS)
│           └── App.tsx        # Manager dashboard & interactive POS network simulator
│
├── package.json               # Root workspace manifest & orchestrator scripts
├── tsconfig.base.json         # Shared TypeScript compiler configuration
└── README.md                  # System documentation
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: `v20.x` or later
- **npm**: `v10.x` or later

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Hazy019/aegis-retail.git
cd aegis-retail
npm install
```

### 2. Build All Packages
```bash
npm run build
```

### 3. Launch Development Environment
To start both the **Fastify Cloud API** (port `3001`) and the **Manager Dashboard** (port `5173`) concurrently:
```bash
npm run dev:all
# or: npm start
```

Once running:
- **Manager Dashboard UI**: `http://localhost:5173`
- **Cloud Backend API**: `http://localhost:3001`

---

## 🔐 Default Demo Credentials

When the backend starts in development mode, it seeds a demo store, manager account, and authorized POS terminal:

| Role | Identifier / Email | Password |
| :--- | :--- | :--- |
| **Store Manager** | `manager@aegisretail.local` | `Password123!` |
| **Terminal Device ID** | `POS-TERM-01` | *Asymmetric Key Auth* |

---

## 🖥️ Manager Dashboard & POS Simulator

The web dashboard provides an integrated control panel and cashier simulator:

1. **Device Health & Sync**: Live view of terminal connectivity, sync timestamps, 48-hour offline escalation alerts, and one-click cryptographic revocation.
2. **Master Pricing & Stock**: Manage product catalogs, wholesale unit definitions, retail prices, and log damaged inventory write-offs.
3. **Conflict & Anomaly Queue**: Inspect, triage, and reconcile concurrent offline cashier sales vs. manager inventory adjustments.
4. **Customer Credit Ledger (*Bukas-Bayad*)**: Add customer credit accounts, approve credit limits, and monitor outstanding balances.
5. **Tamper-Evident Audit Trail**: Real-time inspection of SHA-256 hash chaining across all database events with Genesis block verification.
6. **Interactive POS Simulator**: Toggle between **Online (Broadband)**, **2G Cellular (High Latency)**, and **Airplane Mode (Offline)** to test cashier workflows, bulk-to-unit carton breaking, cash/credit checkouts, and offline delta queuing.

---

## 🧪 Testing & Verification

The test suite validates multi-tenant isolation, sub-50ms local write latency, offline credit limits, bulk unit conversion, conflict reconciliation, and SHA-256 cryptographic audit integrity:

```bash
# Run all workspace test suites
npm test
```

### Individual Package Tests
```bash
# Test Core Types & Crypto
npm run test --workspace=@aegis/core

# Test Client POS Offline Engine
npm run test --workspace=@aegis/client-pos

# Test Server & Conflict Engine
npm run test --workspace=@aegis/server

# Type-check Manager Dashboard
npm run test --workspace=@aegis/manager-dashboard
```

---

## 🎨 Design System

Aegis Retail uses a curated, warm earthy design system tailored to retail environments rather than generic cyber/neon palettes:

| Token | Value | Semantic Usage |
| :--- | :--- | :--- |
| `--color-primary` | `#2E5F5A` | Deep Pine / Brand Primary |
| `--bg-app` | `#F7F5F2` | Warm Neutral Canvas |
| `--bg-surface` | `#FFFFFF` | Card & Modal Surface |
| `--color-accent-amber` | `#C97A2B` | Pending Sync / Outstanding Credit |
| `--color-accent-green` | `#4F7A57` | Verified Sync / Healthy Terminal |
| `--color-accent-red` | `#A6402E` | 48h Escalation / Revocation Alert |
| `--font-family` | `'IBM Plex Sans'` | High-legibility technical typography |

---

## 📜 License

MIT © 2026 Aegis Retail Platform Contributors
