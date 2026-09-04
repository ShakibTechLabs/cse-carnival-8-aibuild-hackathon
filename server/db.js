const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "campusos.db");
const SEED_DIR = path.join(__dirname, "..", "data");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      course TEXT, title TEXT, day TEXT,
      start_time TEXT, end_time TEXT,
      room TEXT, instructor TEXT, section TEXT
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      room_number TEXT UNIQUE,
      type TEXT, capacity INTEGER,
      equipment TEXT, -- JSON array string
      floor INTEGER, status TEXT
    );

    CREATE TABLE IF NOT EXISTS bookings (
      booking_id TEXT PRIMARY KEY,
      room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
      booked_by TEXT, date TEXT,
      start_time TEXT, end_time TEXT, purpose TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT, description TEXT, date TEXT,
      start_time TEXT, end_time TEXT, end_date TEXT,
      venue TEXT, organizer TEXT,
      capacity INTEGER, registered INTEGER, status TEXT
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
      student_id TEXT, name TEXT
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT, body TEXT, date TEXT,
      priority TEXT, posted_by TEXT, expires TEXT
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      course TEXT, course_title TEXT, title TEXT, description TEXT,
      assigned_date TEXT, deadline TEXT,
      submission_platform TEXT, status TEXT, marks INTEGER
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get();
  if (!seeded) {
    seedFromJson();
    db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', '1')").run();
    console.log("[db] Seeded database from data/*.json");
  }
}

function readJson(file) {
  const p = path.join(SEED_DIR, file);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function seedFromJson() {
  const insertSchedule = db.prepare(`
    INSERT OR REPLACE INTO schedules (id, course, title, day, start_time, end_time, room, instructor, section)
    VALUES (@id, @course, @title, @day, @start_time, @end_time, @room, @instructor, @section)
  `);
  for (const s of readJson("schedules.json")) insertSchedule.run(s);

  const insertRoom = db.prepare(`
    INSERT OR REPLACE INTO rooms (id, room_number, type, capacity, equipment, floor, status)
    VALUES (@id, @room_number, @type, @capacity, @equipment, @floor, @status)
  `);
  const insertBooking = db.prepare(`
    INSERT OR REPLACE INTO bookings (booking_id, room_id, booked_by, date, start_time, end_time, purpose)
    VALUES (@booking_id, @room_id, @booked_by, @date, @start_time, @end_time, @purpose)
  `);
  for (const r of readJson("rooms.json")) {
    insertRoom.run({ ...r, equipment: JSON.stringify(r.equipment || []) });
    for (const b of r.bookings || []) {
      insertBooking.run({ ...b, room_id: r.id });
    }
  }

  const insertEvent = db.prepare(`
    INSERT OR REPLACE INTO events (id, name, description, date, start_time, end_time, end_date, venue, organizer, capacity, registered, status)
    VALUES (@id, @name, @description, @date, @start_time, @end_time, @end_date, @venue, @organizer, @capacity, @registered, @status)
  `);
  const insertReg = db.prepare(`
    INSERT INTO registrations (event_id, student_id, name) VALUES (@event_id, @student_id, @name)
  `);
  for (const e of readJson("events.json")) {
    insertEvent.run(e);
    for (const reg of e.registrations || []) {
      insertReg.run({ ...reg, event_id: e.id });
    }
  }

  const insertAnn = db.prepare(`
    INSERT OR REPLACE INTO announcements (id, title, body, date, priority, posted_by, expires)
    VALUES (@id, @title, @body, @date, @priority, @posted_by, @expires)
  `);
  for (const a of readJson("announcements.json")) insertAnn.run(a);

  const insertAsg = db.prepare(`
    INSERT OR REPLACE INTO assignments (id, course, course_title, title, description, assigned_date, deadline, submission_platform, status, marks)
    VALUES (@id, @course, @course_title, @title, @description, @assigned_date, @deadline, @submission_platform, @status, @marks)
  `);
  for (const a of readJson("assignments.json")) insertAsg.run(a);
}

module.exports = { db, init };
