import { FormData, SignUpResponse } from "../types/authTypes";
import { apiRequest, withoutEmptyStrings } from "./client";

// Sign-in lives in AuthContext.login

export const registerUser = (
  formData: FormData,
  front: string,
  back: string,
  profile: string | null
): Promise<SignUpResponse> =>
  apiRequest("/auth/signup", {
    method: "POST",
    body: withoutEmptyStrings({
      fullName: formData.fullName,
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateofBirth: formData.dateOfBirth,
      gender: formData.gender,
      district: formData.district,
      nicNum: formData.idCardNumber,
      email: formData.email,
      contact: formData.contactNumber,
      password: formData.password,
      profilePictureName: profile,
      weight: formData.weight,
      height: formData.height,
      idType: formData.idType,
      idFrontImage: front,
      idBackImage: back,
    }),
    errorMessage: "Registration failed",
  });
