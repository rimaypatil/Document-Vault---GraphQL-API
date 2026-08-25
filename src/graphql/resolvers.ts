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
    documents: async (
      _parent: unknown,
      args: {
        collectionId?: string;
        search?: string;
        isArchived?: boolean;
        take?: number;
        cursor?: string;
      },
      context: GraphQLContext
    ) => {
      const { collectionId, search, isArchived, cursor } = args;
      const take = args.take ?? 10;

      if (args.take !== undefined) {
        if (args.take <= 0) {
          throw new GraphQLError("take must be greater than zero.");
        }
        if (args.take > 100) {
          throw new GraphQLError("take cannot be greater than 100.");
        }
      }

      const where: Prisma.DocumentWhereInput = {};

      if (collectionId) {
        where.collectionId = collectionId;
      }

      if (isArchived !== undefined) {
        where.isArchived = isArchived;
      }

      if (search) {
        const trimmedSearch = search.trim();
        if (trimmedSearch !== "") {
          where.OR = [
            {
              title: {
                contains: trimmedSearch,
                mode: "insensitive",
              },
            },
            {
              content: {
                contains: trimmedSearch,
                mode: "insensitive",
              },
            },
          ];
        }
      }

      try {
        const documents = await context.prisma.document.findMany({
          where,
          orderBy: [
            { createdAt: "asc" },
            { id: "asc" },
          ],
          take: take + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasNextPage = documents.length > take;
        const nodes = hasNextPage ? documents.slice(0, take) : documents;
        const endCursor = nodes.length > 0 ? nodes[nodes.length - 1].id : null;

        return {
          nodes,
          pageInfo: {
            hasNextPage,
            endCursor,
          },
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2025" || error.code === "P2016" || error.code === "P2001")
        ) {
          throw new GraphQLError("Invalid cursor.");
        }
        throw error;
      }
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
    updateDocument: async (
      _parent: unknown,
      args: {
        input: {
          id: string;
          title?: string;
          content?: string;
          tags?: string[];
          isArchived?: boolean;
        };
      },
      context: GraphQLContext
    ) => {
      const { id, title, content, tags, isArchived } = args.input;

      if (title !== undefined && title.trim() === "") {
        throw new GraphQLError("Title cannot be empty.");
      }

      if (content !== undefined && content.trim() === "") {
        throw new GraphQLError("Content cannot be empty.");
      }

      const dataToUpdate: Prisma.DocumentUpdateInput = {};

      if (title !== undefined) {
        dataToUpdate.title = title;
      }
      if (content !== undefined) {
        dataToUpdate.content = content;
      }
      if (tags !== undefined) {
        dataToUpdate.tags = tags;
      }
      if (isArchived !== undefined) {
        dataToUpdate.isArchived = isArchived;
      }

      try {
        return await context.prisma.document.update({
          where: {
            id,
          },
          data: dataToUpdate,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new GraphQLError("Document not found.");
        }
        throw error;
      }
    },
    deleteDocument: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext
    ) => {
      try {
        await context.prisma.document.delete({
          where: {
            id: args.id,
          },
        });
        return true;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new GraphQLError("Document not found.");
        }
        throw error;
      }
    },
    moveDocument: async (
      _parent: unknown,
      args: { id: string; collectionId: string },
      context: GraphQLContext
    ) => {
      const { id, collectionId } = args;

      const documentExists = await context.prisma.document.findUnique({
        where: { id },
      });

      if (!documentExists) {
        throw new GraphQLError("Document not found.");
      }

      const collectionExists = await context.prisma.collection.findUnique({
        where: { id: collectionId },
      });

      if (!collectionExists) {
        throw new GraphQLError("Collection not found.");
      }

      try {
        return await context.prisma.document.update({
          where: {
            id,
          },
          data: {
            collectionId,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2025") {
            throw new GraphQLError("Document not found.");
          }
          if (error.code === "P2003") {
            throw new GraphQLError("Collection not found.");
          }
        }
        throw error;
      }
    },
  },
};
