import express from "express";
import {
  getPendingPlayers,
  getPendingReg,
  getClubchangePendingReq,
  updatetableField,
  updatetableFields,
  updatePlayerRegDates,
  getNotRegisteredPlayerCount,
} from "../controllers/approvalController";
import {
  getAllCloseclubs,
  getAllOpenclubs,
  getAllMercclubs,
  getAllSchools,
  getAllUniversities,
  getAllAssociations,
  getOpenClubsByAssociationId,
  getAssociationById,
  getClubById,
} from "../controllers/lookupController";
import { getAllPlayers, getApprovedClubchangesByUser } from "../controllers/playerController";
import { signUpAdmin, getAlladmin } from "../controllers/adminUserController";
import { updateDetails } from "../controllers/settingsController";
import { getActivityLogs } from "../controllers/logController";
import { authenticateToken, authorizeRoles, optionalAuth } from "../middleware/authMiddleware";

const router = express.Router();
const adminOnly = [authenticateToken, authorizeRoles("admin")];

// Review queues and approvals
router.get("/pendingplayers", ...adminOnly, getPendingPlayers);
router.get("/pendingreg", ...adminOnly, getPendingReg);
router.get("/clubchangereq", ...adminOnly, getClubchangePendingReq);
router.put("/updatefield", ...adminOnly, updatetableField);
router.put("/updatefields", ...adminOnly, updatetableFields);
router.put("/updatereg", ...adminOnly, updatePlayerRegDates);
router.get("/notregisteredplayercount", ...adminOnly, getNotRegisteredPlayerCount);

// Public lookups
router.get("/allcloseclubs", getAllCloseclubs);
router.get("/allopenclubs", getAllOpenclubs);
router.get("/allmercclubs", getAllMercclubs);
router.get("/allschools", getAllSchools);
router.get("/alluniversities", getAllUniversities);
router.get("/allassociations", getAllAssociations);
router.get("/associations/:associationId/openclubs", getOpenClubsByAssociationId);
router.get("/getassdetails/:type/:associationId", getAssociationById);
router.get("/getclubdetails/:type/:associationId/:clubId", getClubById);

// Players: the directory is public (documents only for admins);
// club-change history is for the player themself or an admin.
router.get("/allplayers", optionalAuth, getAllPlayers);
router.get("/clubchanges/:userId", authenticateToken, getApprovedClubchangesByUser);

// Admin accounts, site settings, activity log
router.post("/signupadmin", ...adminOnly, signUpAdmin);
router.get("/alladmins", ...adminOnly, getAlladmin);
router.put("/details", ...adminOnly, updateDetails);
router.get("/logs", ...adminOnly, getActivityLogs);

export default router;
