import express from "express";
import { signIn, signUp, signOut } from "../controllers/authControllers";
import { getAllPlayerAccounts, getPlayerDetails } from "../controllers/playerController";
import { authenticateToken, authorizeRoles, optionalAuth } from "../middleware/authMiddleware";
import { authLimiter } from "../middleware/rateLimit";

const router = express.Router();

router.post("/signup", signUp);
router.post("/signin", authLimiter, signIn);
router.post("/logout", authenticateToken, signOut);
// Full player list incl. sensitive fields — admin only.
router.get("/players", authenticateToken, authorizeRoles("admin"), getAllPlayerAccounts);
// Public profile; the player themself and admins also get documents and payments.
// Must stay last: it matches any single path segment.
router.get("/:userid", optionalAuth, getPlayerDetails);

export default router;
