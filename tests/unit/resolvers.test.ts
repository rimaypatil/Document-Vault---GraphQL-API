import { describe, expect, test } from "bun:test";
import { Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import { resolvers } from "../../src/graphql/resolvers";
import type { GraphQLContext } from "../../src/graphql/context";

function createMockContext(overrides: Partial<GraphQLContext["prisma"]> = {}): GraphQLContext {
  return {
    prisma: {
      collection: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async () => ({ id: "col-1", name: "Eng", slug: "eng", createdAt: new Date() }),
        update: async () => ({ id: "col-1", name: "Eng", slug: "eng", createdAt: new Date() }),
        delete: async () => ({ id: "col-1", name: "Eng", slug: "eng", createdAt: new Date() }),
        ...overrides.collection,
      },
      document: {
        findMany: async () => [],
        findUnique: async () => null,
        create: async () => ({
          id: "doc-1",
          title: "Title",
          content: "Content",
          tags: [],
          collectionId: "col-1",
          isArchived: false,
          createdAt: new Date(),
        }),
        update: async () => ({
          id: "doc-1",
          title: "Title",
          content: "Content",
          tags: [],
          collectionId: "col-1",
          isArchived: false,
          createdAt: new Date(),
        }),
        delete: async () => ({
          id: "doc-1",
          title: "Title",
          content: "Content",
          tags: [],
          collectionId: "col-1",
          isArchived: false,
          createdAt: new Date(),
        }),
        ...overrides.document,
      },
    } as unknown as GraphQLContext["prisma"],
  };
}

describe("Resolvers Unit Tests", () => {
  describe("Query.collections", () => {
    test("calls collection.findMany with createdAt asc ordering", async () => {
      let passedArgs: Record<string, unknown> | undefined;
      const mockCollections = [{ id: "col-1", name: "Engineering", slug: "engineering", createdAt: new Date() }];

      const context = createMockContext({
        collection: {
          findMany: async (args: Record<string, unknown>) => {
            passedArgs = args;
            return mockCollections as unknown as ReturnType<GraphQLContext["prisma"]["collection"]["findMany"]>;
          },
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      const result = await resolvers.Query.collections({}, {}, context);
      expect(passedArgs).toEqual({ orderBy: { createdAt: "asc" } });
      expect(result).toEqual(mockCollections);
    });
  });

  describe("Query.collection", () => {
    test("calls collection.findUnique with correct where.id", async () => {
      let passedWhere: { id: string } | undefined;
      const mockCol = { id: "col-1", name: "Engineering", slug: "engineering", createdAt: new Date() };

      const context = createMockContext({
        collection: {
          findUnique: async (args: { where: { id: string } }) => {
            passedWhere = args.where;
            return mockCol as unknown as ReturnType<GraphQLContext["prisma"]["collection"]["findUnique"]>;
          },
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      const result = await resolvers.Query.collection({}, { id: "col-1" }, context);
      expect(passedWhere).toEqual({ id: "col-1" });
      expect(result).toEqual(mockCol);
    });

    test("returns null for nonexistent collection", async () => {
      const context = createMockContext({
        collection: {
          findUnique: async () => null,
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      const result = await resolvers.Query.collection({}, { id: "nonexistent" }, context);
      expect(result).toBeNull();
    });
  });

  describe("Mutation.createCollection", () => {
    test("creates collection with valid input", async () => {
      let createData: { name: string; slug: string } | undefined;
      const mockCol = { id: "col-1", name: "Engineering", slug: "engineering-team", createdAt: new Date() };

      const context = createMockContext({
        collection: {
          create: async (args: { data: { name: string; slug: string } }) => {
            createData = args.data;
            return mockCol as unknown as ReturnType<GraphQLContext["prisma"]["collection"]["create"]>;
          },
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      const result = await resolvers.Mutation.createCollection(
        {},
        { input: { name: "Engineering", slug: "engineering-team" } },
        context
      );

      expect(createData).toEqual({ name: "Engineering", slug: "engineering-team" });
      expect(result).toEqual(mockCol);
    });

    test("rejects empty collection name without calling Prisma create", async () => {
      let createCalled = false;
      const context = createMockContext({
        collection: {
          create: async () => {
            createCalled = true;
            return {} as unknown as ReturnType<GraphQLContext["prisma"]["collection"]["create"]>;
          },
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      await expect(
        resolvers.Mutation.createCollection({}, { input: { name: "   ", slug: "valid-slug" } }, context)
      ).rejects.toThrow("Collection name cannot be empty.");
      expect(createCalled).toBeFalse();
    });

    test("rejects invalid slug format without calling Prisma create", async () => {
      let createCalled = false;
      const context = createMockContext({
        collection: {
          create: async () => {
            createCalled = true;
            return {} as unknown as ReturnType<GraphQLContext["prisma"]["collection"]["create"]>;
          },
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      await expect(
        resolvers.Mutation.createCollection({}, { input: { name: "Engineering", slug: "engineering team" } }, context)
      ).rejects.toThrow("Invalid collection slug.");
      expect(createCalled).toBeFalse();
    });

    test("converts duplicate slug P2002 error into GraphQLError", async () => {
      const context = createMockContext({
        collection: {
          create: async () => {
            throw new Prisma.PrismaClientKnownRequestError("Duplicate slug", {
              code: "P2002",
              clientVersion: "6.0.0",
            });
          },
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      await expect(
        resolvers.Mutation.createCollection({}, { input: { name: "Engineering", slug: "existing-slug" } }, context)
      ).rejects.toThrow("A collection with this slug already exists.");
    });
  });

  describe("Mutation.createDocument", () => {
    test("creates document with valid input and default tags", async () => {
      let documentData: Record<string, unknown> | undefined;

      const context = createMockContext({
        collection: {
          findUnique: async () => ({ id: "col-1" }) as unknown as ReturnType<GraphQLContext["prisma"]["collection"]["findUnique"]>,
        } as unknown as GraphQLContext["prisma"]["collection"],
        document: {
          create: async (args: { data: Record<string, unknown> }) => {
            documentData = args.data;
            return { id: "doc-1", ...args.data } as unknown as ReturnType<GraphQLContext["prisma"]["document"]["create"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      const result = await resolvers.Mutation.createDocument(
        {},
        { input: { title: "Title", content: "Content", collectionId: "col-1" } },
        context
      );

      expect(documentData).toEqual({
        title: "Title",
        content: "Content",
        tags: [],
        collectionId: "col-1",
      });
      expect(result.id).toBe("doc-1");
    });

    test("throws GraphQLError if target collection is not found", async () => {
      let createCalled = false;
      const context = createMockContext({
        collection: {
          findUnique: async () => null,
        } as unknown as GraphQLContext["prisma"]["collection"],
        document: {
          create: async () => {
            createCalled = true;
            return {} as unknown as ReturnType<GraphQLContext["prisma"]["document"]["create"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await expect(
        resolvers.Mutation.createDocument({}, { input: { title: "Title", content: "Content", collectionId: "col-missing" } }, context)
      ).rejects.toThrow("Collection not found.");
      expect(createCalled).toBeFalse();
    });

    test("rejects empty title without calling Prisma create", async () => {
      let createCalled = false;
      const context = createMockContext({
        document: {
          create: async () => {
            createCalled = true;
            return {} as unknown as ReturnType<GraphQLContext["prisma"]["document"]["create"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await expect(
        resolvers.Mutation.createDocument({}, { input: { title: "   ", content: "Content", collectionId: "col-1" } }, context)
      ).rejects.toThrow("Title cannot be empty.");
      expect(createCalled).toBeFalse();
    });

    test("rejects empty content without calling Prisma create", async () => {
      let createCalled = false;
      const context = createMockContext({
        document: {
          create: async () => {
            createCalled = true;
            return {} as unknown as ReturnType<GraphQLContext["prisma"]["document"]["create"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await expect(
        resolvers.Mutation.createDocument({}, { input: { title: "Title", content: "   ", collectionId: "col-1" } }, context)
      ).rejects.toThrow("Content cannot be empty.");
      expect(createCalled).toBeFalse();
    });
  });

  describe("Mutation.updateDocument", () => {
    test("updates document fields cleanly", async () => {
      let updatePayload: { where: { id: string }; data: Record<string, unknown> } | undefined;

      const context = createMockContext({
        document: {
          update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
            updatePayload = args;
            return { id: "doc-1", ...args.data } as unknown as ReturnType<GraphQLContext["prisma"]["document"]["update"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await resolvers.Mutation.updateDocument(
        {},
        { input: { id: "doc-1", title: "New Title", isArchived: true } },
        context
      );

      expect(updatePayload).toEqual({
        where: { id: "doc-1" },
        data: { title: "New Title", isArchived: true },
      });
    });

    test("performs partial update without overwriting omitted fields", async () => {
      let updateData: Record<string, unknown> | undefined;

      const context = createMockContext({
        document: {
          update: async (args: { data: Record<string, unknown> }) => {
            updateData = args.data;
            return { id: "doc-1" } as unknown as ReturnType<GraphQLContext["prisma"]["document"]["update"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await resolvers.Mutation.updateDocument({}, { input: { id: "doc-1", title: "Only Title" } }, context);
      expect(updateData).toEqual({ title: "Only Title" });
    });

    test("rejects empty title/content on update", async () => {
      let updateCalled = false;
      const context = createMockContext({
        document: {
          update: async () => {
            updateCalled = true;
            return {} as unknown as ReturnType<GraphQLContext["prisma"]["document"]["update"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await expect(resolvers.Mutation.updateDocument({}, { input: { id: "doc-1", title: "   " } }, context)).rejects.toThrow("Title cannot be empty.");
      await expect(resolvers.Mutation.updateDocument({}, { input: { id: "doc-1", content: "" } }, context)).rejects.toThrow("Content cannot be empty.");
      expect(updateCalled).toBeFalse();
    });

    test("handles P2025 error for nonexistent document", async () => {
      const context = createMockContext({
        document: {
          update: async () => {
            throw new Prisma.PrismaClientKnownRequestError("Record not found", {
              code: "P2025",
              clientVersion: "6.0.0",
            });
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await expect(
        resolvers.Mutation.updateDocument({}, { input: { id: "doc-missing", title: "Title" } }, context)
      ).rejects.toThrow("Document not found.");
    });
  });

  describe("Mutation.deleteDocument", () => {
    test("deletes document and returns true", async () => {
      let deletedId: string | undefined;

      const context = createMockContext({
        document: {
          delete: async (args: { where: { id: string } }) => {
            deletedId = args.where.id;
            return { id: "doc-1" } as unknown as ReturnType<GraphQLContext["prisma"]["document"]["delete"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      const result = await resolvers.Mutation.deleteDocument({}, { id: "doc-1" }, context);
      expect(deletedId).toBe("doc-1");
      expect(result).toBeTrue();
    });

    test("handles P2025 error for nonexistent document delete", async () => {
      const context = createMockContext({
        document: {
          delete: async () => {
            throw new Prisma.PrismaClientKnownRequestError("Record not found", {
              code: "P2025",
              clientVersion: "6.0.0",
            });
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await expect(resolvers.Mutation.deleteDocument({}, { id: "doc-missing" }, context)).rejects.toThrow("Document not found.");
    });
  });

  describe("Mutation.moveDocument", () => {
    test("moves document to target collection", async () => {
      let updatePayload: { where: { id: string }; data: { collectionId: string } } | undefined;

      const context = createMockContext({
        document: {
          findUnique: async () => ({ id: "doc-1" }) as unknown as ReturnType<GraphQLContext["prisma"]["document"]["findUnique"]>,
          update: async (args: { where: { id: string }; data: { collectionId: string } }) => {
            updatePayload = args;
            return { id: "doc-1", collectionId: args.data.collectionId } as unknown as ReturnType<GraphQLContext["prisma"]["document"]["update"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
        collection: {
          findUnique: async () => ({ id: "col-2" }) as unknown as ReturnType<GraphQLContext["prisma"]["collection"]["findUnique"]>,
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      const result = await resolvers.Mutation.moveDocument({}, { id: "doc-1", collectionId: "col-2" }, context);
      expect(updatePayload).toEqual({ where: { id: "doc-1" }, data: { collectionId: "col-2" } });
      expect(result.collectionId).toBe("col-2");
    });

    test("throws GraphQLError if target collection is missing", async () => {
      let updateCalled = false;

      const context = createMockContext({
        document: {
          findUnique: async () => ({ id: "doc-1" }) as unknown as ReturnType<GraphQLContext["prisma"]["document"]["findUnique"]>,
          update: async () => {
            updateCalled = true;
            return {} as unknown as ReturnType<GraphQLContext["prisma"]["document"]["update"]>;
          },
        } as unknown as GraphQLContext["prisma"]["document"],
        collection: {
          findUnique: async () => null,
        } as unknown as GraphQLContext["prisma"]["collection"],
      });

      await expect(
        resolvers.Mutation.moveDocument({}, { id: "doc-1", collectionId: "col-missing" }, context)
      ).rejects.toThrow("Collection not found.");
      expect(updateCalled).toBeFalse();
    });
  });

  describe("Query.documents", () => {
    test("builds correct Prisma filter and ordering for search, collectionId, and isArchived: false", async () => {
      let findManyArgs: Record<string, unknown> | undefined;

      const context = createMockContext({
        document: {
          findMany: async (args: Record<string, unknown>) => {
            findManyArgs = args;
            return [];
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await resolvers.Query.documents(
        {},
        { collectionId: "col-1", search: "graphql", isArchived: false, take: 2 },
        context
      );

      expect(findManyArgs).toEqual({
        where: {
          collectionId: "col-1",
          isArchived: false,
          OR: [
            { title: { contains: "graphql", mode: "insensitive" } },
            { content: { contains: "graphql", mode: "insensitive" } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 3,
      });
    });

    test("correctly includes isArchived: false filter without ignoring false state", async () => {
      let findManyArgs: Record<string, unknown> | undefined;

      const context = createMockContext({
        document: {
          findMany: async (args: Record<string, unknown>) => {
            findManyArgs = args;
            return [];
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await resolvers.Query.documents({}, { isArchived: false }, context);
      expect((findManyArgs?.where as Record<string, unknown>)?.isArchived).toBeFalse();
    });

    test("handles cursor pagination with take + 1 and hasNextPage calculation", async () => {
      const mockDocs = [
        { id: "doc-1", title: "Doc 1" },
        { id: "doc-2", title: "Doc 2" },
        { id: "doc-3", title: "Doc 3" },
      ];

      const context = createMockContext({
        document: {
          findMany: async () => mockDocs as unknown as ReturnType<GraphQLContext["prisma"]["document"]["findMany"]>,
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      const result = await resolvers.Query.documents({}, { take: 2 }, context);
      expect(result.nodes.length).toBe(2);
      expect(result.nodes.map((n: { id: string }) => n.id)).toEqual(["doc-1", "doc-2"]);
      expect(result.pageInfo.hasNextPage).toBeTrue();
      expect(result.pageInfo.endCursor).toBe("doc-2");
    });

    test("handles final page pagination correctly (hasNextPage = false)", async () => {
      const mockDocs = [
        { id: "doc-1", title: "Doc 1" },
        { id: "doc-2", title: "Doc 2" },
      ];

      const context = createMockContext({
        document: {
          findMany: async () => mockDocs as unknown as ReturnType<GraphQLContext["prisma"]["document"]["findMany"]>,
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      const result = await resolvers.Query.documents({}, { take: 2 }, context);
      expect(result.nodes.length).toBe(2);
      expect(result.pageInfo.hasNextPage).toBeFalse();
      expect(result.pageInfo.endCursor).toBe("doc-2");
    });

    test("validates take bounds", async () => {
      const context = createMockContext();
      await expect(resolvers.Query.documents({}, { take: 0 }, context)).rejects.toThrow("take must be greater than zero.");
      await expect(resolvers.Query.documents({}, { take: 101 }, context)).rejects.toThrow("take cannot be greater than 100.");
    });

    test("converts invalid cursor error into GraphQLError", async () => {
      const context = createMockContext({
        document: {
          findMany: async () => {
            throw new Prisma.PrismaClientKnownRequestError("Invalid cursor", {
              code: "P2025",
              clientVersion: "6.0.0",
            });
          },
        } as unknown as GraphQLContext["prisma"]["document"],
      });

      await expect(resolvers.Query.documents({}, { take: 2, cursor: "invalid-cursor" }, context)).rejects.toThrow("Invalid cursor.");
    });
  });
});
