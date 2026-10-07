// Admin accounts: only existing admins can create new ones.
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { parseSortOrder, sendError } from "../lib/http";
import { logRequestActivity } from "../lib/activityLog";

// POST /api/admin/signupadmin
export const signUpAdmin = async (req: Request, res: Response): Promise<void> => {
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
    } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        fullName,
        password: await bcrypt.hash(password, 10),
        firstName,
        lastName,
        nicNum,
        contact,
        dateofBirth: new Date(dateofBirth),
        gender,
        role: "admin",
        status: "active",
        district,
      },
    });
    logRequestActivity(
      req,
      `Created admin account for ${newUser.firstName} ${newUser.lastName} (${newUser.email})`
    );

    res.status(201).json({ success: "User registered successfully" });
  } catch (error) {
    console.error("Error creating admin account:", error);
    res.status(500).json({ error: "Failed to create account." });
  }
};

const ADMIN_SORT_FIELDS = new Set([
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
]);

// GET /api/admin/alladmins — sortBy is a user field or "name" (first + last)
export const getAlladmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : "firstName";
    const sortOrder = parseSortOrder(req.query.sortOrder);

    const orderBy =
      sortBy === "name"
        ? [{ firstName: sortOrder }, { lastName: sortOrder }]
        : ADMIN_SORT_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder }
        : { createdAt: "asc" as const };

    const admins = await prisma.user.findMany({ where: { role: "admin" }, orderBy });

    res.status(200).json({
      success: true,
      data: admins,
      meta: { count: admins.length, sortBy, sortOrder },
    });
  } catch (error) {
    sendError(res, error, "Error fetching admins");
  }
};
