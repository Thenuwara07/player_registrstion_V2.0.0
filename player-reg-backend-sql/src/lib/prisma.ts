// Single shared Prisma client for the whole app.
// Avoids each controller opening its own connection pool.
import { PrismaClient } from "@prisma/client";

// Password hashes are never returned by default, so no query can leak them
// to a client by accident. Sign-in opts back in with `omit: { password: false }`.
const prisma = new PrismaClient({
  omit: { user: { password: true } },
});

export default prisma;
