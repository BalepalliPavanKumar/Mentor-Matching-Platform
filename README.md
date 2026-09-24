# SkillSync — Peer Learning & Mentor Matching Platform

SkillSync is a full-stack, cloud-native mentorship platform that connects learners with mentors, manages 1-on-1 session booking, and supports peer learning communities. It's built as a **Spring Boot microservices backend** (11 independently deployable services behind an API gateway, with service discovery, centralized configuration, and event-driven notifications) paired with an **Angular 18 single-page frontend**, all containerized and orchestrated with Docker Compose.

> Built as a hands-on exercise in designing, implementing, and deploying a realistic microservices system end to end — service decomposition, inter-service communication, distributed configuration, async messaging, JWT-based auth/authorization, and containerized deployment.

---

## Table of Contents

- [Screenshots](#screenshots)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Microservices](#microservices)
- [Event-Driven Notifications (RabbitMQ)](#event-driven-notifications-rabbitmq)
- [Database Design](#database-design)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Sample / Seed Data](#sample--seed-data)
- [Testing](#testing)
- [Observability](#observability)
- [Known Limitations & Next Steps](#known-limitations--next-steps)
- [License](#license)

---

## Screenshots

| Login | Learner Dashboard |
|---|---|
| ![Login](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard.png) |

| Mentor Discovery | Session Booking |
|---|---|
| ![Mentors](docs/screenshots/mentors.png) | ![Sessions](docs/screenshots/sessions.png) |

| Learning Groups | Admin Console |
|---|---|
| ![Groups](docs/screenshots/groups.png) | ![Admin](docs/screenshots/admin.png) |

---

## Key Features

**Learners** can search and filter mentors by skill/rating/price/availability, book 1-on-1 sessions through a guided multi-step flow, join or create peer learning groups, and rate/review mentors after a completed session.

**Mentors** apply for mentor status, manage their availability, accept/reject/complete session requests, and build up a public rating from learner reviews.

**Admins** get a console with platform-wide KPIs, a mentor-approval queue, user management, skill catalog management, and moderation tools across sessions, groups, and reviews.

Under the hood, every session-state change (requested, accepted, rejected, cancelled, completed, reminder) and every mentor approval publishes an event over RabbitMQ that a dedicated notification service consumes — the REST request that creates the event returns immediately, decoupled from notification delivery.

---

## Architecture

```
                              ┌─────────────────────┐
                              │   Angular 18 SPA     │
                              │  (Nginx, port 4200)  │
                              └──────────┬───────────┘
                                         │ HTTPS/REST
                              ┌──────────▼───────────┐
                              │   API Gateway (8080)  │
                              │  Spring Cloud Gateway  │
                              │  JWT auth + role check │
                              └──────────┬───────────┘
                                         │ lb://SERVICE-NAME
                   ┌─────────────────────┼─────────────────────────┐
                   │                     │                         │
        ┌──────────▼─────────┐ ┌─────────▼──────────┐   ┌──────────▼─────────┐
        │  Eureka Discovery   │ │   Config Server     │   │   8 Business       │
        │  Server (8761)      │ │   (8888)             │   │   Microservices     │
        └──────────────────────┘ └──────────────────────┘   └──────────┬─────────┘
                                                                        │
                              ┌─────────────────────────────────────────┼───────────┐
                              │                                         │           │
                     ┌────────▼────────┐                     ┌─────────▼────────┐  │
                     │   PostgreSQL     │                     │    RabbitMQ       │  │
                     │ (1 DB / service) │                     │  session_queue    │  │
                     └──────────────────┘                     └─────────┬─────────┘  │
                                                                         │            │
                                                              ┌──────────▼─────────┐  │
                                                              │ Notification Service│◄─┘
                                                              │  (event consumer)   │
                                                              └──────────────────────┘

                                    Zipkin (9411) ◄── distributed traces from every service
```

Every business service registers itself with Eureka on startup and pulls its configuration (datasource, ports, feature flags) from the centralized Config Server at boot, rather than baking configuration into each service's own jar. The gateway is the single public entry point — it resolves `lb://SERVICE-NAME` routes dynamically via Eureka, validates JWTs on every route except `/auth/**`, and enforces per-endpoint role checks (e.g. only `ROLE_MENTOR` can `PUT /sessions/{id}/accept`) before a request ever reaches a downstream service.

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Language / Runtime | Java 21 |
| Framework | Spring Boot 3.2.6, Spring Cloud 2023.0.1 |
| API Gateway | Spring Cloud Gateway (reactive, WebFlux) |
| Service Discovery | Netflix Eureka |
| Centralized Config | Spring Cloud Config Server (native/git-backed) |
| Messaging | RabbitMQ (Spring AMQP) |
| Persistence | Spring Data JPA + PostgreSQL 15 (one database per service) |
| Auth | JWT (jjwt), Spring Security |
| API Docs | springdoc-openapi (Swagger UI per service) |
| Tracing | Micrometer Tracing + OpenTelemetry → Zipkin |
| Object Mapping | ModelMapper, Lombok |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Angular 18 (standalone components, no NgModules) |
| Language | TypeScript 5.5 |
| UI Library | Angular Material 18 + custom SCSS design system |
| State Management | NgRx Signals (`@ngrx/signals`) |
| HTTP | Angular HttpClient + functional JWT interceptor |
| Routing | Lazy-loaded feature routes, functional route guards |
| Build | Angular CLI / esbuild |
| Testing | Jasmine + Karma |

### Infrastructure
| Layer | Technology |
|---|---|
| Containerization | Docker (multi-stage builds per service) |
| Orchestration | Docker Compose (14 services, healthcheck-gated startup order) |
| Web Server (frontend) | Nginx (serving the built Angular SPA) |
| Database | PostgreSQL 15 (Alpine) |
| Message Broker | RabbitMQ 3 (management plugin enabled) |
| Tracing UI | Zipkin |

---

## Microservices

| Service | Port | Responsibility |
|---|---|---|
| **service-registry** | 8761 | Eureka discovery server — every other service registers here |
| **config-server** | 8888 | Serves centralized configuration from a git-backed repo (`config-server/config-repo`) |
| **api-gateway** | 8080 | Single entry point; routes requests, validates JWTs, enforces role-based access |
| **auth-service** | 8081 | Registration, login, JWT issuance/refresh |
| **user-service** | 8084 | Learner/mentor/admin profile management |
| **mentor-service** | 8082 | Mentor application, approval workflow, search/filter, availability |
| **skill-service** | 8085 | Platform-wide skill catalog |
| **session-service** | 8086 | Session booking lifecycle (request → accept/reject → complete), publishes events |
| **group-service** | 8087 | Peer learning groups — create, join/leave, discussion threads |
| **review-service** | 8088 | Mentor ratings and reviews, average-rating calculation |
| **notification-service** | 8089 | Pure event consumer — listens to RabbitMQ and simulates email/push notifications |

Each service owns its own PostgreSQL database (database-per-service pattern) and communicates with others only through the gateway (sync, REST) or RabbitMQ (async, events) — there is no direct service-to-service coupling.

---

## Event-Driven Notifications (RabbitMQ)

`session-service` and `mentor-service` publish JSON events to a single durable queue, **`session_queue`**, which `notification-service` consumes:

| Publisher | Event Type | Trigger |
|---|---|---|
| session-service | `SESSION_REQUESTED` | Learner books a session |
| session-service | `SESSION_ACCEPTED` | Mentor accepts a request |
| session-service | `SESSION_REJECTED` | Mentor rejects a request |
| session-service | `SESSION_CANCELLED` | Either party cancels |
| session-service | `SESSION_COMPLETED` | Mentor marks a session complete |
| session-service | `SESSION_REMINDER` | A reminder is triggered |
| mentor-service | `MENTOR_APPROVED` | Admin approves a mentor application |

`notification-service` has no REST API and no database of its own — it's a standalone `@RabbitListener` that parses each event and logs simulated email + push notification delivery. This keeps the request that *creates* the event (e.g. booking a session) fast and decoupled from notification delivery, which can be swapped for a real email/push provider without touching any other service.

---

## Database Design

PostgreSQL, one database per service (`ddl-auto=update`, schema created automatically on first boot):

| Database | Key Table(s) | Notable Fields |
|---|---|---|
| `skillsync_auth` | `auth_users` | email (unique), password, role |
| `skillsync_user` | `user_profiles` | userId, name, phone, skills, profileImageUrl |
| `skillsync_mentor` | `mentors` | userId, bio, skills, experience, rating, hourlyRate, availability, status |
| `skillsync_skill` | `skills` | name, category |
| `skillsync_session` | `sessions` | mentorId, learnerId, sessionDate, status |
| `skillsync_group` | `groups`, `group_members`, `group_messages` | name, description, createdBy / groupId, userId / content |
| `skillsync_review_db` | `review` | mentorId, userId, rating, comment |

---

## API Reference

All routes below are reached through the gateway at `http://localhost:8080`. Every route except `/auth/**` requires an `Authorization: Bearer <JWT>` header; several mutating routes additionally require a specific role (enforced at the gateway).

<details>
<summary><strong>Auth Service</strong> — <code>/auth</code> (public)</summary>

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user (learner/mentor/admin) |
| POST | `/auth/login` | Authenticate, returns JWT + user |
| POST | `/auth/refresh` | Refresh an existing JWT |

</details>

<details>
<summary><strong>User Service</strong> — <code>/users</code></summary>

| Method | Path | Description |
|---|---|---|
| POST | `/users` | Create a profile |
| GET | `/users` | List all profiles |
| GET | `/users/{id}` | Get a profile by id |
| PUT | `/users/{id}` | Update a profile |

</details>

<details>
<summary><strong>Mentor Service</strong> — <code>/mentors</code></summary>

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/mentors/apply` | Learner/Mentor | Apply to become a mentor |
| GET | `/mentors` | any | Search mentors (`skill`, `minRating`, `experience`, `maxPrice`, `availability`) |
| GET | `/mentors/{id}` | any | Get mentor by id |
| GET | `/mentors/pending` | Admin | List pending applications |
| PUT | `/mentors/{id}/approve` | Admin | Approve a mentor |
| PUT | `/mentors/{id}/reject` | Admin | Reject a mentor |
| PUT | `/mentors/{id}/availability` | Mentor | Update availability |

</details>

<details>
<summary><strong>Skill Service</strong> — <code>/skills</code></summary>

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/skills` | Admin | Add a skill to the catalog |
| GET | `/skills` | any | List all skills |
| GET | `/skills/{id}` | any | Get a skill by id |

</details>

<details>
<summary><strong>Session Service</strong> — <code>/sessions</code></summary>

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/sessions` | Learner | Book a session |
| PUT | `/sessions/{id}/accept` | Mentor | Accept a session |
| PUT | `/sessions/{id}/reject` | Mentor | Reject a session |
| PUT | `/sessions/{id}/cancel` | any | Cancel a session |
| PUT | `/sessions/{id}/complete` | Mentor | Mark complete |
| PUT | `/sessions/{id}/remind` | Admin | Trigger a reminder |
| GET | `/sessions/{id}` | any | Get a session by id |
| GET | `/sessions/user/{userId}` | any | List a learner's sessions |

</details>

<details>
<summary><strong>Group Service</strong> — <code>/groups</code></summary>

| Method | Path | Description |
|---|---|---|
| POST | `/groups` | Create a group |
| GET | `/groups` | List all groups |
| GET | `/groups/{id}` | Get a group by id |
| POST | `/groups/{id}/join?userId=` | Join a group |
| POST | `/groups/{id}/leave?userId=` | Leave a group |
| GET | `/groups/{id}/members` | List members |
| POST | `/groups/{id}/messages` | Post a discussion message |
| GET | `/groups/{id}/messages` | List discussion messages |

</details>

<details>
<summary><strong>Review Service</strong> — <code>/reviews</code></summary>

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/reviews` | Learner | Submit a review |
| GET | `/reviews/{id}` | any | Get a review by id |
| GET | `/reviews/mentor/{mentorId}` | any | List a mentor's reviews |
| GET | `/reviews/mentor/{mentorId}/average` | any | Average rating for a mentor |

</details>

Each service also exposes interactive **Swagger UI** at `http://localhost:<port>/swagger-ui.html` (e.g. `http://localhost:8081/swagger-ui.html` for auth-service).

---

## Project Structure

```
SkillSync-Platform/
├── api-gateway/            # Spring Cloud Gateway + JWT auth filter
├── auth-service/            # Registration, login, JWT issuance
├── config-server/           # Centralized config (config-repo/ is a git submodule)
├── group-service/           # Peer learning groups
├── mentor-service/          # Mentor applications, search, approval
├── notification-service/    # RabbitMQ event consumer
├── review-service/          # Mentor ratings & reviews
├── service-registry/        # Eureka discovery server
├── session-service/         # Session booking lifecycle
├── skill-service/           # Skill catalog
├── user-service/            # User profile management
├── frontend/                 # Angular 18 SPA
│   └── src/app/
│       ├── core/              # Guards, interceptors, services, signal store
│       ├── shared/            # Reusable utilities
│       ├── layout/shell/      # Authenticated app shell (sidebar/topbar)
│       └── features/          # Lazy-loaded feature areas
│           ├── auth/            # Login, register
│           ├── dashboard/       # Role-aware landing page
│           ├── mentors/         # Mentor discovery & booking
│           ├── sessions/        # Session booking & history
│           ├── groups/          # Learning groups
│           ├── reviews/         # Ratings & reviews
│           ├── profile/         # Profile + mentor application
│           └── admin/           # Admin console
├── docker/                   # Postgres init scripts
├── docker-compose.yml        # Full-stack orchestration
└── testing-data.json         # Sample request payloads for manual/API testing
```

---

## Getting Started

### Prerequisites
- Docker Desktop (with Docker Compose)
- Git

### Run the full stack

```bash
git clone --recurse-submodules https://github.com/BalepalliPavanKumar/SkillSync-Platform.git
cd SkillSync-Platform
docker compose up -d --build
```

> `config-server/config-repo` is a **git submodule**. If you cloned without `--recurse-submodules`, run `git submodule update --init` before starting the stack, or `config-server` will boot with no configuration to serve.

The first run builds all 11 backend services from source (Maven, inside Docker) plus the Angular frontend — this takes several minutes. Startup is healthcheck-gated: Postgres → database creation → Eureka → Config Server → API Gateway/business services → RabbitMQ-dependent services, so services won't come up half-configured.

Once everything is healthy:

| Service | URL |
|---|---|
| **Frontend** | http://localhost:4200 |
| API Gateway | http://localhost:8080 |
| Eureka Dashboard | http://localhost:8761 |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |
| Zipkin Tracing UI | http://localhost:9411 |

Check status any time with `docker compose ps`, and tail logs for a specific service with `docker compose logs -f <service-name>`.

### Running the frontend standalone (without Docker)

```bash
cd frontend
npm install
npm start   # ng serve, http://localhost:4300
```

Requires the backend stack to be running separately (`docker compose up -d`, excluding `frontend`), since the Angular app talks to the gateway at `localhost:8080`.

---

## Sample / Seed Data

`testing-data.json` at the repo root contains ready-to-use request payloads for every endpoint — sample registration/login credentials, a mentor application, session booking requests, a group creation payload, and more. It's a handy reference for exercising the API directly (via curl, Postman, or the Swagger UI) without going through the UI first.

---

## Testing

- **Backend**: JUnit + H2 (in-memory) unit tests for the service layer of auth, user, mentor, skill, session, group, and review services, plus Spring context-load smoke tests for every service. Run per-service with `./mvnw test` inside that service's directory.
- **Frontend**: Jasmine/Karma via `npm test` inside `frontend/`.

---

## Observability

Every service is wired with Micrometer Tracing + OpenTelemetry, exporting 100%-sampled traces to Zipkin (`http://localhost:9411`). This makes it possible to follow a single request as it crosses the gateway and one or more downstream services, which is otherwise hard to debug in a distributed system.

---

## Known Limitations & Next Steps

This project prioritizes demonstrating the microservices architecture, service communication patterns, and deployment pipeline end-to-end. A few things are intentionally simplified and would be the next things to harden for a production deployment:

- **Password storage**: passwords are currently compared as plain text rather than hashed (e.g. BCrypt) — straightforward to add in `auth-service`.
- **Notifications are simulated**: `notification-service` logs "would send email/push" rather than integrating a real provider (SendGrid, FCM, etc.) — the event-consumption plumbing is already in place, only the delivery integration is missing.
- **No persistent Postgres volume by default in some setups**: ensure the `postgres-data` volume is retained across `docker compose down` if you want data to survive a restart.
- **Frontend test coverage**: currently limited to the CLI-scaffolded root component test; guards, interceptors, the signal store, and feature components don't yet have dedicated specs.
- **Inter-service validation**: services trust foreign-key-style IDs (e.g. `mentorId`, `userId`) passed in request bodies without a synchronous existence check against the owning service — acceptable for this scope, but a candidate for a shared validation layer or Feign-based checks at scale.

---

## License

This project does not currently declare a license. If you'd like to reuse this code, please reach out.
