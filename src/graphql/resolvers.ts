import { Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import type { GraphQLContext } from "./context";

export const resolvers = {
  Query: {
    collections: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      return await context.prisma.collection.findMany({
        orderBy: {
          createdAt: "asc",
        },
      });
    },
    collection: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      return await context.prisma.collection.findUnique({
        where: {
          id: args.id,
        },
      });
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
  Collection: {
    createdAt: (parent: { createdAt: Date | string }) => {
      return parent.createdAt instanceof Date
        ? parent.createdAt.toISOString()
        : parent.createdAt;
    },
    documents: async (parent: { id: string }, _args: unknown, context: GraphQLContext) => {
      return await context.prisma.document.findMany({
        where: {
          collectionId: parent.id,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    },
  },
  Document: {
    createdAt: (parent: { createdAt: Date | string }) => {
      return parent.createdAt instanceof Date
        ? parent.createdAt.toISOString()
        : parent.createdAt;
    },
    collection: async (
      parent: { collectionId: string },
      _args: unknown,
      context: GraphQLContext
    ) => {
      const collection = await context.prisma.collection.findUnique({
        where: {
          id: parent.collectionId,
        },
      });

      if (!collection) {
        throw new GraphQLError("Collection not found.");
      }

      return collection;
    },
  },
  Mutation: {
    createCollection: async (
      _parent: unknown,
      args: { input: { name: string; slug: string } },
      context: GraphQLContext
    ) => {
      try {
        return await context.prisma.collection.create({
          data: {
            name: args.input.name,
            slug: args.input.slug,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new GraphQLError("A collection with this slug already exists.");
        }
        throw error;
      }
    },
    createDocument: async (
      _parent: unknown,
      args: {
        input: {
          title: string;
          content: string;
          tags?: string[];
          collectionId: string;
          isArchived?: boolean;
        };
      },
      context: GraphQLContext
    ) => {
      const { title, content, tags, collectionId, isArchived } = args.input;

      if (!title || title.trim() === "") {
        throw new GraphQLError("Title cannot be empty.");
      }

      if (!content || content.trim() === "") {
        throw new GraphQLError("Content cannot be empty.");
      }

      const collectionExists = await context.prisma.collection.findUnique({
        where: {
          id: collectionId,
        },
      });

      if (!collectionExists) {
        throw new GraphQLError("Collection not found.");
      }

      try {
        return await context.prisma.document.create({
          data: {
            title,
            content,
            tags: tags ?? [],
            collectionId,
            ...(isArchived !== undefined ? { isArchived } : {}),
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2003"
        ) {
          throw new GraphQLError("Collection not found.");
        }
        throw error;
      }
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
