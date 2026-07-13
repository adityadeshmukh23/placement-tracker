import { db, addTenant } from "./db";

/**
 * Seeds a handful of realistic shops/tenants the first time the DB is empty.
 * Runs the empty-check and all inserts inside one transaction so concurrent
 * callers (e.g. React Strict Mode's double effect invocation in dev) can't
 * race past the count check and double-seed.
 */
export async function seedIfEmpty(): Promise<void> {
  return db.transaction("rw", db.shops, db.tenants, async () => {
    const count = await db.shops.count();
    if (count > 0) return;
    await seed();
  });
}

async function seed(): Promise<void> {
  const shreeTraders = await db.shops.add({
    name: "Shree Traders",
    area: "MG Road",
    address: "Shop 4, MG Road",
    monthlyRent: 8000,
    createdAt: new Date(),
  });
  const anandStores = await db.shops.add({
    name: "Anand Stores",
    area: "MG Road",
    monthlyRent: 6000,
    createdAt: new Date(),
  });
  const ganeshMedical = await db.shops.add({
    name: "Ganesh Medical",
    area: "Station Road",
    address: "Near Station Road bridge",
    monthlyRent: 12000,
    createdAt: new Date(),
  });
  await db.shops.add({
    name: "Laxmi Textiles",
    area: "Station Road",
    monthlyRent: 9500,
    createdAt: new Date(),
  });

  await addTenant({
    shopId: shreeTraders,
    name: "Ramesh Kumar",
    phone: "9876543210",
    type: "regular",
    createdAt: new Date(),
  });
  await addTenant({
    shopId: anandStores,
    name: "Suresh Family",
    phone: "9823456789",
    type: "family",
    createdAt: new Date(),
  });
  await addTenant({
    shopId: ganeshMedical,
    name: "Dr. Patil",
    phone: "9812345678",
    type: "regular",
    createdAt: new Date(),
  });
  // Laxmi Textiles is left intentionally vacant to exercise the vacancy path.
}
