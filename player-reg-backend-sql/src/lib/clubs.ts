// Close associations whose clubs live in their own lookup tables.
// Other close associations (1, 2, 3, 7) have no club list.
import prisma from "./prisma";

export const CLOSE_ASSOCIATION = {
  SCHOOLS: 4,
  UNIVERSITIES: 5,
  MERCANTILE: 6,
} as const;

export type ClubSummary = { id: number; name: string; code: string };

const clubSelect = { id: true, name: true, code: true } as const;

/** Finds a close club by id in the table that belongs to `closeAssId`. */
export const findCloseClub = (
  closeAssId: number,
  clubId: number
): Promise<ClubSummary | null> => {
  const where = { id: clubId };
  switch (closeAssId) {
    case CLOSE_ASSOCIATION.SCHOOLS:
      return prisma.schools.findUnique({ where, select: clubSelect });
    case CLOSE_ASSOCIATION.UNIVERSITIES:
      return prisma.universities.findUnique({ where, select: clubSelect });
    case CLOSE_ASSOCIATION.MERCANTILE:
      return prisma.mercantileclubs.findUnique({ where, select: clubSelect });
    default:
      return Promise.resolve(null);
  }
};

/** Batch-loads open clubs and close clubs (per table) by id. */
export const loadClubMaps = async (
  players: { openClubId: number | null; closeAssId: number | null; closeClubId: number | null }[]
) => {
  const openIds = new Set<number>();
  const closeIds: Record<number, Set<number>> = {
    [CLOSE_ASSOCIATION.SCHOOLS]: new Set(),
    [CLOSE_ASSOCIATION.UNIVERSITIES]: new Set(),
    [CLOSE_ASSOCIATION.MERCANTILE]: new Set(),
  };

  for (const p of players) {
    if (p.openClubId) openIds.add(p.openClubId);
    if (p.closeAssId && p.closeClubId) closeIds[p.closeAssId]?.add(p.closeClubId);
  }

  const byIds = (ids: Set<number>) => ({
    where: { id: { in: [...ids] } },
    select: clubSelect,
  });
  const none = Promise.resolve([] as ClubSummary[]);
  const schoolIds = closeIds[CLOSE_ASSOCIATION.SCHOOLS];
  const universityIds = closeIds[CLOSE_ASSOCIATION.UNIVERSITIES];
  const mercantileIds = closeIds[CLOSE_ASSOCIATION.MERCANTILE];

  const [openClubs, schools, universities, mercantiles] = await Promise.all([
    openIds.size ? prisma.openclubs.findMany(byIds(openIds)) : none,
    schoolIds.size ? prisma.schools.findMany(byIds(schoolIds)) : none,
    universityIds.size ? prisma.universities.findMany(byIds(universityIds)) : none,
    mercantileIds.size ? prisma.mercantileclubs.findMany(byIds(mercantileIds)) : none,
  ]);

  const toMap = (clubs: ClubSummary[]) => new Map(clubs.map((c) => [c.id, c]));
  const openMap = toMap(openClubs);
  const closeMaps: Record<number, Map<number, ClubSummary>> = {
    [CLOSE_ASSOCIATION.SCHOOLS]: toMap(schools),
    [CLOSE_ASSOCIATION.UNIVERSITIES]: toMap(universities),
    [CLOSE_ASSOCIATION.MERCANTILE]: toMap(mercantiles),
  };

  return {
    openClub: (id: number | null) => (id != null ? openMap.get(id) ?? null : null),
    closeClub: (assId: number | null, clubId: number | null) =>
      assId && clubId ? closeMaps[assId]?.get(clubId) ?? null : null,
  };
};
