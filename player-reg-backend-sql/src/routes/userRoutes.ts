import express from "express";
import { regRequest, clubchangeRequest, updateUserAndPlayer } from "../controllers/userControllers";
import { defaultDetails } from "../controllers/settingsController";
import { authenticateToken, authorizeRoles } from "../middleware/authMiddleware";

const router = express.Router();
const playerOnly = [authenticateToken, authorizeRoles("player")];

router.post("/regrequest", ...playerOnly, regRequest);
router.post("/clubchange", ...playerOnly, clubchangeRequest);
router.put("/updateuserandplayer", ...playerOnly, updateUserAndPlayer);
router.get("/defaultdetails", defaultDetails);

export default router;
