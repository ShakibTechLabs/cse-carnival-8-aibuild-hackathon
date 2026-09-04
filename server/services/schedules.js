const { db } = require("../db");
const { v4: uuidv4 } = require("uuid");

function list() {
  return db.prepare("SELECT * FROM schedules ORDER BY day, start_time").all();
}

function get(id) {
  return db.prepare("SELECT * FROM schedules WHERE id = ?").get(id);
}

function create(data) {
  const id = data.id || `sch-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO schedules (id, course, title, day, start_time, end_time, room, instructor, section)
    VALUES (@id, @course, @title, @day, @start_time, @end_time, @room, @instructor, @section)
  `).run({
    id,
    course: data.course || "",
    title: data.title || "",
    day: data.day || "",
    start_time: data.start_time || "",
    end_time: data.end_time || "",
    room: data.room || "",
    instructor: data.instructor || "TBA",
    section: data.section || "",
  });
  return get(id);
}

function update(id, data) {
  const existing = get(id);
  if (!existing) return null;
  const merged = { ...existing, ...data, id };
  db.prepare(`
    UPDATE schedules SET course=@course, title=@title, day=@day, start_time=@start_time,
      end_time=@end_time, room=@room, instructor=@instructor, section=@section
    WHERE id=@id
  `).run(merged);
  return get(id);
}

function remove(id) {
  const info = db.prepare("DELETE FROM schedules WHERE id = ?").run(id);
  return info.changes > 0;
}

module.exports = { list, get, create, update, remove };
