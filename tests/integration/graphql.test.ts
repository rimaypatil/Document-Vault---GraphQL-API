import { describe, expect, test, afterAll } from "bun:test";
import { server, yoga } from "../../src/server";
import { prisma } from "../../src/graphql/context";

describe("PostgreSQL & GraphQL Yoga Integration Test", () => {
  const uniqueSlug = `integration-test-${Date.now()}`;
  let createdCollectionId: string;
  let createdDocumentId: string;

  afterAll(async () => {
    // Clean up test data from PostgreSQL if created
    if (createdCollectionId) {
      try {
        await prisma.collection.delete({
          where: { id: createdCollectionId },
        });
      } catch (err) {
        // Ignored if DB was not reachable
      }
    }
    await prisma.$disconnect();
    server.stop();
  });

  test("full GraphQL flow: createCollection -> createDocument -> query documents -> cleanup", async () => {
    let timerId: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        prisma.$connect(),
        new Promise((_, reject) => {
          timerId = setTimeout(() => reject(new Error("DB timeout")), 2000);
        }),
      ]);
      clearTimeout(timerId!);
    } catch (err) {
      console.warn("PostgreSQL not reachable at localhost:5432. Ensure Docker PostgreSQL is running for integration tests.");
      return;
    }

    // 1. Create a collection via GraphQL mutation
    const createCollectionRes = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          mutation CreateCol($input: CreateCollectionInput!) {
            createCollection(input: $input) {
              id
              name
              slug
              createdAt
            }
          }
        `,
        variables: {
          input: {
            name: "Integration Test Collection",
            slug: uniqueSlug,
          },
        },
      }),
    });

    const createCollectionJson = await createCollectionRes.json();
    expect(createCollectionRes.status).toBe(200);
    expect(createCollectionJson.errors).toBeUndefined();
    expect(createCollectionJson.data?.createCollection).toBeDefined();

    createdCollectionId = createCollectionJson.data.createCollection.id;
    expect(createCollectionJson.data.createCollection.name).toBe("Integration Test Collection");
    expect(createCollectionJson.data.createCollection.slug).toBe(uniqueSlug);

    // 2. Create a document inside the created collection via GraphQL mutation
    const createDocumentRes = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          mutation CreateDoc($input: CreateDocumentInput!) {
            createDocument(input: $input) {
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
        `,
        variables: {
          input: {
            title: "Integration Test Document",
            content: "Testing GraphQL with real PostgreSQL database.",
            tags: ["integration", "postgres"],
            collectionId: createdCollectionId,
            isArchived: false,
          },
        },
      }),
    });

    const createDocumentJson = await createDocumentRes.json();
    expect(createDocumentRes.status).toBe(200);
    expect(createDocumentJson.errors).toBeUndefined();
    expect(createDocumentJson.data?.createDocument).toBeDefined();

    createdDocumentId = createDocumentJson.data.createDocument.id;
    expect(createDocumentJson.data.createDocument.title).toBe("Integration Test Document");
    expect(createDocumentJson.data.createDocument.content).toBe("Testing GraphQL with real PostgreSQL database.");
    expect(createDocumentJson.data.createDocument.collectionId).toBe(createdCollectionId);
    expect(createDocumentJson.data.createDocument.collection.id).toBe(createdCollectionId);

    // 3. Query documents by collectionId via GraphQL query
    const queryDocumentsRes = await yoga.fetch("http://localhost/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query GetDocs($collectionId: ID!) {
            documents(collectionId: $collectionId) {
              nodes {
                id
                title
                content
                collectionId
                tags
                collection {
                  id
                  name
                  slug
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          collectionId: createdCollectionId,
        },
      }),
    });

    const queryDocumentsJson = await queryDocumentsRes.json();
    expect(queryDocumentsRes.status).toBe(200);
    expect(queryDocumentsJson.errors).toBeUndefined();

    const nodes = queryDocumentsJson.data?.documents?.nodes;
    expect(nodes).toBeDefined();
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe(createdDocumentId);
    expect(nodes[0].title).toBe("Integration Test Document");
    expect(nodes[0].content).toBe("Testing GraphQL with real PostgreSQL database.");
    expect(nodes[0].collectionId).toBe(createdCollectionId);
    expect(nodes[0].collection.name).toBe("Integration Test Collection");
  });
});
