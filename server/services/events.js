const { db } = require("../db");
const { v4: uuidv4 } = require("uuid");

function attachRegs(event) {
  if (!event) return event;
  const registrations = db
    .prepare("SELECT student_id, name FROM registrations WHERE event_id = ?")
    .all(event.id);
  return { ...event, registrations };
}

function list() {
  const events = db.prepare("SELECT * FROM events ORDER BY date, start_time").all();
  return events.map(attachRegs);
}

function get(id) {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  return attachRegs(event);
}

function getByName(name) {
  const event = db
    .prepare("SELECT * FROM events WHERE lower(name) LIKE ?")
    .get(`%${name.toLowerCase()}%`);
  return attachRegs(event);
}

function create(data) {
  const id = data.id || `evt-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO events (id, name, description, date, start_time, end_time, end_date, venue, organizer, capacity, registered, status)
    VALUES (@id, @name, @description, @date, @start_time, @end_time, @end_date, @venue, @organizer, @capacity, @registered, @status)
  `).run({
    id,
    name: data.name || "",
    description: data.description || "",
    date: data.date || "",
    start_time: data.start_time || "",
    end_time: data.end_time || "",
    end_date: data.end_date || data.date || "",
    venue: data.venue || "",
    organizer: data.organizer || "",
    capacity: data.capacity || 0,
    registered: 0,
    status: data.status || "upcoming",
  });
  return get(id);
}

function update(id, data) {
  const existing = db.prepare("SELECT * FROM events WHERE id = ?").get(id);
  if (!existing) return null;
  const merged = { ...existing, ...data, id };
  db.prepare(`
    UPDATE events SET name=@name, description=@description, date=@date, start_time=@start_time,
      end_time=@end_time, end_date=@end_date, venue=@venue, organizer=@organizer,
      capacity=@capacity, registered=@registered, status=@status
    WHERE id=@id
  `).run(merged);
  return get(id);
}

function remove(id) {
  const info = db.prepare("DELETE FROM events WHERE id = ?").run(id);
  return info.changes > 0;
}

function register(eventId, { student_id, name }) {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
  if (!event) return { error: "event_not_found" };
  if (event.status === "cancelled" || event.status === "completed") {
    return { error: "event_closed" };
  }
  if (event.registered >= event.capacity) {
    db.prepare("UPDATE events SET status = 'full' WHERE id = ?").run(eventId);
    return { error: "full" };
  }
  const already = db
    .prepare("SELECT * FROM registrations WHERE event_id = ? AND student_id = ?")
    .get(eventId, student_id);
  if (already) return { error: "already_registered" };

  db.prepare("INSERT INTO registrations (event_id, student_id, name) VALUES (?, ?, ?)").run(
    eventId,
    student_id,
    name
  );
  const newCount = event.registered + 1;
  const newStatus = newCount >= event.capacity ? "full" : event.status;
  db.prepare("UPDATE events SET registered = ?, status = ? WHERE id = ?").run(newCount, newStatus, eventId);
  return { event: get(eventId) };
}

function cancelRegistration(eventId, studentId) {
  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId);
  if (!event) return { error: "event_not_found" };
  const info = db
    .prepare("DELETE FROM registrations WHERE event_id = ? AND student_id = ?")
    .run(eventId, studentId);
  if (info.changes === 0) return { error: "not_registered" };
  const newCount = Math.max(0, event.registered - 1);
  const newStatus = event.status === "full" && newCount < event.capacity ? "upcoming" : event.status;
  db.prepare("UPDATE events SET registered = ?, status = ? WHERE id = ?").run(newCount, newStatus, eventId);
  return { event: get(eventId) };
}

module.exports = { list, get, getByName, create, update, remove, register, cancelRegistration };
