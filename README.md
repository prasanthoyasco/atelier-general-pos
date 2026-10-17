<div align="center">

# 🍽️ Atelier General POS

### Enterprise-Grade Point of Sale, Multi-Station Kitchen Management & Retail Operating System

[![React](https://img.shields.io/badge/React-19.1.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.1.0-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.27-0170FE?logo=antdesign&logoColor=white)](https://ant.design/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Open-green.svg)](#license)

<p align="center">
  A modern, decoupled, multi-branch management platform built specifically for high-volume restaurants, cafes, bars, and retail stores. Includes real-time POS cashier checkout, mobile/tablet waiter ordering, multi-station Kitchen Display Systems (KDS), thermal printer bridges, inventory logs, and staff HRMS.
</p>

[System Architecture](docs/ARCHITECTURE.md) • [Getting Started](#-getting-started) • [Environment Variables](#-environment-variables-guide) • [How to Use](#-how-to-use-the-application) • [Hardware Printing](LOCAL_PRINT_SERVICE_SETUP.md)

</div>

---

> [!IMPORTANT]
> **Complete Technical Architecture**: For a deep dive into database entity relationships, the real-time KOT routing engine, network offline resilience, and hardware topology, read our dedicated documentation:
> 👉 **[System Architecture & Technical Design Specification (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)**

---

## 📑 Table of Contents
- [System Overview](#-system-overview)
- [Key Features & Modules](#-key-features--modules)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Environment Variables Guide](#-environment-variables-guide)
  - [Backend Environment Variables (`backend/.env`)](#1-backend-environment-variables-backendenv)
  - [Frontend Environment Variables (`frontend/.env`)](#2-frontend-environment-variables-frontendenv)
- [Getting Started](#-getting-started)
  - [1. Backend Setup](#step-1-backend-setup)
  - [2. Frontend Setup](#step-2-frontend-setup)
  - [3. Local Print Bridge Setup (Optional)](#step-3-local-print-bridge-setup-optional)
- [How to Use the Application](#-how-to-use-the-application)
- [Health Check Endpoints](#-health-check-endpoints)
- [License & Support](#-license--support)

---

## 🌟 System Overview

Atelier General POS is designed to eliminate order chaos, streamline kitchen communication, and provide store owners with real-time operational oversight across multiple branch locations.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT TERMINALS                                         │
│  💻 Cashier POS Terminal   📱 Waiter Mobile / Tablet   🍳 Kitchen Display Screen (KDS)   │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │ HTTPS REST API
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CORE BACKEND API LAYER (Node / Express)                       │
│  Multi-Tenant RBAC • KOT Routing Engine • Table Manager • Stock Audits • Rate Limiting  │
└─────────────────────┬─────────────────────┬─────────────────────┬───────────────────────┘
                      │                     │                     │
                      ▼                     ▼                     ▼
          ┌───────────────────────┐ ┌───────────────┐ ┌───────────────────────┐
          │   MySQL Database      │ │ Cloud Storage │ │ Hardware Print Bridge │
          │    Sequelize ORM      │ │   DO Spaces   │ │ ESC/POS 80mm/58mm LAN │
          └───────────────────────┘ └───────────────┘ └───────────────────────┘
```

---

## 🚀 Key Features & Modules

### 1. 💳 Cashier POS & Billing
- **Fast Barcode & Grid Checkout**: Instant item search, barcode scanning, category filters, and quick-add add-on modifiers.
- **Multi-Payment Split**: Supports Cash, Card, and UPI / QR codes via Razorpay integration.
- **Offline Outage Sentinel**: Automatically senses network drops without clearing unsaved carts or locking cashiers out of the terminal.

### 2. 🍽️ Table & Waiter Service
- **Single-Order-Per-Table Lock**: Guarantees that only one active order can be taken per dining table until the bill is settled.
- **Available Table Finder**: Intelligently recommends the next vacant table for waiting guests.
- **Mobile-Responsive UI**: Optimized for waiter tablets and smartphones.

### 3. 🍳 Kitchen Management & Multi-Station Routing
- **Station Routing Engine**: Automatically segregates orders into station-specific KOTs (e.g. Main Kitchen, Bar Counter, Bakery & Pizza, Grill & Tandoor) based on product tags.
- **Live Kitchen Display System (KDS)**: Real-time order pipeline with Pending, Preparing, and Ready status tracking.
- **SLA & Overdue Alerts**: Highlights orders exceeding target preparation times.
- **Direct Thermal KOT Printing**: Dispatches KOT print commands directly to network thermal printers per station.

### 4. 📦 Product Catalog & Modifiers
- Category and subcategory nesting with image uploads to DigitalOcean Spaces.
- Add-on management (extra cheese, beverage options, portion sizes).
- Bulk CSV product imports and real-time search.

### 5. 📊 Inventory & Daily Stock Audits
- Automatic stock deduction upon bill generation.
- Inward stock logging for supplier shipments.
- Daily stock log for auditing opening stock, additions, consumption, and physical closing count.

### 6. 👥 Multi-Branch & Role-Based Access Control (RBAC)
- Multi-tenancy with quick branch switcher.
- Granular permissions (`product.manage`, `billing.create`, `stock.inward`, etc.).
- Preconfigured roles: Super Admin, Branch Manager, Cashier, Waiter / Order Taker, and Kitchen Chef.

### 7. 💼 HRMS & Staff Attendance
- Selfie-proof attendance clock-in with geo-validation.
- Leave requests, advance salary tracking, and automated payslip generation.

### 8. 🎫 Developer & Hardware Ticketing Portal
- Internal ticketing system for reporting hardware malfunctions, printer errors, or software bugs.
- Automated email alerts via Brevo SMTP.

### 9. 🖨️ Silent Background Thermal Printing
- Local hardware bridge (`local-print-service`) allowing browsers to print directly to USB and LAN receipt printers without dialog popups.

---

## 📁 Repository Structure

```
general-pos/
├── backend/                       # Node.js & Express REST API server
│   ├── src/
│   │   ├── billing/              # POS billing, orders, tables & KOT engine
│   │   ├── product/              # Products, categories, add-ons & kitchen stations
│   │   ├── stock/                # Inventory stock balances & daily audits
│   │   ├── inward/               # Purchase orders & inward stock batches
│   │   ├── user/                 # Users, branches, roles & permissions (RBAC)
│   │   ├── employee/             # HRMS staff, attendance & payslips
│   │   ├── ticket/               # Developer support ticketing system
│   │   ├── marketing/            # Meta Ads, WhatsApp Cloud API & Coupons
│   │   ├── middleware/           # JWT, Helmet, RateLimiter & XSS sanitizers
│   │   ├── db/                   # Sequelize ORM connection & initialization
│   │   └── index.js              # Application entrypoint
│   ├── .env.example              # Backend environment variable template
│   └── package.json
│
├── frontend/                      # React 19 + Vite Single Page Application
│   ├── src/
│   │   ├── billing/              # POS Terminal, Waiter View & KDS Kitchen Screen
│   │   ├── product/              # Product List, Category Add & Kitchen Management
│   │   ├── stock/                # Stock Master & Daily Inventory Log
│   │   ├── inward/               # Inward entries & receipt logging
│   │   ├── user/                 # User management, Branch and Role administration
│   │   ├── employee/             # HRMS dashboard, Attendance & Leave portal
│   │   ├── ticket/               # Raise ticket & Developer dashboard
│   │   ├── context/              # Auth, Branch, Theme & NetworkStatus contexts
│   │   ├── components/           # Sidebar, Header, Modifiers & Common UI
│   │   ├── api/                  # Axios HTTP client with auto-refresh interceptors
│   │   ├── App.jsx               # Dynamic module route loader
│   │   └── main.jsx
│   ├── .env.example              # Frontend environment variable template
│   └── package.json
│
├── local-print-service/           # Lightweight local ESC/POS thermal printing daemon
│   ├── server.js                 # HTTP bridge listening on 127.0.0.1:9123
│   └── LOCAL_PRINT_SERVICE_SETUP.md
│
├── docs/                          # In-depth architectural & developer documentation
│   └── ARCHITECTURE.md           # Full system design, data flows & ER diagrams
│
└── README.md                      # Main project documentation
```

---

## 💻 Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: `v18.18.0` or `v20.x` LTS recommended
- **npm**: `v9.x` or higher
- **Database**: MySQL `8.0+` or MariaDB `10.5+`
- **Git**: Latest version

---

## 🔐 Environment Variables Guide

### 1. Backend Environment Variables (`backend/.env`)

Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `PORT` | Yes | HTTP port for the Express backend server | `10000` |
| `NODE_ENV` | Yes | Runtime mode (`development` or `production`) | `development` |
| `DATABASE_URL` | Yes | MySQL connection URI for Sequelize ORM | `mysql://root:pass@127.0.0.1:3306/general_pos` |
| `JWT_SECRET` | Yes | Secret key used to sign access tokens | `your_64_char_random_hex_string` |
| `JWT_REFRESH_SECRET` | Yes | Secret key used to sign long-lived refresh tokens | `your_refresh_token_secret` |
| `FRONTEND_URL` | Yes | Origin URL of the frontend web application | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS allowed domains | `https://pos.yourdomain.com` |
| `OAUTH_ENCRYPTION_KEY` | Yes | **Exactly 32-character** key for AES-256-GCM token encryption | `12345678901234567890123456789012` |
| `DO_SPACES_ENDPOINT` | No | DigitalOcean Spaces S3 endpoint for images | `https://blr1.digitaloceanspaces.com` |
| `DO_SPACES_REGION` | No | Region identifier for DigitalOcean Spaces | `blr1` |
| `DO_SPACES_KEY` | No | S3 Access Key ID for media storage | `your_spaces_access_key` |
| `DO_SPACES_SECRET` | No | S3 Secret Access Key | `your_spaces_secret_key` |
| `DO_SPACES_BUCKET` | No | Name of the Spaces bucket | `general-pos-assets` |
| `DO_SPACES_CDN` | No | Public CDN base URL for serving uploaded images | `https://assets.yourdomain.com` |
| `SMTP_HOST` | No | SMTP relay server hostname (Brevo, Sendgrid, etc.) | `smtp-relay.brevo.com` |
| `SMTP_PORT` | No | SMTP port | `587` |
| `SMTP_USER` | No | SMTP username | `your_smtp_user` |
| `SMTP_PASS` | No | SMTP password or API token | `your_smtp_password` |
| `EMAIL_FROM` | No | Sender address for transactional emails | `no-reply@yourdomain.com` |
| `TICKET_NOTIFY_EMAIL` | No | Developer address for support ticket notifications | `support@yourdomain.com` |
| `META_APP_ID` | No | Meta Developer App ID for WhatsApp Cloud API | `your_meta_app_id` |
| `META_APP_SECRET` | No | Meta Developer App Secret | `your_meta_app_secret` |
| `META_WHATSAPP_PHONE_NUMBER_ID` | No | WhatsApp Business Phone Number ID | `your_phone_id` |
| `META_WHATSAPP_ACCESS_TOKEN` | No | System user token with WhatsApp messaging permissions | `your_permanent_token` |

---

### 2. Frontend Environment Variables (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`:
```bash
cp frontend/.env.example frontend/.env
```

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `VITE_API_URL` | Yes | Base URL pointing to backend API v1 | `http://localhost:10000/api/v1` |
| `VITE_BACKEND_URL` | No | Root backend URL for serving static selfie uploads | `http://localhost:10000` |
| `VITE_LOCAL_PRINT_URL` | Yes | Endpoint of the local thermal print bridge daemon | `http://127.0.0.1:9123` |
| `PORT` | No | Port used when running `npm run dev` | `5173` |
| `VITE_INCLUDE_IMS` | No | Feature toggle for Inventory & Stock module | `true` |
| `VITE_INCLUDE_HRMS` | No | Feature toggle for HRMS & Attendance module | `true` |
| `VITE_INCLUDE_HMS` | No | Feature toggle for Hospitality & Room management | `true` |

---

## 🛠️ Getting Started

### Step 1: Backend Setup
```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Create your environment configuration
cp .env.example .env
# Edit .env and enter your MySQL database credentials

# 4. Initialize Database Schema & Seed Data (Optional)
node seed-permissions.js
node create-admin.js

# 5. Start the backend development server
npm run dev
# The backend will start on http://localhost:10000
```

### Step 2: Frontend Setup
```bash
# 1. Open a new terminal and navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Create your environment configuration
cp .env.example .env

# 4. Start the frontend development server
npm run dev
# Access the web application at http://localhost:5173
```

### Step 3: Local Print Bridge Setup (Optional)
If you are connecting physical 80mm or 58mm thermal receipt printers via USB or LAN:
```bash
# 1. Navigate to the local-print-service directory
cd local-print-service

# 2. Install dependencies
npm install

# 3. Start the print service daemon
npm start
# The print service will listen on http://127.0.0.1:9123
```
For complete Windows background startup service instructions, refer to [LOCAL_PRINT_SERVICE_SETUP.md](LOCAL_PRINT_SERVICE_SETUP.md).

---

## 📖 How to Use the Application

### 1. Initial Setup (Admin Onboarding)
1. Log in with your administrator credentials at `/login`.
2. Navigate to **User Management > Branches** to register your store locations.
3. Switch between branches using the branch selector dropdown in the navigation header.

### 2. Kitchen Station Configuration & KOT Routing
1. Go to **Product > Kitchen Stations** (`/product/kitchens`).
2. Click **Create Station** to add your physical kitchen preparation areas:
   - *Main Kitchen* (Curries, Rice, Gravies)
   - *Bar Counter* (Beverages, Cocktails, Juices)
   - *Pizzeria / Oven* (Breads, Pizzas)
   - *Tandoor & Grill* (Starters, Kebabs)
3. Set the target **SLA Prep Time** (e.g. 15 minutes) and specify the **Printer IP** for network thermal printing.
4. Click **Assign Items** on any station to open the bulk routing drawer and map entire categories or products.

### 3. Taking Orders via POS Terminal (Cashier Flow)
1. Go to **Casier Billing > POS Terminal** (`/billing/pos`).
2. Select or scan products to add them to the cart.
3. Select an active dining table or order mode (Takeaway / Delivery / Dine-in).
4. Click **Fire KOT** to route tickets to the appropriate kitchen stations automatically.
5. Settle the bill via Cash, Card, or UPI to print the customer receipt.

### 4. Waiter Tablet Service (Dine-in Flow)
1. Log in with a `Waiter` or `Order Taker` account.
2. Open **Waiter Service** (`/billing/waiter`).
3. Select an unoccupied dining table. (The system will block selection of already occupied tables).
4. Add customer items and special preparation notes.
5. Click **Submit to Kitchen** — tickets instantly appear on the respective station KDS screens.

### 5. Kitchen Display System (KDS Screen)
1. Open the kitchen display at `/billing/kitchen`.
2. Kitchen staff can filter tickets by their specific station.
3. Click **Start Preparing** when starting an order ticket.
4. Click **Mark Ready** when cooking is complete to alert the serving staff.

### 6. Daily Stock Audit
1. Navigate to **Stocks > Daily Stock Log** (`/stock/daily-inventory`).
2. Log physical closing quantities to reconcile recorded consumption against actual stock on hand.

---

## 🔍 Health Check Endpoints

| Endpoint | Method | Response | Description |
|---|---|---|---|
| `/health` | `GET` | `{"status": "ok", "timestamp": "..."}` | Root uptime health monitor |
| `/api/v1/health` | `GET` | `{"status": "ok", "timestamp": "..."}` | API Gateway health check used by the frontend Network Sentinel |
| `/api/data` | `GET` | `{"value": 42}` | Database & middleware connectivity validation |

---

## 📄 License & Support

- **Repository**: [prasanthoyasco/atelier-general-pos](https://github.com/prasanthoyasco/atelier-general-pos)
- **Technical Inquiries & Support**: Contact the Atelier Engineering Team or raise a ticket via the in-app **Developer Support Portal** (`/tickets`).
