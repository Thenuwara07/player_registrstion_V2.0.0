// Player self-service actions. These always act on the signed-in player
// (from the token); any userId sent in the body is ignored.
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { sendServerError } from "../lib/http";
import { logRequestActivity } from "../lib/activityLog";

// Routes using these handlers run authenticateToken first
const currentUserId = (req: Request) => req.user!.id;

// POST /api/user/regrequest — submit a registration payment slip
export const regRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slipImage, referenceNo } = req.body;

    if (!slipImage || !referenceNo) {
      res.status(400).json({
        success: false,
        message: "Missing required fields: slipImage or referenceNo",
      });
      return;
    }

    const payment = await prisma.payment.create({
      data: { userId: currentUserId(req), referenceNo, slipImage },
    });
    logRequestActivity(req, `Submitted registration payment slip (Ref: ${referenceNo})`);

    res.status(201).json({
      success: true,
      message: "Payment slip uploaded successfully",
      data: payment,
    });
  } catch (error) {
    sendServerError(res, error, "Error creating payment record");
  }
};

// POST /api/user/clubchange — request an open or close club change
export const clubchangeRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      type,
      newImage,
      newClubId,
      newAssId,
      newClub,
      newAss,
      newClubCode,
      newAssCode,
      currentClubId,
      currentClubCode,
      currentAssId,
      currentAssCode,
      currentImage,
      resignDate,
      currentClub,
      currentAss,
    } = req.body;

    if (!type || !newImage || !newAssId || !newAssCode) {
      res.status(400).json({ success: false, message: "Missing required fields!" });
      return;
    }

    const clubChange = await prisma.clubchange.create({
      data: {
        userId: currentUserId(req),
        type,
        oldAssId: currentAssId || null,
        oldAssName: currentAss || null,
        oldAssCode: currentAssCode || null,
        oldClubId: currentClubId || null,
        oldClubName: currentClub || null,
        oldClubCode: currentClubCode || null,
        oldImage: currentImage || null,
        newAssId,
        newAssName: newAss,
        newAssCode,
        newClubId: newClubId || null,
        newClubName: newClub || null,
        newClubCode: newClubCode || null,
        newImage,
        resignDate,
      },
    });
    logRequestActivity(
      req,
      `Requested ${type} club change to ${newAss || newAssCode}${newClub ? ` / ${newClub}` : ""}`
    );

    res.status(201).json({
      success: true,
      message: "Club change request successfully submitted",
      data: clubChange,
    });
  } catch (error) {
    sendServerError(res, error, "Error creating club change request");
  }
};

const toIntOrUndefined = (value: unknown) => (value ? parseInt(String(value), 10) : undefined);

// PUT /api/user/updateuserandplayer — edit own profile details
export const updateUserAndPlayer = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = currentUserId(req);
    const { firstName, lastName, contact, email, height, weight } = req.body;

    const [updatedUser, updatedPlayer] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { firstName, lastName, contact, email },
      }),
      prisma.player.update({
        where: { userId },
        data: { height: toIntOrUndefined(height), weight: toIntOrUndefined(weight) },
      }),
    ]);

    const changedFields = Object.entries({ firstName, lastName, contact, email, height, weight })
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([field]) => field);
    logRequestActivity(req, `Updated profile details (${changedFields.join(", ") || "no fields"})`);

    res.status(200).json({
      success: true,
      message: "User and Player updated successfully.",
      data: { user: updatedUser, player: updatedPlayer },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(400).json({
        success: false,
        message: "This email is already used by another account",
      });
      return;
    }
    sendServerError(res, error, "Error updating user and player");
  }
};
