import { createSchema, createYoga } from "graphql-yoga";
import { createContext } from "./graphql/context";
import { resolvers } from "./graphql/resolvers";

const typeDefs: string = await Bun.file("src/graphql/schema.graphql").text();

export const schema = createSchema({
  typeDefs,
  resolvers,
});

export const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/graphql",
});

const PORT: number = process.env.NODE_ENV === "test" ? 0 : (Number(process.env.PORT) || 4000);

export const server = Bun.serve({
  port: PORT,
  fetch: yoga.fetch,
});

console.log(`Document Vault GraphQL API running at http://localhost:${server.port}/graphql`);
