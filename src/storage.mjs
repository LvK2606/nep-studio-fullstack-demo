// Local SQLite remains for development; Render can use persistent Neon Postgres.
import * as sqlite from './db.mjs';
import * as postgres from './postgres.mjs';

export const TIME_SLOTS = sqlite.TIME_SLOTS;
export const STATUSES = sqlite.STATUSES;
const isPg = db => db?.kind === 'postgres';

export async function openDatabase() {
  if (process.env.DATABASE_URL) return postgres.openPostgresDatabase(process.env.DATABASE_URL);
  if (process.env.REQUIRE_PERSISTENT_DB === 'true') {
    throw new Error('Thiếu DATABASE_URL: từ chối chạy với SQLite tạm thời khi REQUIRE_PERSISTENT_DB=true.');
  }
  return sqlite.openDatabase();
}
export async function listServices(db) {
  return isPg(db) ? postgres.listServicesPg(db) : sqlite.listServices(db);
}
export async function serviceExists(db, id) {
  return isPg(db) ? postgres.serviceExistsPg(db, id) : !!db.prepare('SELECT id FROM services WHERE id=?').get(id);
}
export async function bookedSlots(db, date) {
  return isPg(db) ? postgres.bookedSlotsPg(db, date) : sqlite.bookedSlots(db, date);
}
export async function createBooking(db, data) {
  return isPg(db) ? postgres.createBookingPg(db, data) : sqlite.createBooking(db, data);
}
export async function listBookings(db) {
  return isPg(db) ? postgres.listBookingsPg(db) : sqlite.listBookings(db);
}
export async function getBooking(db, id) {
  return isPg(db) ? postgres.getBookingPg(db, id) : sqlite.getBooking(db, id);
}
export async function changeBookingStatus(db, id, status, expected) {
  if (isPg(db)) return postgres.changeBookingStatusPg(db, id, status, expected);
  return db.prepare('UPDATE bookings SET status=? WHERE id=? AND status=?').run(status, id, expected).changes > 0;
}
