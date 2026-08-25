import { GraphQLError } from "graphql";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateSlug(slug: string): void {
  if (!slug || !SLUG_REGEX.test(slug)) {
    throw new GraphQLError("Invalid collection slug.");
  }
}

export function validateCollectionName(name: string): string {
  if (!name || name.trim() === "") {
    throw new GraphQLError("Collection name cannot be empty.");
  }
  return name.trim();
}

export function validateDocumentTitle(title: string): string {
  if (!title || title.trim() === "") {
    throw new GraphQLError("Title cannot be empty.");
  }
  return title.trim();
}

export function validateDocumentContent(content: string): string {
  if (!content || content.trim() === "") {
    throw new GraphQLError("Content cannot be empty.");
  }
  return content.trim();
}
