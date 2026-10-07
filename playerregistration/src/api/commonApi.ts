import { PlayerProfile } from "../types/authTypes";
import { Closeclub, Openclub, University, School, MercClub } from "../types/index";
import { apiRequest } from "./client";

const ERROR = "Fetching error";

// Public profile; the signed-in player (own profile) and admins also get
// ID documents and the pending payment.
export const playerDetails = (userId: number): Promise<PlayerProfile> =>
  apiRequest(`/auth/${userId}`, { errorMessage: ERROR });

const getList = async <T>(path: string): Promise<T[]> =>
  (await apiRequest(path, { errorMessage: ERROR })).data;

export const AllCloseclubsDetails = () => getList<Closeclub>("/admin/allcloseclubs");
export const AllOpenclubsDetails = () => getList<Openclub>("/admin/allopenclubs");
export const AllSchools = () => getList<School>("/admin/allschools");
export const AllUniversities = () => getList<University>("/admin/alluniversities");
export const AllMercClubs = () => getList<MercClub>("/admin/allmercclubs");
export const AllAssociations = () => getList<MercClub>("/admin/allassociations");
export const AllOpenClubsByAssociationId = (assId: number) =>
  getList<MercClub>(`/admin/associations/${assId}/openclubs`);
