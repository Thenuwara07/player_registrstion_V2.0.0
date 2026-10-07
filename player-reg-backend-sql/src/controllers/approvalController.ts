// Admin review queues: pending players, payments and club changes,
// plus the field updates the dashboard uses to approve them.
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { parseSortOrder, sendError, sendServerError } from "../lib/http";
import { logRequestActivity, userDisplayName } from "../lib/activityLog";

// --- Activity log descriptions for the dashboard's generic field updates ---

const ownerName = (table: string, record: any) =>
  userDisplayName(table === "user" ? record?.id : record?.userId);

const recordLabel = (table: string, record: any) => {
  switch (table) {
    case "user":
      return "player account";
    case "payment":
      return `registration payment (Ref: ${record?.referenceNo ?? "N/A"})`;
    case "clubchange":
      return `${record?.type ?? ""} club change request`.trim();
    default:
      return `${table} record`;
  }
};

const describeFieldUpdate = async (
  table: string,
  record: any,
  column: string,
  value: unknown
): Promise<string> => {
  const name = await ownerName(table, record);
  if (column === "status") {
    const label = recordLabel(table, record);
    if (value === "rejected") return `Rejected ${label} of ${name}`;
    if (value === "approved" || value === "confirmed")
      return `Approved ${label} of ${name}`;
    return `Set ${label} status of ${name} to "${value}"`;
  }
  if (table === "player" && column === "slbfId") {
    return `Assigned SLBF ID ${value} to ${name}`;
  }
  return `Updated ${table} ${column} of ${name} to "${value}"`;
};

const describeFieldsUpdate = async (
  table: string,
  record: any,
  updates: Record<string, unknown>
): Promise<string> => {
  const name = await ownerName(table, record);
  const slbf = updates.slbfId ? ` (SLBF ID: ${updates.slbfId})` : "";
  if (table === "player" && ("openClubId" in updates || "openAssId" in updates)) {
    return `Updated open club of ${name}${slbf}`;
  }
  if (table === "player" && ("closeClubId" in updates || "closeAssId" in updates)) {
    return `Updated close club of ${name}${slbf}`;
  }
  return `Updated ${table} of ${name} (${Object.keys(updates).join(", ")})`;
};

// The generic updaters take table and column names from the request body.
// Restrict them to exactly what the admin dashboard sends (approve
// player/payment/club change, assign SLBF id, record club-change dates) so
// they can't write arbitrary tables/columns (e.g. user.role, user.password).
const UPDATABLE_FIELDS: Record<string, ReadonlySet<string>> = {
  user: new Set(["status"]),
  player: new Set([
    "slbfId",
    "openAssId",
    "openClubId",
    "openClubChagngeDate",
    "closeAssId",
    "closeClubId",
    "closeClubChagngeDate",
  ]),
  payment: new Set(["status"]),
  clubchange: new Set(["status"]),
};

const isUpdatableField = (table: string, column: string) =>
  UPDATABLE_FIELDS[table]?.has(column) ?? false;

// Table names are checked against UPDATABLE_FIELDS before this is called
const updateRecord = (table: string, id: number, data: Record<string, unknown>) =>
  (prisma as any)[table].update({ where: { id }, data });

/** Sends a pending-queue list in the dashboard's expected shape. */
const sendPendingList = (req: Request, res: Response, data: unknown[]) => {
  res.status(200).json({
    success: true,
    data,
    meta: {
      count: data.length,
      sortBy: req.query.sortBy ?? "createdAt",
      sortOrder: parseSortOrder(req.query.sortOrder),
    },
  });
};

// Pending items always come newest first, with the user and player attached
const withUserAndPlayer = { user: { include: { player: true } } } as const;

export const getPendingPlayers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { status: "pending", role: "player" },
      orderBy: { createdAt: "desc" },
      include: { player: true },
    });
    sendPendingList(req, res, users);
  } catch (error) {
    sendError(res, error, "Error fetching pending players");
  }
};

export const getPendingReg = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      include: withUserAndPlayer,
    });
    sendPendingList(req, res, payments);
  } catch (error) {
    sendError(res, error, "Error fetching pending payments");
  }
};

export const getClubchangePendingReq = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await prisma.clubchange.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      include: withUserAndPlayer,
    });
    sendPendingList(req, res, requests);
  } catch (error) {
    sendError(res, error, "Error fetching pending club changes");
  }
};

// PUT /updatefield — { table, id, column, value }
export const updatetableField = async (req: Request, res: Response): Promise<void> => {
  try {
    const { table, id, column, value } = req.body;

    if (!id || !column || !table || value === undefined) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: userId, column, table or value",
      });
      return;
    }
    if (!isUpdatableField(table, column)) {
      res.status(400).json({
        success: false,
        message: `Updating ${table}.${column} is not allowed.`,
      });
      return;
    }

    const updatedRecord = await updateRecord(table, parseInt(id, 10), { [column]: value });
    logRequestActivity(req, await describeFieldUpdate(table, updatedRecord, column, value));

    res.status(200).json({
      success: true,
      message: `Updated ${column} successfully.`,
      data: updatedRecord,
    });
  } catch (error) {
    sendServerError(res, error, "Error updating field");
  }
};

// PUT /updatefields — { table, id, updates: { column: value, ... } }
export const updatetableFields = async (req: Request, res: Response): Promise<void> => {
  try {
    const { table, id, updates } = req.body;

    if (!id || !table || !updates || typeof updates !== "object") {
      res.status(400).json({
        success: false,
        message: "Missing required fields: table, id, or updates object",
      });
      return;
    }
    const invalidColumn = Object.keys(updates).find(
      (column) => !isUpdatableField(table, column)
    );
    if (invalidColumn) {
      res.status(400).json({
        success: false,
        message: `Updating ${table}.${invalidColumn} is not allowed.`,
      });
      return;
    }

    const updatedRecord = await updateRecord(table, parseInt(id, 10), updates);
    logRequestActivity(req, await describeFieldsUpdate(table, updatedRecord, updates));

    res.status(200).json({ success: true, message: "Updated record successfully." });
  } catch (error) {
    sendServerError(res, error, "Error updating record");
  }
};

const toDateLabel = (value: string) => new Date(value).toISOString().slice(0, 10);

// PUT /updatereg — { id (player id), regDate, expDate }
export const updatePlayerRegDates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, regDate, expDate } = req.body;

    if (!id || !regDate || !expDate) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: id, regDate or expDate",
      });
      return;
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: parseInt(id, 10) },
      data: { regDate: new Date(regDate), regExpDate: new Date(expDate) },
    });
    logRequestActivity(
      req,
      `Set registration period of ${await userDisplayName(updatedPlayer.userId)}: ${toDateLabel(regDate)} to ${toDateLabel(expDate)}`
    );

    res.status(200).json({
      success: true,
      message: "Player dates updated successfully.",
      data: updatedPlayer,
    });
  } catch (error) {
    sendServerError(res, error, "Error updating player dates");
  }
};

// Players never registered, or whose registration has expired
export const getNotRegisteredPlayerCount = async (_req: Request, res: Response) => {
  try {
    const count = await prisma.player.count({
      where: {
        user: { role: "player" },
        OR: [{ regDate: null }, { regExpDate: { lt: new Date() } }],
      },
    });
    res.status(200).json({ success: true, message: "OK", data: { count } });
  } catch (error) {
    sendServerError(res, error, "Error counting unregistered players", "Failed to get count");
  }
};
