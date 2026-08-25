# Document Vault — GraphQL API

Document Vault is a GraphQL API for organizing documents into collections, built with **Bun**, **TypeScript**, **GraphQL Yoga**, **PostgreSQL**, and **Prisma**.

---

## Capabilities

- **Collections**: Create and retrieve document collections with unique, validated slugs.
- **Documents**: Create, update, delete, and move documents between collections.
- **Search**: Perform case-insensitive substring search across document titles and contents (`ILIKE`).
- **Filtering**: Filter documents by `collectionId` and `isArchived` status.
- **Cursor Pagination**: Deterministic, stable pagination ordered by `createdAt ASC, id ASC`.
- **Validation & Error Handling**: Strict domain boundary validation throwing clear `GraphQLError` messages.

---

## Technology Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **API Engine**: [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/)
- **ORM**: [Prisma 6](https://www.prisma.io/)
- **Testing**: Bun Test Runner (`bun:test`)
- **Infrastructure**: [Docker Compose](https://docs.docker.com/compose/)

---

## Prerequisites

Ensure you have the following installed locally:

- **Bun** (v1.0.0 or later)
- **Docker** & **Docker Compose**
- **Git**

*Note: PostgreSQL runs in a Docker container, so local PostgreSQL installation is not required.*

---

## One-Command Setup

Run the following command from the root of a fresh checkout to start PostgreSQL, install dependencies, run migrations, generate the Prisma Client, and launch the development server:

```bash
docker compose up -d && bun install && bun run gendb && bun run dev
```

### Setup Breakdown

1. `docker compose up -d` — Starts the PostgreSQL 16 container in background mode.
2. `bun install` — Installs project dependencies.
3. `bun run gendb` — Applies database migrations (`prisma migrate deploy`) and generates the Prisma Client (`prisma generate`).
4. `bun run dev` — Starts the GraphQL Yoga server with hot reloading at `http://localhost:4000/graphql`.

---

## Environment Variables

Copy `.env.example` to `.env` before running locally:

```bash
cp .env.example .env
```

Default configuration in `.env.example`:

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

*Never commit `.env` containing sensitive credentials to Git.*

---

## Database & Prisma Architecture

Database schema is defined in `prisma/schema.prisma` and managed via Prisma Migrations.

### Models

- **`Collection`**: Represents a logical grouping of documents.
  - `id`: `String` (ID, CUID/UUID)
  - `name`: `String`
  - `slug`: `String` (Unique)
  - `createdAt`: `DateTime`

- **`Document`**: Represents a document item.
  - `id`: `String` (ID, CUID/UUID)
  - `title`: `String`
  - `content`: `String`
  - `tags`: `String[]`
  - `collectionId`: `String` (Foreign key to `Collection`)
  - `isArchived`: `Boolean` (Default: `false`)
  - `createdAt`: `DateTime`

### Relationship

`Collection 1 ──< Document` (One-to-Many). Deleting a collection automatically cascades and removes its associated documents.

---

## GraphQL API Reference

- **Endpoint**: `POST http://localhost:4000/graphql`
- **GraphiQL IDE**: Accessible at `http://localhost:4000/graphql` in a browser during development.

### Queries

| Query | Arguments | Description |
|---|---|---|
| `collections` | None | Returns all collections ordered by `createdAt ASC`. |
| `collection` | `id: ID!` | Returns a single collection by ID, or `null` if not found. |
| `documents` | `collectionId: ID`, `search: String`, `isArchived: Boolean`, `take: Int = 10`, `cursor: String` | Searches, filters, and paginates documents. |

### Mutations

| Mutation | Input | Description |
|---|---|---|
| `createCollection` | `name: String!`, `slug: String!` | Creates a new collection. |
| `createDocument` | `title: String!`, `content: String!`, `tags: [String!]`, `collectionId: ID!`, `isArchived: Boolean` | Creates a document inside a collection. |
| `updateDocument` | `id: ID!`, `title: String`, `content: String`, `tags: [String!]`, `isArchived: Boolean` | Updates specified document fields (partial update). |
| `deleteDocument` | `id: ID!` | Deletes a document by ID. Returns `true`. |
| `moveDocument` | `id: ID!`, `collectionId: ID!` | Moves a document to a different target collection. |

---

## GraphQL Query & Mutation Examples

### 1. Fetch All Collections

```graphql
query GetCollections {
  collections {
    id
    name
    slug
    createdAt
  }
}
```

### 2. Create Collection

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
    createdAt
  }
}
```

### 3. Create Document

```graphql
mutation CreateDocument {
  createDocument(
    input: {
      title: "GraphQL Getting Started"
      content: "GraphQL Yoga provides a clean API server."
      tags: ["graphql", "backend"]
      collectionId: "COLLECTION_ID"
    }
  ) {
    id
    title
    content
    tags
    collectionId
    isArchived
    createdAt
    collection {
      id
      name
      slug
    }
  }
}
```

### 4. Search, Filter, and Paginate Documents

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
      tags
      collectionId
      isArchived
      createdAt
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

### 5. Fetch Next Page Using Cursor

```graphql
query FetchNextPage {
  documents(
    take: 10
    cursor: "LAST_END_CURSOR_ID"
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

### 6. Partial Document Update

```graphql
mutation UpdateDocumentTitle {
  updateDocument(
    input: {
      id: "DOCUMENT_ID"
      title: "Updated GraphQL Title"
    }
  ) {
    id
    title
    content
    isArchived
  }
}
```

### 7. Move Document to Another Collection

```graphql
mutation MoveDocument {
  moveDocument(
    id: "DOCUMENT_ID"
    collectionId: "TARGET_COLLECTION_ID"
  ) {
    id
    title
    collectionId
    collection {
      id
      name
    }
  }
}
```

### 8. Delete Document

```graphql
mutation DeleteDocument {
  deleteDocument(id: "DOCUMENT_ID")
}
```

---

## Validation & Error Handling

Input validation runs prior to database writes. Invalid requests yield standard `GraphQLError` messages:

- **Collection Slug Format**: Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`
  - *Accepted*: `engineering`, `engineering-team`, `project-1`
  - *Rejected*: `Engineering`, `engineering team`, `engineering_team`, `-engineering`, `engineering-`
  - *Error*: `"Invalid collection slug."`
- **Collection Name**: Must be non-empty after trimming (`"Collection name cannot be empty."`).
- **Duplicate Slug**: Duplicate database constraint returns `"A collection with this slug already exists."`.
- **Document Title / Content**: Must be non-empty after trimming (`"Title cannot be empty."`, `"Content cannot be empty."`).
- **Resource Existence**: Nonexistent collection or document returns `"Collection not found."` or `"Document not found."`.
- **Pagination Take Limits**: `take` must satisfy $0 < \text{take} \le 100$ (`"take must be greater than zero."`, `"take cannot be greater than 100."`).
- **Cursor Validation**: Invalid lookup cursor returns `"Invalid cursor."`.

---

## Testing & Quality Assurance

### Run Test Suite

```bash
bun test
```

The test suite includes **26 total tests**:
- **25 Unit Tests** (`tests/unit/resolvers.test.ts`): Tests resolver contracts, argument validation, partial updates, pagination bounds, and error translations with mocked Prisma context.
- **1 Integration Test** (`tests/integration/graphql.test.ts`): End-to-end HTTP GraphQL flow executing against the live Dockerized PostgreSQL database.

### Individual Test Commands

```bash
bun test:unit         # Run resolver unit tests only
bun test:integration  # Run PostgreSQL integration test only
bun run typecheck     # Verify TypeScript types (0 errors)
```

### Developer Sanity Script

Run all quality checks (linting, typechecking, and complete test suite) in one command:

```bash
bun run sanity
```

---

## Project Structure

```text
Document Vault/
├── docker-compose.yml        # PostgreSQL 16 container definition
├── package.json              # Bun dependencies and scripts
├── tsconfig.json             # TypeScript strict configuration
├── .env.example              # Example environment variables template
├── README.md                 # Project documentation
├── prisma/
│   ├── schema.prisma         # Prisma data models & PostgreSQL datasource
│   └── migrations/           # Version-controlled SQL migration history
├── src/
│   ├── server.ts             # Bun & GraphQL Yoga HTTP server entrypoint
│   └── graphql/
│       ├── schema.graphql    # GraphQL SDL type definitions & contracts
│       ├── resolvers.ts     # Resolver logic & database operations
│       ├── context.ts       # GraphQL context & Prisma Client instantiation
│       └── validation.ts    # Input validation & regex helpers
└── tests/
    ├── unit/
    │   └── resolvers.test.ts # Unit tests with mocked Prisma client
    └── integration/
        └── graphql.test.ts  # End-to-end GraphQL integration test (PostgreSQL)
```

---

## Design Decisions & Tradeoffs

1. **Schema-First GraphQL**: Defining `schema.graphql` establishes a clear API contract between client and backend before writing resolvers.
2. **Prisma ORM**: Selected for static type safety, autogenerated client types, and version-controlled migration management (`prisma migrate dev`).
3. **Cursor-Based Pagination**: Preferred over offset pagination (`SKIP/LIMIT`) to guarantee stable page traversal when records are created concurrently.
4. **PostgreSQL Substring Search**: Case-insensitive `ILIKE` via Prisma `contains` fulfills search requirements cleanly without adding unnecessary search engine dependencies.
5. **No Caching / DataLoader**: Excluded by design as specified in requirement boundaries.
6. **No Auth / RBAC**: Excluded by design as specified in requirement boundaries.
7. **Application Validation + DB Constraints**: Application-level checks catch invalid inputs early before hitting the database, while PostgreSQL unique constraints enforce relational integrity.

---

## Future Extensions

If extending this application for production use:
- **Authentication & RBAC**: JWT/Session authentication with role-based document access permissions.
- **Full-Text Search**: PostgreSQL trigram indexes (`pg_trgm`) or dedicated engines (Elasticsearch/Meilisearch).
- **DataLoader**: Batching and caching database queries to optimize nested GraphQL relationships.
- **S3 Attachment Storage**: Storing file attachments in S3/MinIO with presigned download URLs.
- **Document Versioning & History**: Storing audit logs and previous document revisions.
- **Observability**: Prometheus metrics, OpenTelemetry tracing, and rate limiting.

---

## Troubleshooting

- **PostgreSQL Connection Failed**: Ensure Docker is running and run `docker compose up -d`. Check container status with `docker compose ps`.
- **Prisma Client Missing**: Run `bun run gendb` to regenerate Prisma Client types.
- **Port Conflict (4000 in use)**: Change `PORT` in `.env` or set `PORT=4001 bun run dev`.
- **TypeScript Errors**: Run `bun run typecheck` to verify complete type safety.
