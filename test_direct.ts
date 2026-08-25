import { createSchema } from "graphql-yoga";
import { graphql } from "graphql";
import { createContext } from "./src/graphql/context";
import { resolvers } from "./src/graphql/resolvers";
import { writeFileSync } from "fs";

const typeDefs = await Bun.file("src/graphql/schema.graphql").text();
const schema = createSchema({ typeDefs, resolvers });
const contextValue = createContext();

const testSlug = "engineering-" + Date.now();
const output: string[] = [];

// 1. Create Collection
const createRes = await graphql({
  schema,
  source: `mutation Create($input: CreateCollectionInput!) { createCollection(input: $input) { id name slug createdAt } }`,
  variableValues: { input: { name: "Engineering", slug: testSlug } },
  contextValue,
});
output.push("--- 1. Create Collection ---", JSON.stringify(createRes, null, 2));

const createdId = (createRes.data as { createCollection?: { id: string } })?.createCollection?.id;

// 2. Query collections
const listRes = await graphql({
  schema,
  source: `query { collections { id name slug createdAt } }`,
  contextValue,
});
output.push("--- 2. Query Collections ---", JSON.stringify(listRes, null, 2));

// 3. Query single collection with nested documents
const singleRes = await graphql({
  schema,
  source: `query Get($id: ID!) { collection(id: $id) { id name slug createdAt documents { id title } } }`,
  variableValues: { id: createdId },
  contextValue,
});
output.push("--- 3. Query Single Collection ---", JSON.stringify(singleRes, null, 2));

// 4. Duplicate slug
const dupRes = await graphql({
  schema,
  source: `mutation Create($input: CreateCollectionInput!) { createCollection(input: $input) { id name slug } }`,
  variableValues: { input: { name: "Engineering Dup", slug: testSlug } },
  contextValue,
});
output.push("--- 4. Duplicate Slug Error ---", JSON.stringify(dupRes, null, 2));

await contextValue.prisma.$disconnect();
writeFileSync("test_out.txt", output.join("\n"));
process.exit(0);
