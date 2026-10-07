import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { JWT_SECRET } from "../lib/env";
import { logActivity, logRequestActivity } from "../lib/activityLog";

// POST /api/auth/logout — the token itself is stateless; this only records it
export const signOut = async (req: Request, res: Response): Promise<void> => {
  logRequestActivity(req, "User logged out");
  res.status(200).json({ success: true });
};

// Sends a 400 with a message the sign-up form shows to the user
const badRequest = (res: Response, message: string) => {
  res.status(400).json({ success: false, error: message, message });
};

const isBlank = (value: unknown) =>
  value === undefined || value === null || String(value).trim() === "";

// POST /api/auth/signup — public; always creates a pending player
export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      email,
      password,
      firstName,
      lastName,
      nicNum,
      contact,
      dateofBirth,
      gender,
      district,
      profilePictureName,
      weight,
      height,
      idType,
      idFrontImage,
      idBackImage,
    } = req.body;

    // Validate before touching the database so users get a clear message
    const required = { email, password, firstName, lastName, contact, dateofBirth, gender, district, idType };
    const missing = Object.entries(required)
      .filter(([, value]) => isBlank(value))
      .map(([field]) => field);
    if (missing.length) {
      badRequest(res, `Missing required fields: ${missing.join(", ")}`);
      return;
    }

    const birthDate = new Date(dateofBirth);
    if (Number.isNaN(birthDate.getTime())) {
      badRequest(res, "Invalid date of birth");
      return;
    }
    const weightKg = parseInt(weight, 10);
    const heightCm = parseInt(height, 10);
    if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) {
      badRequest(res, "Please enter a valid height and weight");
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      badRequest(res, "An account with this email already exists");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // User + player profile are created together: if either fails, neither
    // is saved (no half-created accounts that block re-registering).
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: fullName || `${firstName} ${lastName}`.trim(),
          email,
          password: hashedPassword,
          firstName,
          lastName,
          nicNum: nicNum || undefined,
          contact,
          dateofBirth: birthDate,
          gender,
          // Admins are created only by other admins (POST /api/admin/signupadmin)
          role: "player",
          status: "pending",
          district,
          // Optional: omit to use the default picture (null is not allowed)
          profilePictureName: profilePictureName || undefined,
        },
      });
      await tx.player.create({
        data: {
          userId: user.id,
          weight: weightKg,
          height: heightCm,
          idType,
          idFrontImage,
          idBackImage,
        },
      });
      return user;
    });

    logActivity(newUser.id, newUser.role, `New ${newUser.role} account registered (${newUser.email})`);
    res.status(201).json({ success: true, message: "Player registered successfully" });
  } catch (error) {
    // Unique NIC / email already used by another account
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = String((error.meta as { target?: unknown })?.target ?? "");
      badRequest(
        res,
        target.includes("nicNum")
          ? "This NIC number is already registered"
          : "An account with these details already exists"
      );
      return;
    }
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      error: "Signup failed",
      message: "Registration failed. Please try again.",
    });
  }
};

// POST /api/auth/signin — username is an email address or an NIC number
export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    // NIC numbers never contain "@", so anything with one is an email
    const where = username.includes("@") ? { email: username } : { nicNum: username };
    const user = await prisma.user.findFirst({ where, omit: { password: false } });

    // Same response for unknown user and wrong password, so the endpoint
    // can't be used to check which emails/NICs have accounts.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logActivity(
        user?.id ?? null,
        user?.role ?? "guest",
        user
          ? "Failed login: wrong password"
          : `Failed login: no account for "${username.slice(0, 100)}"`
      );
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    logActivity(user.id, user.role, "User logged in");

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ error: "Signin failed" });
  }
};
