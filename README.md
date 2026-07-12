# Classroom API

Backend for the Classroom management app — an Express + Drizzle + Neon Postgres
REST API for managing departments, subjects, faculty, classes and enrollments,
with JWT authentication.

## Tech stack

- **Express 5** — HTTP server
- **Drizzle ORM** + **Neon** (serverless Postgres)
- **bcryptjs** for password hashing, **jsonwebtoken** for auth
- **TypeScript** (run with `tsx`)

## Getting started

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npm run db:push        # create tables in your Neon database
npm run db:seed        # optional: add sample data + demo accounts
npm run dev            # starts the API on http://localhost:8000
```

### Environment variables

See [.env.example](.env.example):

- `DATABASE_URL` — Neon Postgres connection string
- `FRONTEND_URL` — allowed CORS origin (default `http://localhost:5173`)
- `JWT_SECRET` — secret used to sign auth tokens
- `JWT_EXPIRES_IN` — token lifetime (default `7d`)

### Demo accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@classroom.test` | `password123` |
| Teacher | `teacher@classroom.test` | `password123` |
| Student | `student@classroom.test` | `password123` |

## Scripts

- `npm run dev` — start with hot reload
- `npm run build` / `npm start` — compile and run
- `npm run db:push` — sync the schema to the database
- `npm run db:generate` — generate a SQL migration from the schema
- `npm run db:seed` — populate sample data

## API overview

All list endpoints support `page` and `limit` query params and return
`{ data, pagination }`. Single-record endpoints return `{ data }`.

| Resource | Endpoints |
|----------|-----------|
| Auth | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` |
| Departments | `GET/POST /api/departments`, `GET/PUT/DELETE /api/departments/:id` |
| Subjects | `GET/POST /api/subjects`, `GET/PUT/DELETE /api/subjects/:id` |
| Users / Faculty | `GET /api/users`, `GET/POST/PUT/DELETE` (writes require auth) |
| Classes | `GET/POST /api/classes`, `GET/PUT/DELETE /api/classes/:id` |
| Enrollments | `GET /api/enrollments?classId=`, `POST`, `DELETE /api/enrollments/:id` |
| Stats | `GET /api/stats` (dashboard aggregates) |

Mutating routes for users, classes and enrollments require a
`Authorization: Bearer <token>` header.
