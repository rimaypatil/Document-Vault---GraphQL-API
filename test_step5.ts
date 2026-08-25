import { createSchema, createYoga } from "graphql-yoga";
import { createContext } from "./src/graphql/context";
import { resolvers } from "./src/graphql/resolvers";

const typeDefs = await Bun.file("src/graphql/schema.graphql").text();

const schema = createSchema({
  typeDefs,
  resolvers,
});

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/graphql",
});

const server = Bun.serve({
  port: 4001,
  fetch: yoga.fetch,
});

async function executeQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch("http://localhost:4001/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return await res.json();
}

try {
  // 1. Create Collection
  console.log("--- 1. Create Collection ---");
  const testSlug = "engineering-" + Date.now();
  const createRes = await executeQuery(`
    mutation CreateCol($input: CreateCollectionInput!) {
      createCollection(input: $input) {
        id
        name
        slug
        createdAt
      }
    }
  `, { input: { name: "Engineering", slug: testSlug } });
  console.log(JSON.stringify(createRes, null, 2));

  const createdId = createRes.data?.createCollection?.id;

  // 2. Query Collections
  console.log("--- 2. Query Collections ---");
  const collectionsRes = await executeQuery(`
    query {
      collections {
        id
        name
        slug
        createdAt
      }
    }
  `);
  console.log(JSON.stringify(collectionsRes, null, 2));

  // 3. Query One Collection with nested documents
  console.log("--- 3. Query One Collection ---");
  const singleRes = await executeQuery(`
    query GetCol($id: ID!) {
      collection(id: $id) {
        id
        name
        slug
        createdAt
        documents {
          id
          title
        }
      }
    }
  `, { id: createdId });
  console.log(JSON.stringify(singleRes, null, 2));

  // 4. Duplicate slug attempt
  console.log("--- 4. Duplicate Slug Attempt ---");
  const dupRes = await executeQuery(`
    mutation CreateDup($input: CreateCollectionInput!) {
      createCollection(input: $input) {
        id
        name
        slug
      }
    }
  `, { input: { name: "Engineering Duplicate", slug: testSlug } });
  console.log(JSON.stringify(dupRes, null, 2));

} finally {
  server.stop();
}
