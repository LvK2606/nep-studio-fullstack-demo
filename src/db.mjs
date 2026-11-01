import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const TIME_SLOTS = ['09:00', '10:30', '13:30', '15:00', '16:30'];
export const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

const SEED_SERVICES = [
  { id: 'goi-duong', name: 'Gội dưỡng thư giãn', duration: 45, price: 250000, description: 'Làm sạch dịu nhẹ, massage thư giãn và chăm sóc tóc cơ bản.', icon: 'sparkle' },
  { id: 'da-dau', name: 'Chăm sóc da đầu', duration: 60, price: 390000, description: 'Quy trình chăm sóc da đầu và thư giãn chuyên sâu.', icon: 'leaf' },
  { id: 'phuc-hoi', name: 'Phục hồi tóc', duration: 90, price: 650000, description: 'Chăm sóc và bổ sung dưỡng chất dành cho tóc cần phục hồi.', icon: 'flower' }
];

export function openDatabase(file = process.env.DB_PATH || 'data/bookings.sqlite') {
  const filepath = file === ':memory:' ? file : resolve(file);
  if (filepath !== ':memory:') mkdirSync(dirname(filepath), { recursive: true });
  const db = new DatabaseSync(filepath);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      price INTEGER NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL REFERENCES services(id),
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_slot ON bookings(booking_date, booking_time)
      WHERE status != 'cancelled';
    CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
  `);
  const seed = db.prepare('INSERT OR IGNORE INTO services (id,name,duration,price,description,icon) VALUES (?,?,?,?,?,?)');
  for (const service of SEED_SERVICES) {
    seed.run(service.id, service.name, service.duration, service.price, service.description, service.icon);
  }
  return db;
}

export function listServices(db) {
  return db.prepare('SELECT id,name,duration,price,description,icon FROM services ORDER BY price ASC').all();
}

export function bookedSlots(db, date) {
  return db.prepare("SELECT booking_time FROM bookings WHERE booking_date=? AND status!='cancelled'")
    .all(date).map(row => row.booking_time);
}

export function createBooking(db, data) {
  const result = db.prepare(`INSERT INTO bookings
    (service_id,customer_name,phone,booking_date,booking_time,note)
    VALUES (?,?,?,?,?,?)`).run(data.serviceId, data.name, data.phone, data.date, data.time, data.note);
  return Number(result.lastInsertRowid);
}

export function listBookings(db) {
  return db.prepare(`SELECT b.id,b.customer_name AS name,b.phone,b.booking_date AS date,
    b.booking_time AS time,b.note,b.status,b.created_at AS createdAt,
    s.name AS serviceName, s.price AS price
    FROM bookings b JOIN services s ON s.id=b.service_id
    ORDER BY b.booking_date DESC,b.booking_time DESC,b.id DESC`).all();
}

export function getBooking(db, id) {
  return db.prepare('SELECT id,status,booking_date,booking_time FROM bookings WHERE id=?').get(id);
}

export function changeBookingStatus(db, id, status) {
  return db.prepare('UPDATE bookings SET status=? WHERE id=?').run(status, id);
}
