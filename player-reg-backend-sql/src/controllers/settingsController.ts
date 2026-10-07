// Site settings: a single row (id 1) holding the homepage hero and
// the open-club change period.
import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendError, sendServerError } from "../lib/http";
import { logRequestActivity } from "../lib/activityLog";

const SETTINGS_ID = 1;

// GET /api/user/defaultdetails — public
export const defaultDetails = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await prisma.setting.findFirst({ where: { id: SETTINGS_ID } });
    res.status(200).json({ success: true, data });
  } catch (error) {
    sendError(res, error, "Error fetching settings");
  }
};

/** Removes keys whose value is undefined. */
const pruneUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

// PUT /api/admin/details — partial update; creates the row if missing
export const updateDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { herotitle, herosubtitle, imageName, openclubchangeperiodMonths, userId } = req.body;

    const trimmedSubtitle =
      herosubtitle !== undefined ? String(herosubtitle).trim() : undefined;
    const changes = pruneUndefined({
      herotitle: herotitle !== undefined ? String(herotitle).trim() : undefined,
      // An empty subtitle clears it
      herosubtitle: trimmedSubtitle === "" ? null : trimmedSubtitle,
      imageName: imageName !== undefined ? String(imageName).trim() : undefined,
      openclubchangeperiodMonths:
        openclubchangeperiodMonths !== undefined ? Number(openclubchangeperiodMonths) : undefined,
      userId: userId !== undefined ? Number(userId) : undefined,
    });

    if (Object.keys(changes).length === 0) {
      res.status(200).json({ success: true, message: "No changes applied" });
      return;
    }

    const updated = await prisma.setting.upsert({
      where: { id: SETTINGS_ID },
      update: changes,
      create: {
        id: SETTINGS_ID,
        herotitle: String(herotitle || ""),
        herosubtitle: String(herosubtitle || ""),
        imageName: String(imageName || ""),
        openclubchangeperiodMonths: Number(openclubchangeperiodMonths || 1),
        userId: Number(userId || 0),
      },
    });
    logRequestActivity(
      req,
      `Updated site settings (${Object.keys(changes)
        .filter((key) => key !== "userId")
        .join(", ")})`
    );

    res.status(200).json({
      success: true,
      message: "Settings and User ID updated successfully",
      data: updated,
    });
  } catch (error) {
    sendServerError(res, error, "Error updating settings");
  }
};
