# Round 1 - Technology Competition Platform

Module 1 foundation setup for the Round 1 technology competition web application.

## Tech Stack

- **Frontend**: React, Vite, JavaScript, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (Architecture prepared, integration in future module)

## Project Structure

```
round1-event/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express backend
├── .env.example     # Root environment variables reference
└── README.md
```

## Quick Start

### 1. Backend Setup
```bash
cd server
npm install
npm start
# Server runs on http://localhost:5000 by default
```

### 2. Frontend Setup
```bash
cd client
npm install
npm run dev
# Frontend runs on http://localhost:5173 by default
```

## Health Verification Endpoint

- `GET /api/health` -> Returns `{ "success": true, "message": "Round 1 API is running" }`
