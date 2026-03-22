# WLD2Mpesa Architecture Documentation

Welcome to the technical documentation for **WLD2Mpesa**, a high-performance bridge for converting Worldcoin (WLD) to M-Pesa (KES) with World ID authentication.

## Table of Contents
1. [Authentication Flow](./authentication.md) - Deep dive into World ID 4.0, SIWE, and security logic.
2. [Live Rates](./rates.md) - How we fetch and process real-time WLD/KES exchange rates.
3. [Component Overview](#component-overview)
4. [Project Structure](#project-structure)

---

## Component Overview

The application follows a modern decoupled architecture:

- **Frontend (Vite/React)**: High-performance SPA with MiniKit integration.
- **Backend (Node.js/Express)**: Secure API handling authentication, rate logic, and M-Pesa orchestration.
- **Worker (Optional)**: Background processes for transaction monitoring.

## Project Structure

```bash
.
├── backend          # Node.js/Express API
│   ├── src/routes   # API endpoints
│   ├── src/services # Business logic (Rates, User, M-Pesa)
│   └── prisma       # Database schema (PostgreSQL)
├── frontend         # Vite/React Application
│   ├── src/pages    # View components (Verification, Home, etc.)
│   ├── src/lib      # API clients and MiniKit wrappers
│   └── src/hooks    # Custom React hooks
└── docs             # This documentation
```

To learn more about how each page works, explore the `frontend/src/pages` directory. All core logic is triggered from the `VerificationPage.tsx` and `HomePage.tsx` components.
