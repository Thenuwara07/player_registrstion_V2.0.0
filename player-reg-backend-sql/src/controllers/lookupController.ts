// Public read-only lookups: associations, clubs, schools, universities.
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { parseId, parseSortBy, parseSortOrder, sendError, SortOrder } from "../lib/http";
import { CLOSE_ASSOCIATION, ClubSummary, findCloseClub } from "../lib/clubs";

const LOOKUP_SORT_FIELDS = ["id", "name", "code", "status", "createdAt", "updatedAt"];

type OrderBy = Record<string, SortOrder>;

/** GET handler listing a lookup table, sortable via ?sortBy=&sortOrder= (default name A–Z). */
const listHandler =
  (findMany: (orderBy: OrderBy) => Promise<unknown[]>, context: string) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const sortBy = parseSortBy(req.query.sortBy, LOOKUP_SORT_FIELDS, "name");
      const sortOrder = parseSortOrder(req.query.sortOrder);
      const data = await findMany({ [sortBy]: sortOrder });

      res.status(200).json({
        success: true,
        data,
        meta: { count: data.length, sortBy, sortOrder },
      });
    } catch (error) {
      sendError(res, error, context);
    }
  };

export const getAllCloseclubs = listHandler(
  (orderBy) => prisma.closeclubs.findMany({ orderBy }),
  "Error fetching close clubs"
);

export const getAllOpenclubs = listHandler(
  (orderBy) => prisma.openclubs.findMany({ orderBy }),
  "Error fetching open clubs"
);

export const getAllMercclubs = listHandler(
  (orderBy) => prisma.mercantileclubs.findMany({ orderBy }),
  "Error fetching mercantile clubs"
);

export const getAllSchools = listHandler(
  (orderBy) => prisma.schools.findMany({ orderBy }),
  "Error fetching schools"
);

export const getAllUniversities = listHandler(
  (orderBy) => prisma.universities.findMany({ orderBy }),
  "Error fetching universities"
);

// Each association comes with its open clubs (A–Z)
export const getAllAssociations = listHandler(
  (orderBy) =>
    prisma.associations.findMany({
      orderBy,
      include: { openclubs: { orderBy: { name: "asc" } } },
    }),
  "Error fetching associations"
);

export const getOpenClubsByAssociationId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const associationId = parseId(req.params.associationId ?? req.query.associationId);
    if (!associationId) {
      res.status(400).json({ success: false, error: "Invalid associationId" });
      return;
    }

    const clubs = await prisma.openclubs.findMany({
      where: { associationsId: associationId },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      data: clubs,
      meta: { count: clubs.length, associationId },
    });
  } catch (error) {
    sendError(res, error, "Error fetching open clubs");
  }
};

const summarySelect = { id: true, name: true, code: true } as const;

const sendLookupResult = (res: Response, data: ClubSummary | null) => {
  if (!data) {
    res.status(404).json({ success: false, error: "Association not found" });
    return;
  }
  res.status(200).json({ success: true, data });
};

// GET /getassdetails/:type/:associationId — type is "open" or "close"
export const getAssociationById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const associationId = parseId(req.params.associationId ?? req.query.associationId);
    const type = req.params.type ?? req.query.type;
    if (!associationId) {
      res.status(400).json({ success: false, error: "Invalid associationId" });
      return;
    }

    const where = { id: associationId };
    let association: ClubSummary | null;
    if (type === "open") {
      association = await prisma.associations.findUnique({ where, select: summarySelect });
    } else if (type === "close") {
      association = await prisma.closeclubs.findUnique({ where, select: summarySelect });
    } else {
      res.status(400).json({ success: false, error: "Invalid type" });
      return;
    }

    sendLookupResult(res, association);
  } catch (error) {
    sendError(res, error, "Error fetching association");
  }
};

const CLOSE_ASSOCIATIONS_WITH_CLUBS: number[] = Object.values(CLOSE_ASSOCIATION);

// GET /getclubdetails/:type/:associationId/:clubId
// Open clubs are one table; close clubs depend on the close association.
export const getClubById = async (req: Request, res: Response): Promise<void> => {
  try {
    const associationId = parseId(req.params.associationId ?? req.query.associationId);
    const type = req.params.type ?? req.query.type;
    const clubId = Number(req.params.clubId ?? req.query.clubId);
    if (!associationId) {
      res.status(400).json({ success: false, error: "Invalid associationId" });
      return;
    }

    let club: ClubSummary | null;
    if (type === "open") {
      club = await prisma.openclubs.findUnique({ where: { id: clubId }, select: summarySelect });
    } else if (type === "close" && CLOSE_ASSOCIATIONS_WITH_CLUBS.includes(associationId)) {
      club = await findCloseClub(associationId, clubId);
    } else {
      res.status(400).json({ success: false, error: "Invalid type" });
      return;
    }

    sendLookupResult(res, club);
  } catch (error) {
    sendError(res, error, "Error fetching club");
  }
};
