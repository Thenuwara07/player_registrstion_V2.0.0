import { DefaultDetails, SignUpResponse } from "../types/authTypes";
import { apiRequest, withoutEmptyStrings } from "./client";

// Public site settings (homepage hero, club change period)
export const GetdeafaultDetails = async (): Promise<DefaultDetails> =>
  (
    await apiRequest("/user/defaultdetails", {
      errorMessage: "An error occurred while fetching the default details.",
    })
  ).data;

export const updateDetails = (details: DefaultDetails): Promise<SignUpResponse> =>
  apiRequest("/admin/details", {
    method: "PUT",
    body: withoutEmptyStrings({
      herotitle: details.herotitle,
      herosubtitle: details.herosubtitle,
      imageName: details.imageName,
      openclubchangeperiodMonths: details.openclubchangeperiodMonths,
      userId: details.userId,
    }),
    errorMessage: "Failed to update post",
  });
