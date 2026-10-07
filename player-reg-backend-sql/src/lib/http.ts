// Shared request/response helpers for controllers.
import { Response } from "express";
import { Prisma } from "@prisma/client";

export type SortOrder = "asc" | "desc";

/** "desc" (any case) → "desc"; anything else → "asc". */
export const parseSortOrder = (value: unknown): SortOrder =>
  String(value ?? "").toLowerCase() === "desc" ? "desc" : "asc";

/** Returns `value` if it is one of `allowed`, otherwise `fallback`. */
export const parseSortBy = (
  value: unknown,
  allowed: readonly string[],
  fallback: string
): string => {
  const field = typeof value === "string" ? value.trim() : "";
  return allowed.includes(field) ? field : fallback;
};

/**
 * Logs the error and sends the standard error response used by the list
 * endpoints: 400 for Prisma request/validation errors, 500 otherwise.
 * Internal error messages are never sent to the client.
 */
export const sendError = (res: Response, error: unknown, context: string) => {
  console.error(`${context}:`, error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    res.status(400).json({
      success: false,
      error: "Database error",
      code: error.code,
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ success: false, error: "Validation error" });
    return;
  }
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: "Internal server error",
  });
};

/** Logs the error and sends `{ success: false, message }` with a 500. */
export const sendServerError = (
  res: Response,
  error: unknown,
  context: string,
  message = "Internal server error"
) => {
  console.error(`${context}:`, error);
  res.status(500).json({ success: false, message });
};

/** Parses a positive integer id; returns null if invalid. */
export const parseId = (value: unknown): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};
