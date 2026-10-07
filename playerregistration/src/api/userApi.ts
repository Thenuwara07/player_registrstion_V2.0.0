// Player self-service requests. The server acts on the signed-in player,
// so no user id is sent.
import { RegRequest, ResponseupdateTableField, ClubRequest, UserUpdateDetails } from "../types/index";
import { apiRequest } from "./client";

export const regRequest = (request: RegRequest): Promise<ResponseupdateTableField> =>
  apiRequest("/user/regrequest", {
    method: "POST",
    body: { slipImage: request.slipImage, referenceNo: request.reffernceNo },
  });

export const userdetailsUpdate = (
  details: UserUpdateDetails
): Promise<ResponseupdateTableField> =>
  apiRequest("/user/updateuserandplayer", {
    method: "PUT",
    body: {
      firstName: details.firstName,
      email: details.email,
      contact: details.contact,
      weight: details.weight,
      height: details.height,
    },
  });

export const clubchangeRequest = (request: ClubRequest): Promise<ResponseupdateTableField> =>
  apiRequest("/user/clubchange", {
    method: "POST",
    body: {
      type: request.type,
      newImage: request.newImage,
      newClubId: request.newClubId || null,
      newAssId: request.newAssId,
      newClub: request.newClub || null,
      newAss: request.newAss,
      newClubCode: request.newClubCode || null,
      newAssCode: request.newAssCode,
      currentImage: request.currentImage || null,
      currentClubId: request.currentClubId || null,
      currentAssId: request.currentAssId || null,
      currentClub: request.currentClub || null,
      currentAss: request.currentAss || null,
      currentClubCode: request.currentClubCode || null,
      currentAssCode: request.currentAssCode || null,
      resignDate: request.resignDate || null,
    },
  });
