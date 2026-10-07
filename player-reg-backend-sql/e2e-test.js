// Temporary end-to-end API test against the LOCAL backend + database.
// Creates rows tagged TEST_ / @test.local and deletes them all at the end.
require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const API = "http://localhost:5000/api";
const stamp = Date.now();
let pass = 0;
let fail = 0;

const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  -> ${detail}` : ""}`);
};

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};

const created = { users: [], assoc: [], openclubs: [], closeclubs: [], schools: [], posts: [] };

async function main() {
  // ---------- Fixtures ----------
  const assoc = await prisma.associations.create({
    data: { name: "TEST_Assoc", code: `TA${stamp}`, status: "active" },
  });
  created.assoc.push(assoc.id);
  const openClub = await prisma.openclubs.create({
    data: { name: "TEST_OpenClub", code: `TO${stamp}`, associationsId: assoc.id, status: "active" },
  });
  created.openclubs.push(openClub.id);
  const closeAssoc = await prisma.closeclubs.create({
    data: { name: "TEST_CloseAssoc", code: `TC${stamp}`, status: "active" },
  });
  created.closeclubs.push(closeAssoc.id);
  const school = await prisma.schools.create({
    data: { name: "TEST_School", code: `TS${stamp}`, town: "Colombo", status: "active" },
  });
  created.schools.push(school.id);

  const adminEmail = `test_admin_${stamp}@test.local`;
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: await bcrypt.hash("AdminPass1!", 10),
      fullName: "TEST Admin",
      firstName: "TEST",
      lastName: "Admin",
      contact: "0770000000",
      dateofBirth: new Date("1990-01-01"),
      gender: "Male",
      district: "Colombo",
      role: "admin",
      status: "active",
    },
  });
  created.users.push(admin.id);

  // ---------- Public lookups ----------
  for (const path of ["allcloseclubs", "allopenclubs", "allmercclubs", "allschools", "alluniversities", "allassociations"]) {
    const r = await call("GET", `/admin/${path}`);
    check(`GET /admin/${path} public`, r.status === 200 && Array.isArray(r.json?.data), r.status);
  }
  let r = await call("GET", "/admin/allschools?sortBy=password");
  check("lookup ignores invalid sortBy", r.status === 200 && r.json?.meta?.sortBy === "name", JSON.stringify(r.json?.meta));
  r = await call("GET", `/admin/associations/${assoc.id}/openclubs`);
  check("open clubs by association", r.status === 200 && r.json.data.some((c) => c.id === openClub.id));
  r = await call("GET", `/admin/getassdetails/open/${assoc.id}`);
  check("getassdetails open", r.status === 200 && r.json.data.code === assoc.code);
  r = await call("GET", `/admin/getclubdetails/close/4/${school.id}`);
  check("getclubdetails close/school (guest)", r.status === 200 && r.json.data.code === school.code);
  r = await call("GET", "/user/defaultdetails");
  check("GET /user/defaultdetails public", r.status === 200 && r.json.success === true);
  r = await call("GET", "/admin/posts");
  check("GET /admin/posts public", r.status === 200 && Array.isArray(r.json.data));

  // ---------- Sign-up ----------
  const signup = (n, nic) =>
    call("POST", "/auth/signup", {
      body: {
        email: `test_player${n}_${stamp}@test.lk`,
        password: "PlayerPass1!",
        firstName: `TEST${n}`,
        lastName: "Player",
        nicNum: nic,
        contact: "0771111111",
        dateofBirth: "2000-05-05",
        gender: "Male",
        district: "Kandy",
        weight: "70",
        height: "175",
        idType: "NIC",
        idFrontImage: "https://example.com/front.jpg",
        idBackImage: "https://example.com/back.jpg",
      },
    });
  const nicA = `${stamp}`.slice(-9) + "V";
  const nicB = `${stamp + 1}`.slice(-9) + "V";
  r = await signup("A", nicA);
  check("signup player A", r.status === 201, JSON.stringify(r.json));
  r = await signup("B", nicB);
  check("signup player B", r.status === 201, JSON.stringify(r.json));
  r = await signup("A", `${stamp + 2}`.slice(-9) + "V");
  check("duplicate email rejected (400)", r.status === 400 && /already exists/.test(r.json.message));
  r = await call("POST", "/auth/signup", { body: { email: "x@test.local" } });
  check("missing fields rejected (400)", r.status === 400 && /Missing required/.test(r.json.message));

  const users = await prisma.user.findMany({ where: { email: { contains: `_${stamp}@test.lk` } }, include: { player: true } });
  users.forEach((u) => created.users.push(u.id));
  const A = users.find((u) => u.firstName === "TESTA");
  const B = users.find((u) => u.firstName === "TESTB");
  check("signup created pending player + profile", A?.status === "pending" && A?.role === "player" && A?.player?.weight === 70);

  // ---------- Sign-in ----------
  r = await call("POST", "/auth/signin", { body: { username: A.email, password: "PlayerPass1!" } });
  check("signin by .lk email (was broken)", r.status === 200 && !!r.json.token, JSON.stringify(r.json));
  const tokenA = r.json?.token;
  check("signin response has no password", r.json?.user && !("password" in r.json.user));
  r = await call("POST", "/auth/signin", { body: { username: nicB, password: "PlayerPass1!" } });
  check("signin by NIC", r.status === 200 && !!r.json.token);
  const tokenB = r.json?.token;
  r = await call("POST", "/auth/signin", { body: { username: A.email, password: "wrong" } });
  check("wrong password -> 401", r.status === 401);
  r = await call("POST", "/auth/signin", { body: { username: "nobody@test.local", password: "x" } });
  check("unknown user -> 401 (same as wrong password)", r.status === 401);
  r = await call("POST", "/auth/signin", { body: {} });
  check("empty signin -> 400", r.status === 400);
  r = await call("POST", "/auth/signin", { body: { username: adminEmail, password: "AdminPass1!" } });
  check("admin signin", r.status === 200 && r.json.user.role === "admin");
  const tokenAdmin = r.json?.token;

  // ---------- Profile visibility ----------
  r = await call("GET", `/auth/${A.id}`, { token: tokenA });
  check("own profile includes ID images", r.status === 200 && r.json.player.idFrontImage === "https://example.com/front.jpg");
  check("own profile has no password", r.json && !("password" in r.json));
  r = await call("GET", `/auth/${A.id}`);
  check("guest profile hides ID images + payment", r.status === 200 && !("idFrontImage" in r.json.player) && r.json.pendingPayment === null);
  check("guest profile keeps visible fields", r.json.email === A.email && r.json.player.weight === 70);
  r = await call("GET", `/auth/${A.id}`, { token: tokenB });
  check("other player sees public view only", r.status === 200 && !("idFrontImage" in r.json.player));
  r = await call("GET", `/auth/${A.id}`, { token: tokenAdmin });
  check("admin sees ID images", r.status === 200 && !!r.json.player.idFrontImage);
  r = await call("GET", `/auth/${nicA}`);
  check("profile lookup by NIC", r.status === 200 && r.json.id === A.id);

  // ---------- Player self-service ----------
  r = await call("POST", "/user/regrequest", { token: tokenA, body: { userId: B.id, slipImage: "https://example.com/slip.jpg", referenceNo: "TEST_REF1" } });
  check("payment slip submitted", r.status === 201, JSON.stringify(r.json));
  check("payment saved for signed-in player, not body userId", r.json?.data?.userId === A.id);
  r = await call("GET", `/auth/${A.id}`, { token: tokenA });
  check("own profile shows pendingPayment", r.json?.pendingPayment?.referenceNo === "TEST_REF1");
  r = await call("POST", "/user/regrequest", { body: { slipImage: "x", referenceNo: "y" } });
  check("regrequest without token -> 401", r.status === 401);
  r = await call("POST", "/user/regrequest", { token: tokenAdmin, body: { slipImage: "x", referenceNo: "y" } });
  check("regrequest as admin -> 403", r.status === 403);

  r = await call("PUT", "/user/updateuserandplayer", { token: tokenA, body: { userId: B.id, contact: "0779999999", weight: "72" } });
  check("profile update ok", r.status === 200, JSON.stringify(r.json));
  const [a2, b2] = await Promise.all([
    prisma.user.findUnique({ where: { id: A.id }, include: { player: true } }),
    prisma.user.findUnique({ where: { id: B.id } }),
  ]);
  check("profile update applied to signed-in player", a2.contact === "0779999999" && a2.player.weight === 72);
  check("other player untouched (IDOR fixed)", b2.contact === "0771111111");
  r = await call("PUT", "/user/updateuserandplayer", { token: tokenA, body: { email: B.email } });
  check("email taken -> 400", r.status === 400, `${r.status} ${JSON.stringify(r.json)}`);

  r = await call("POST", "/user/clubchange", {
    token: tokenA,
    body: {
      userId: B.id,
      type: "open",
      newImage: "https://example.com/letter.jpg",
      newAssId: assoc.id,
      newAss: assoc.name,
      newAssCode: assoc.code,
      newClubId: openClub.id,
      newClub: openClub.name,
      newClubCode: openClub.code,
    },
  });
  check("club change request submitted for signed-in player", r.status === 201 && r.json.data.userId === A.id, JSON.stringify(r.json));
  const clubchangeId = r.json?.data?.id;

  // ---------- Admin review ----------
  r = await call("GET", "/admin/pendingplayers", { token: tokenA });
  check("pendingplayers as player -> 403", r.status === 403);
  r = await call("GET", "/admin/pendingplayers", { token: tokenAdmin });
  const pendingA = r.json?.data?.find((u) => u.id === A.id);
  check("pendingplayers lists A", r.status === 200 && !!pendingA);
  check("pendingplayers has no password hashes", r.json?.data?.every((u) => !("password" in u)));
  r = await call("PUT", "/admin/updatefield", { token: tokenAdmin, body: { table: "user", id: A.id, column: "status", value: "confirmed" } });
  check("approve player", r.status === 200);
  r = await call("PUT", "/admin/updatefield", { token: tokenAdmin, body: { table: "user", id: A.id, column: "role", value: "admin" } });
  check("updatefield user.role blocked", r.status === 400);

  r = await call("GET", "/admin/pendingreg", { token: tokenAdmin });
  const pay = r.json?.data?.find((x) => x.userId === A.id);
  check("pendingreg lists A's payment", r.status === 200 && !!pay);
  check("pendingreg nested user has no password", pay && !("password" in pay.user));
  r = await call("PUT", "/admin/updatefield", { token: tokenAdmin, body: { table: "payment", id: pay.id, column: "status", value: "approved" } });
  check("approve payment", r.status === 200);
  r = await call("PUT", "/admin/updatereg", { token: tokenAdmin, body: { id: A.player.id, regDate: "2026-10-01", expDate: "2027-10-01" } });
  check("set registration dates", r.status === 200 && r.json.data.regExpDate.startsWith("2027-10-01"));
  r = await call("PUT", "/admin/updatereg", { token: tokenAdmin, body: { id: A.player.id } });
  check("updatereg missing fields -> 400", r.status === 400);

  r = await call("GET", "/admin/clubchangereq", { token: tokenAdmin });
  check("clubchangereq lists request", r.status === 200 && r.json.data.some((c) => c.id === clubchangeId));
  r = await call("PUT", "/admin/updatefields", {
    token: tokenAdmin,
    body: { table: "player", id: A.player.id, updates: { openAssId: assoc.id, openClubId: openClub.id, openClubChagngeDate: new Date().toISOString(), slbfId: `TEST-SLBF-${stamp}` } },
  });
  check("assign open club + SLBF id", r.status === 200, JSON.stringify(r.json));
  r = await call("PUT", "/admin/updatefield", { token: tokenAdmin, body: { table: "clubchange", id: clubchangeId, column: "status", value: "approved" } });
  check("approve club change", r.status === 200);

  r = await call("GET", `/admin/clubchanges/${A.id}`, { token: tokenA });
  check("own club-change history", r.status === 200 && r.json.count === 1);
  r = await call("GET", `/admin/clubchanges/${A.id}`, { token: tokenB });
  check("other player's history -> 403", r.status === 403);
  r = await call("GET", `/admin/clubchanges/${A.id}`);
  check("history without token -> 401", r.status === 401);
  r = await call("GET", `/admin/clubchanges/${A.id}`, { token: tokenAdmin });
  check("admin reads history", r.status === 200 && r.json.count === 1);

  // ---------- Player directory ----------
  r = await call("GET", "/admin/allplayers");
  const guestA = r.json?.data?.find((u) => u.id === A.id);
  check("directory public", r.status === 200 && !!guestA);
  check("directory resolves open club", guestA?.player?.openClub?.code === openClub.code && guestA?.player?.openAssociation?.code === assoc.code);
  check("directory hides ID images for guests", guestA && !("idFrontImage" in guestA.player));
  check("directory keeps email/contact/NIC/DOB", guestA?.email === A.email && !!guestA?.nicNum && !!guestA?.dateofBirth);
  r = await call("GET", "/admin/allplayers?sortBy=player.openAssociation.code&sortOrder=desc", { token: tokenAdmin });
  const adminA = r.json?.data?.find((u) => u.id === A.id);
  check("directory with relation sort (admin)", r.status === 200 && r.json.meta.sortOrder === "desc");
  check("directory shows ID images to admin", !!adminA?.player?.idFrontImage);
  r = await call("GET", "/auth/players", { token: tokenAdmin });
  check("/auth/players admin", r.status === 200 && r.json.data.every((u) => !("password" in u)));
  r = await call("GET", "/auth/players");
  check("/auth/players guest -> 401", r.status === 401);
  r = await call("GET", "/admin/notregisteredplayercount", { token: tokenAdmin });
  check("not-registered count", r.status === 200 && typeof r.json.data.count === "number");

  // ---------- Admin accounts ----------
  r = await call("POST", "/admin/signupadmin", {
    token: tokenAdmin,
    body: { fullName: "TEST Admin2", email: `test_admin2_${stamp}@test.local`, password: "AdminPass2!", firstName: "TEST", lastName: "Admin2", contact: "0770000001", dateofBirth: "1991-01-01", gender: "Female", district: "Galle" },
  });
  check("create admin", r.status === 201, JSON.stringify(r.json));
  const admin2 = await prisma.user.findUnique({ where: { email: `test_admin2_${stamp}@test.local` } });
  if (admin2) created.users.push(admin2.id);
  r = await call("GET", "/admin/alladmins?sortBy=name", { token: tokenAdmin });
  check("list admins without passwords", r.status === 200 && r.json.data.length >= 2 && r.json.data.every((u) => !("password" in u)));

  // ---------- Posts ----------
  r = await call("POST", "/admin/post", { token: tokenAdmin, body: { title: "TEST_Post", content: "Body", imageName: "https://example.com/p.jpg", userId: B.id } });
  check("create post", r.status === 201, JSON.stringify(r.json));
  check("post author is the signed-in admin", r.json?.data?.userId === admin.id);
  const postId = r.json?.data?.id;
  if (postId) created.posts.push(postId);
  r = await call("PATCH", `/admin/post/${postId}`, { token: tokenAdmin, body: { title: "TEST_Post edited" } });
  check("edit post", r.status === 200 && r.json.data.title === "TEST_Post edited");
  r = await call("GET", "/admin/posts/count?q=TEST_Post", { token: tokenAdmin });
  check("post count", r.status === 200 && r.json.data.count >= 1);
  r = await call("DELETE", `/admin/post/${postId}`, { token: tokenAdmin });
  check("delete post", r.status === 200);

  // ---------- Settings ----------
  r = await call("PUT", "/admin/details", { token: tokenAdmin, body: { herotitle: "TEST hero", herosubtitle: "sub", imageName: "https://example.com/h.jpg", openclubchangeperiodMonths: "3", userId: admin.id } });
  check("save settings", r.status === 200 && r.json.data.openclubchangeperiodMonths === 3, JSON.stringify(r.json));
  r = await call("GET", "/user/defaultdetails");
  check("settings readable publicly", r.json?.data?.herotitle === "TEST hero");

  // ---------- Activity log ----------
  r = await call("GET", `/admin/logs?user=${encodeURIComponent("TESTA")}`, { token: tokenAdmin });
  check("activity logs record player actions", r.status === 200 && r.json.data.length >= 3, `${r.json?.data?.length}`);
  r = await call("POST", "/auth/logout", { token: tokenA });
  check("logout recorded", r.status === 200);
}

async function cleanup() {
  const ids = created.users;
  await prisma.$transaction([
    prisma.post.deleteMany({ where: { OR: [{ id: { in: created.posts } }, { userId: { in: ids } }] } }),
    prisma.setting.deleteMany({ where: { userId: { in: ids } } }),
    prisma.payment.deleteMany({ where: { userId: { in: ids } } }),
    prisma.clubchange.deleteMany({ where: { userId: { in: ids } } }),
    prisma.activityLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { description: { contains: "test.local" } }] } }),
    prisma.player.deleteMany({ where: { userId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
    prisma.openclubs.deleteMany({ where: { id: { in: created.openclubs } } }),
    prisma.associations.deleteMany({ where: { id: { in: created.assoc } } }),
    prisma.closeclubs.deleteMany({ where: { id: { in: created.closeclubs } } }),
    prisma.schools.deleteMany({ where: { id: { in: created.schools } } }),
  ]);
}

main()
  .catch((e) => {
    fail++;
    console.error("CRASH", e);
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error("CLEANUP FAILED", e));
    console.log(`\n${pass} passed, ${fail} failed. Test data removed.`);
    await prisma.$disconnect();
  });
