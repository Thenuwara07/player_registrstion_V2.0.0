import { AdminSignupData, SignUpResponse } from "../types/authTypes";
import {
  User1,
  UpdateTableField,
  ResponseupdateTableField,
  Payment,
  Clubchangedetails,
  UpdateRegDate,
  GetAssClubDetails,
  UpdateTableFields,
} from "../types/index";
import { PlayersResponse } from "../types/playerViewDataTypes";
import { apiRequest } from "./client";

// ---- Review queues

export const Getpendingplayers = async (): Promise<User1[]> =>
  (await apiRequest("/admin/pendingplayers", { errorMessage: "Fetching error" })).data;

export const GetpendingRegplayers = async (): Promise<Payment[]> =>
  (await apiRequest("/admin/pendingreg", { errorMessage: "Fetching error" })).data;

export const GetclubgReq = async (): Promise<Clubchangedetails[]> =>
  (await apiRequest("/admin/clubchangereq", { errorMessage: "Fetching error" })).data;

// ---- Approvals and record updates

export const updateTableFeild = ({
  id,
  table,
  column,
  value,
}: UpdateTableField): Promise<ResponseupdateTableField> =>
  apiRequest("/admin/updatefield", {
    method: "PUT",
    body: { id, table, column, value },
    errorMessage: "Update error",
  });

export const updateTableFeilds = ({
  id,
  table,
  updates,
}: UpdateTableFields): Promise<ResponseupdateTableField> =>
  apiRequest("/admin/updatefields", {
    method: "PUT",
    body: { id, table, updates },
    errorMessage: "Update error",
  });

export const updateRegDates = ({
  id,
  regDate,
  expDate,
}: UpdateRegDate): Promise<ResponseupdateTableField> =>
  apiRequest("/admin/updatereg", {
    method: "PUT",
    body: { id, regDate, expDate },
    errorMessage: "Update error",
  });

// ---- Association / club names by id

const LOOKUP_ERROR = "An error occurred while fetching the data.";

export const GetAssDetails = async (
  type: string,
  assId: number
): Promise<GetAssClubDetails> =>
  (await apiRequest(`/admin/getassdetails/${type}/${assId}`, { errorMessage: LOOKUP_ERROR }))
    .data;

export const GetClubDetails = async (
  type: string,
  assId: number,
  clubId: number
): Promise<GetAssClubDetails> =>
  (
    await apiRequest(`/admin/getclubdetails/${type}/${assId}/${clubId}`, {
      errorMessage: LOOKUP_ERROR,
    })
  ).data;

// ---- Admin accounts

export const registerAdmin = (adminData: AdminSignupData): Promise<SignUpResponse> =>
  apiRequest("/admin/signupadmin", {
    method: "POST",
    body: {
      fullName: adminData.fullName,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      dateofBirth: adminData.dateOfbirth,
      gender: adminData.gender,
      district: adminData.district,
      nicNum: adminData.idCardNumber,
      email: adminData.email,
      contact: adminData.contactNumber,
      password: adminData.password,
    },
    errorMessage: "Registration failed",
  });

export const GetAdminDetails = async (): Promise<User1[]> =>
  (await apiRequest("/admin/alladmins", { errorMessage: LOOKUP_ERROR })).data;

// ---- Players

export const getNotRegisteredPlayerCount = async (): Promise<number> => {
  const json = await apiRequest("/admin/notregisteredplayercount", {
    errorMessage: "Failed to get not-registered count",
  });
  return json?.data?.count ?? 0;
};

export async function getAllPlayers(params?: {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<PlayersResponse> {
  const query = new URLSearchParams({
    sortBy: params?.sortBy ?? "firstName",
    sortOrder: params?.sortOrder?.toLowerCase() === "desc" ? "desc" : "asc",
  });
  const json = await apiRequest(`/admin/allplayers?${query}`, {
    errorMessage: "Failed to fetch players",
  });
  if (json?.success === false) {
    throw new Error(json.message || json.error || "Failed to fetch players");
  }
  return json as PlayersResponse;
}

// ---- Club change history

export type Clubchange = {
  id: number;
  userId: number;
  type: string;
  oldAssId?: number | null;
  oldAssCode?: string | null;
  oldAssName?: string | null;
  oldClubId?: number | null;
  oldClubCode?: string | null;
  oldClubName?: string | null;
  oldImage?: string | null;
  resignDate?: string | null;
  newAssId?: number | null;
  newAssCode?: string | null;
  newAssName?: string | null;
  newClubId?: number | null;
  newClubCode?: string | null;
  newClubName?: string | null;
  newImage?: string | null;
  status: string; // "approved"
  createdAt: string;
  updatedAt: string | null;
};

export type ApprovedClubchangesResponse = {
  success: boolean;
  message: string;
  count: number;
  data: Clubchange[];
};

// The player themself or an admin only
export const fetchApprovedClubchanges = (
  userId: number
): Promise<ApprovedClubchangesResponse> =>
  apiRequest(`/admin/clubchanges/${userId}`, { errorMessage: "Fetching error" });
