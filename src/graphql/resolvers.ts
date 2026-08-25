import type { GraphQLContext } from "./context";

export const resolvers = {
  Query: {
    collections: (_parent: unknown, _args: unknown, _context: GraphQLContext) => {
      return [];
    },
    collection: (_parent: unknown, _args: { id: string }, _context: GraphQLContext) => {
      return null;
    },
    documents: (
      _parent: unknown,
      _args: {
        collectionId?: string;
        search?: string;
        isArchived?: boolean;
        take?: number;
        cursor?: string;
      },
      _context: GraphQLContext
    ) => {
      return {
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      };
    },
  },
  Mutation: {
    createCollection: (
      _parent: unknown,
      _args: { input: { name: string; slug: string } },
      _context: GraphQLContext
    ) => {
      throw new Error("Mutation not implemented yet");
    },
    createDocument: (
      _parent: unknown,
      _args: {
        input: {
          title: string;
          content: string;
          tags?: string[];
          collectionId: string;
        };
      },
      _context: GraphQLContext
    ) => {
      throw new Error("Mutation not implemented yet");
    },
    updateDocument: (
      _parent: unknown,
      _args: {
        id: string;
        input: {
          title?: string;
          content?: string;
          tags?: string[];
          isArchived?: boolean;
        };
      },
      _context: GraphQLContext
    ) => {
      throw new Error("Mutation not implemented yet");
    },
    deleteDocument: (
      _parent: unknown,
      _args: { id: string },
      _context: GraphQLContext
    ) => {
      throw new Error("Mutation not implemented yet");
    },
    moveDocument: (
      _parent: unknown,
      _args: { id: string; targetCollectionId: string },
      _context: GraphQLContext
    ) => {
      throw new Error("Mutation not implemented yet");
    },
  },
};
