# Document Vault — GraphQL API

Document Vault is a GraphQL API backend for organizing documents into collections. I built this application using **Bun**, **TypeScript**, **GraphQL Yoga**, **PostgreSQL**, and **Prisma**.

---

## Why I Built It This Way

- **Schema-First GraphQL**: I defined the API contract in `src/graphql/schema.graphql` first. This makes the schema the single source of truth for clients while TypeScript handles resolver implementation types.
- **Prisma with PostgreSQL**: I used Prisma because it generates type-safe database queries and manages version-controlled SQL migrations cleanly (`prisma/migrations`).
- **Cursor Pagination over Offset**: Offset pagination (`LIMIT/OFFSET`) degrades as datasets grow and suffers from duplicate/skipped items when records are inserted mid-page. Cursor pagination (`createdAt ASC, id ASC`) guarantees deterministic page traversal.
- **In-Database Substring Search**: I implemented case-insensitive substring search using PostgreSQL `ILIKE` via Prisma's `contains`. For the project scope, this keeps infrastructure simple without requiring external search engines.
- **Application Validation + DB Constraints**: I added domain input validation before database calls to catch bad formats early and throw clean `GraphQLError` messages, while PostgreSQL `@unique` constraints enforce database integrity.
- **Scope Intentions**: Authentication, RBAC, Redis caching, and DataLoader were intentionally excluded as requested by the assignment scope.

---

## Technical Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (`strict: true`)
- **GraphQL Engine**: [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/) (via Docker)
- **ORM**: [Prisma 6](https://www.prisma.io/)
- **Testing**: Bun native test runner (`bun:test`)
- **Containers**: Docker Compose

---

## Quick Start (One Command)

To run the API from a fresh checkout, run:

```bash
docker compose up -d && bun install && bun run gendb && bun run dev
```

### What this command does:
1. `docker compose up -d` — Starts the PostgreSQL 16 container on port 5432.
2. `bun install` — Installs project dependencies.
3. `bun run gendb` — Applies SQL migrations (`prisma migrate deploy`) and generates Prisma Client.
4. `bun run dev` — Starts the GraphQL Yoga server at `http://localhost:4000/graphql`.

---

## Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Default local `.env.example` contents:

```env
PORT=4000
NODE_ENV=development

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=document_vault
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/document_vault?schema=public"
```

---

## How Request Flow Works

```text
GraphQL POST Request
       │
       ▼
GraphQL Yoga Engine (schema parsing & type validation)
       │
       ▼
Domain Validation (src/graphql/validation.ts)
       │
       ▼
Resolver Implementation (src/graphql/resolvers.ts)
       │
       ▼
Prisma ORM Client
       │
       ▼
PostgreSQL Database
```

When a client creates a document, the resolver first validates that the title and content are non-empty and checks that the target collection exists. If valid, Prisma persists the record to PostgreSQL and returns the result.

---

## Database Model

The database contains two core tables with a 1-to-many relationship:

```text
Collection (1) ───────< Document (N)
```

- **`Collection`**: `id` (CUID), `name`, `slug` (unique), `createdAt`
- **`Document`**: `id` (CUID), `title`, `content`, `tags` (`String[]`), `collectionId` (FK), `isArchived` (Boolean), `createdAt`

*Note: Deleting a collection cascades and removes all associated documents automatically (`onDelete: Cascade`).*

---

## GraphQL API Overview

- **Endpoint**: `POST http://localhost:4000/graphql`
- **GraphiQL**: Visit `http://localhost:4000/graphql` in a web browser to test queries interactively.

### Available Queries

- **`collections`**: Returns all collections ordered by creation date ascending.
- **`collection(id: ID!)`**: Returns a collection by ID, or `null` if not found.
- **`documents(collectionId: ID, search: String, isArchived: Boolean, take: Int = 10, cursor: String)`**: Searches, filters, and paginates documents.

### Available Mutations

- **`createCollection(input: CreateCollectionInput!)`**: Creates a collection with name and slug validation.
- **`createDocument(input: CreateDocumentInput!)`**: Creates a document inside a collection.
- **`updateDocument(input: UpdateDocumentInput!)`**: Updates specified fields (partial update supported).
- **`deleteDocument(id: ID!)`**: Deletes a document by ID.
- **`moveDocument(id: ID!, collectionId: ID!)`**: Re-assigns a document to a new target collection.

---

## Example Queries and Mutations

### Create Collection
```graphql
mutation CreateCollection {
  createCollection(
    input: {
      name: "Engineering"
      slug: "engineering-team"
    }
  ) {
    id
    name
    slug
  }
}
```

### Create Document
```graphql
mutation CreateDocument {
  createDocument(
    input: {
      title: "GraphQL Integration Setup"
      content: "Document Vault runs with Bun and Prisma."
      tags: ["graphql", "backend"]
      collectionId: "COLLECTION_ID"
    }
  ) {
    id
    title
    content
    collectionId
  }
}
```

### Search & Filter Documents with Cursor Pagination
```graphql
query SearchDocuments {
  documents(
    search: "graphql"
    isArchived: false
    take: 10
  ) {
    nodes {
      id
      title
      content
      collection {
        id
        name
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Fetch Next Page
```graphql
query FetchNextPage {
  documents(
    take: 10
    cursor: "PASTE_END_CURSOR_HERE"
  ) {
    nodes {
      id
      title
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## Validation Rules & Expected Errors

- **Collection Slug**: Must match lowercase alphanumeric hyphenated pattern (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
  - *Valid*: `engineering`, `engineering-team`, `project-1`
  - *Invalid*: `Engineering`, `engineering_team`, `engineering team`, `-engineering`, `engineering-`
- **Non-Empty String Rules**: Collection names, document titles, and document contents cannot be blank or whitespace-only.
- **Page Size Limits**: `take` must be between 1 and 100.
- **Error Messages**:
  - `"Collection name cannot be empty."`
  - `"Invalid collection slug."`
  - `"A collection with this slug already exists."`
  - `"Collection not found."`
  - `"Title cannot be empty."`
  - `"Content cannot be empty."`
  - `"Document not found."`
  - `"Invalid cursor."`
  - `"take must be greater than zero."`
  - `"take cannot be greater than 100."`

---

## Testing & Developer Tooling

### Test Suite Structure
- **Unit Tests** (`tests/unit/resolvers.test.ts`): 25 unit tests mocking Prisma to test resolver logic, partial updates, pagination boundaries, and validation errors in isolation.
- **Integration Test** (`tests/integration/graphql.test.ts`): 1 full integration test that sends real HTTP POST requests to GraphQL Yoga and writes/reads data in the live PostgreSQL container.

### Running Tests

```bash
bun test             # Runs all 26 tests (unit + integration)
bun test:unit        # Unit tests only
bun test:integration # Integration test only
bun run typecheck    # TypeScript type check (0 errors)
bun run sanity       # Runs lint, typecheck, and full test suite in one step
```

---

## Project Structure

```text
Document Vault/
├── docker-compose.yml        # PostgreSQL 16 service configuration
├── package.json              # Project scripts and dependencies
├── tsconfig.json             # TypeScript compiler settings
├── .env.example              # Template for environment variables
├── README.md                 # Project documentation
├── prisma/
│   ├── schema.prisma         # Models, indexes, and database config
│   └── migrations/           # Version-controlled SQL migrations
├── src/
│   ├── server.ts             # Bun HTTP server & GraphQL Yoga instance
│   └── graphql/
│       ├── schema.graphql    # GraphQL SDL API contract
│       ├── resolvers.ts     # Resolvers & database interactions
│       ├── context.ts       # GraphQL Context & Prisma Client setup
│       └── validation.ts    # Input validation functions
└── tests/
    ├── unit/
    │   └── resolvers.test.ts # 25 resolver unit tests (mocked Prisma)
    └── integration/
        └── graphql.test.ts  # 1 end-to-end HTTP integration test (PostgreSQL)
```

---

## Future Improvements

If scaling this project for production, potential enhancements include:
1. **Authentication & Authorization**: JWT or session auth with role-based document access (RBAC).
2. **Full-Text Search**: Upgrading from substring matching to PostgreSQL trigram indexes (`pg_trgm`) or an external search service.
3. **DataLoader**: Batching database queries to avoid $N+1$ problems on nested field selections.
4. **File Storage**: Storing binary document files in S3/MinIO with pre-signed URLs.
5. **Document Version History**: Auditing changes and keeping track of previous document revisions.
