# College Employee Credential Management System

> **Standalone Windows Desktop Application (`.exe`)** built with **React**, **TypeScript**, **Electron**, **Local Node.js + Express REST API**, **MongoDB Atlas**, and **Redis**.

---

## Architecture Highlights

```text
┌─────────────────────────────┐
│ CredentialManager.exe       │
│                             │
│ Electron                    │
│    │                        │
│    ├── React Renderer       │
│    │                        │
│    ├── Preload / IPC        │
│    │                        │
│    └── Local Express API    │
│              │              │
└──────────────┼──────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
MongoDB Atlas         Redis
(Cloud DB)        (Local 6379)
```

* **Zero-Backend-Hosting**: The Express REST API runs locally on the user's Windows machine (`127.0.0.1:5000`) and is managed directly by Electron.

* **Database**: MongoDB Atlas (Cloud) is the single primary persistent database.
* **Temporary Storage & Cache**: Redis running in Docker for high-speed rate limiting, OTP, and session tokens.
* **Security Isolation**: React renderer has zero direct access to MongoDB, Redis, encryption keys, or SMTP.
* **Package Manager**: **pnpm** monorepo with workspace packages.

---

## Monorepo Structure

```text
credential-manager/
├── apps/
│   ├── desktop/          # Electron Main Process & Preload Bridge (window.desktop)
│   ├── web/              # React + Vite + TypeScript Desktop UI
│   └── api/              # Node.js + Express + TypeScript Local API
├── packages/
│   ├── types/            # Shared TypeScript Types & IPC Interfaces
│   ├── shared/           # Common utilities, logger, & formatters
│   └── config/           # Shared constants and default configurations
├── docker/
│   └── redis.conf        # Redis cache configuration
├── docs/                 # College Project Documentation & Diagrams
├── docker-compose.yml    # Local Redis container definition
├── pnpm-workspace.yaml   # Monorepo workspace configuration
├── package.json          # Root dev & build scripts
└── .env.example          # Environment variable specifications
```

---

## Quick Start (Development)

### 1. Prerequisites

* **Node.js**: v20+ or v22+
* **pnpm**: v9+ or v10+ (`npm install -g pnpm`)
* **Docker Desktop**: Running (for local Redis)

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start Supporting Services (Redis)

```bash
docker compose up -d
```

### 4. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 5. Launch Full Desktop Stack

```bash
# Launches Express API + Vite Web UI + Electron Desktop window in one command:
pnpm dev
```

---

## Available Root Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts API (`127.0.0.1:5000`), Web (`127.0.0.1:5173`), and launches Electron desktop window |
| `pnpm dev:headless` | Starts API and Web dev servers without opening Electron window |
| `pnpm dev:api` | Starts only the local Express API with auto-reload (`tsx watch`) |
| `pnpm dev:web` | Starts only the Vite React UI |
| `pnpm build` | Compiles all packages, web app, API server, and desktop bundle |
| `pnpm lint` | Runs TypeScript type checking across all workspace packages |
| `pnpm test` | Executes package and service test suites |

---

## Default Evaluation Credentials (Bootstrap)

Upon initial startup with an empty database, the system automatically bootstraps evaluation accounts:

| Role | Email | Default Password | Employee ID | Department |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | `admin@example.com` | `Admin@12345` | `ADM001` | Information Technology / Security |
| **Employee** | `employee@example.com` | `Employee@12345` | `EMP001` | Academic Computing & Faculty Services |

> [!NOTE]
> The login screen contains one-click **"Fill Admin"** and **"Fill Employee"** quick-fill buttons for instant review and testing.

---

## Documentation Index

* [Architecture & Security Boundary](file:///docs/architecture.md)
* [Local REST API Documentation](file:///docs/api-documentation.md)
* [Database Design & Schema](file:///docs/database-design.md)
* [Credential Encryption (AES-256-GCM)](file:///docs/credential-security.md)
* [Redis Usage & Cache Design](file:///docs/redis-usage.md)
* [2-Month License Verification](file:///docs/license-system.md)
* [Docker Setup](file:///docs/docker-setup.md)
* [Windows EXE Packaging](file:///docs/exe-build.md)

---

## Academic Project Information
* **Project Name**: College Employee Credential Management System
* **Target OS**: Windows 10 / 11 Desktop (x64)
* **Organization**: Top Tech Developers
* **Completed Phases**: Phase 1 (Setup), Phase 2 (Electron Integration), Phase 3 (REST API), Phase 4 (MongoDB Atlas + Redis), Phase 5 (Authentication & RBAC), Phase 6 (Credential Management + AES-256-GCM Encryption), Phase 7 (Password Health Analysis), Phase 8 (Secure Credential Sharing), Phase 9 (Notifications + SMTP Email), Phase 10 (Security Audit Logging)


