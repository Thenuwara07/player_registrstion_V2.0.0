// Player profiles and the player directory.
// Public callers get profiles without identity documents or payment slips;
// the player themself and admins get everything.
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { parseId, parseSortBy, parseSortOrder, sendError, sendServerError } from "../lib/http";
import { loadClubMaps } from "../lib/clubs";
import { isAdmin, isSelfOrAdmin } from "../middleware/authMiddleware";

const MAX_INT_ID = 2_147_483_647;

/** Removes identity-document images from a player record. */
const withoutDocuments = <T extends { idFrontImage?: unknown; idBackImage?: unknown }>(
  player: T
) => {
  const { idFrontImage, idBackImage, ...rest } = player;
  return rest;
};

// GET /api/auth/:userid — userid is a user id or an NIC number
export const getPlayerDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userid } = req.params;
    if (!userid) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const asId = Number(userid);
    const where: Prisma.UserWhereInput =
      Number.isInteger(asId) && asId > 0 && asId <= MAX_INT_ID
        ? { id: asId }
        : { nicNum: userid };
    const user = await prisma.user.findFirst({ where, include: { player: true } });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (!isSelfOrAdmin(req, user.id)) {
      res.json({
        ...user,
        player: user.player ? withoutDocuments(user.player) : null,
        pendingPayment: null,
      });
      return;
    }

    // The latest pending payment, if any
    const pendingPayment = await prisma.payment.findFirst({
      where: { userId: user.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ...user, pendingPayment });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ error: "Failed to retrieve user details" });
  }
};

const USER_SORT_FIELDS = [
  "id",
  "email",
  "fullName",
  "firstName",
  "lastName",
  "nicNum",
  "contact",
  "dateofBirth",
  "gender",
  "role",
  "status",
  "district",
  "profilePictureName",
  "createdAt",
];

// GET /api/auth/players — admin only; raw player records
export const getAllPlayerAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const sortBy = parseSortBy(req.query.sortBy, USER_SORT_FIELDS, "firstName");
    const sortOrder = parseSortOrder(req.query.sortOrder);

    const users = await prisma.user.findMany({
      where: { role: "player" },
      orderBy: { [sortBy]: sortOrder },
      include: { player: true },
    });

    res.status(200).json({
      success: true,
      data: users,
      meta: { count: users.length, sortBy, sortOrder },
    });
  } catch (error) {
    sendError(res, error, "Error fetching players");
  }
};

const PLAYER_SORT_FIELDS = ["regDate", "regExpDate", "createdAt", "updatedAt"];
const PLAYER_ASSOCIATION_SORTS = ["openAssociation", "closeAssociation"];

/**
 * Supported sortBy values: "name", a user field, "player.<field>",
 * or "player.openAssociation.code" / "player.closeAssociation.code".
 */
const buildPlayerOrderBy = (
  sortBy: string,
  sortOrder: Prisma.SortOrder
): Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[] => {
  if (sortBy === "name") return [{ firstName: sortOrder }, { lastName: sortOrder }];
  if (USER_SORT_FIELDS.includes(sortBy)) return { [sortBy]: sortOrder };

  const [prefix, field, sub] = sortBy.split(".");
  if (prefix === "player" && !sub && PLAYER_SORT_FIELDS.includes(field)) {
    return { player: { [field]: sortOrder } };
  }
  if (prefix === "player" && sub === "code" && PLAYER_ASSOCIATION_SORTS.includes(field)) {
    return { player: { [field]: { code: sortOrder } } };
  }
  return { createdAt: "asc" };
};

// GET /api/admin/allplayers — the player directory, with club names resolved.
// Public; admins also get identity-document images.
export const getAllPlayers = async (req: Request, res: Response): Promise<void> => {
  try {
    const sortBy = String(req.query.sortBy ?? "firstName").trim();
    const sortOrder = parseSortOrder(req.query.sortOrder);
    const includeDocuments = isAdmin(req);

    const users = await prisma.user.findMany({
      where: { role: "player" },
      orderBy: buildPlayerOrderBy(sortBy, sortOrder),
      include: {
        player: {
          include: {
            openAssociation: { select: { id: true, name: true, code: true } },
            closeAssociation: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    const clubs = await loadClubMaps(users.flatMap((u) => (u.player ? [u.player] : [])));

    const players = users.map((u) => {
      if (!u.player) return u;
      const player = includeDocuments ? u.player : withoutDocuments(u.player);
      return {
        ...u,
        player: {
          ...player,
          openClub: clubs.openClub(u.player.openClubId),
          closeClub: clubs.closeClub(u.player.closeAssId, u.player.closeClubId),
        },
      };
    });

    res.status(200).json({
      success: true,
      data: players,
      meta: { count: players.length, sortBy, sortOrder },
    });
  } catch (error) {
    sendError(res, error, "Error fetching players");
  }
};

// GET /api/admin/clubchanges/:userId — approved club changes (own or admin)
export const getApprovedClubchangesByUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = parseId(req.params.userId);
    if (!userId) {
      res.status(400).json({ success: false, message: "Invalid userId" });
      return;
    }
    if (!isSelfOrAdmin(req, userId)) {
      res.status(403).json({
        success: false,
        message: "Forbidden. You do not have access to this resource.",
      });
      return;
    }

    const data = await prisma.clubchange.findMany({
      where: { userId, status: "approved" },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({
      success: true,
      message: "Approved clubchange records fetched successfully.",
      count: data.length,
      data,
    });
  } catch (error) {
    sendServerError(res, error, "Error fetching approved club changes");
  }
};
