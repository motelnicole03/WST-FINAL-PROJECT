# Server (Express + PostgreSQL + TypeScript)

## 1. Install
```bash
cd server
npm init -y          # skip if package.json already exists (this one is included)
npm i express pg zod bcryptjs jsonwebtoken cors helmet dotenv
npm i -D typescript tsx @types/node @types/express @types/pg @types/jsonwebtoken @types/cors
```

## 2. Configure
```bash
cp .env.example .env      # then edit DATABASE_URL and JWT_SECRET
```
Create the database first: `createdb student_job_portal` (or use pgAdmin).

## 3. Create tables and starter data
```bash
npm run migrate    # runs src/db/migrations/*.sql
npm run seed       # programs, skills, and the admin account from .env
```

## 4. Run
```bash
npm run dev        # http://localhost:4000/api/health
```

## 5. Try it
```bash
# register a student (use a program id from the seed, usually 1)
curl -X POST localhost:4000/api/auth/register -H "Content-Type: application/json" -d '{
  "role":"student","email":"ana@school.edu","password":"password123",
  "firstName":"Ana","lastName":"Cruz","studentNumber":"2024-0001","programId":1,"yearLevel":3 }'

# log in, then call /me with the token
curl -X POST localhost:4000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"ana@school.edu","password":"password123"}'
curl localhost:4000/api/auth/me -H "Authorization: Bearer <token>"
```

## How to add the next module
Copy `src/modules/auth/` to `src/modules/<name>/`, rename the five files, then mount the
router in `src/app.ts`. Protect routes with `authenticate` and `authorize('employer')`.
