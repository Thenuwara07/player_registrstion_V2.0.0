import { compressImage } from "../utils/imageCompression";
import { apiRequest } from "./client";

// Uploads an image (compressed to < 2 MB first) and returns its public URL.
export const imageUpload = async (file: File): Promise<string> => {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("image", compressed, compressed.name);
  const data = await apiRequest("/upload/image", {
    method: "POST",
    body: formData,
    errorMessage: "Fetching error",
  });
  return data.url;
};

// Builds a unique local filename: file_<timestamp>.<extension>
export const saveFileLocally = async (file: File): Promise<string> => {
  const extension = file.name.split(".").pop();
  return `file_${Date.now()}.${extension}`;
};
