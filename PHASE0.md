# Klyro app — Phase 0 Foundation (First Architecture)

Brand: **Klyro**. Spec baseline: `../First Architecture` (`00`-`17`).
Roadmap: `../First Architecture/17-roadmap.md` — build in phase order, gate on real users.

## What Phase 0 ships
- Auth (`03`): email+password signup (argon2id, 10+ chars, HIBP breach check),
  24h single-use verify token, DB-backed revocable sessions (sliding 30d / absolute 90d),
  GitHub-identical usernames + reserved list + history table.
- Base profile (`04` partial): displayName, avatar, bio 160, about md, location,
  website, skills+level. Public page `/u/:username`, API `GET /api/v1/users/:username`.
- Schema (`02`, Phase 0 subset): User, OAuthAccount, Session, Skill, SkillOnUser,
  Project, Role, TeamMember, UsernameHistory. `prisma/schema.prisma` is source of truth.
- Full-stack skeleton (`01`): Next Route Handlers + Express worker (BullMQ/Redis),
  Mongo secondary connector, Cloudinary/S3 + Pusher env slots, `docker-compose.yml`
  (Postgres/Mongo/Redis/Mailhog).

## Run
1. Copy env: `cp .env.example .env` (set `EMAIL_VERIFY_SECRET` 32+ chars, `DATABASE_URL`).
2. Start deps: `docker compose up -d` (or point env at hosted PG/Redis).
3. `npm run db:push` (Phase 0; `db:migrate` once Postgres is reachable and reviewed).
4. `npm run dev` + `npm run worker` (second terminal).
5. Signup at `/signup` → verify link prints to web console / Mailhog `:8025` → `/onboarding`.

## API (v1, cursor-ready, envelope errors per 14)
- `POST /api/v1/auth/signup`, `GET /api/v1/auth/verify?token=`, `POST|DELETE /api/v1/auth/login`
- `GET|PATCH /api/v1/users/me`, `GET /api/v1/users/:username`

## Next (Phase 1 MVP)
Projects create/roles/public page (`05`), applications accept/reject, OWNER/CONTRIBUTOR
membership, discussions-only (`08`). Do not build tasks/files/records until Phase 1 validates.
