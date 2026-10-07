import { Request, Response } from "express";

// POST /api/upload/image — multer-storage-cloudinary has already uploaded the file
export const uploadImage = (req: Request, res: Response) => {
  // file.path is the secure https URL, file.filename the Cloudinary public_id
  const file = req.file;
  if (!file?.path) {
    return res.status(400).json({ message: "No image received" });
  }
  return res.status(200).json({ url: file.path, publicId: file.filename });
};
