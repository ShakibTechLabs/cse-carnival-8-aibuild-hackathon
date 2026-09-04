const { db } = require("../db");
const { v4: uuidv4 } = require("uuid");

function list() {
  return db.prepare("SELECT * FROM announcements ORDER BY date DESC").all();
}

function get(id) {
  return db.prepare("SELECT * FROM announcements WHERE id = ?").get(id);
}

function create(data) {
  const id = data.id || `ann-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO announcements (id, title, body, date, priority, posted_by, expires)
    VALUES (@id, @title, @body, @date, @priority, @posted_by, @expires)
  `).run({
    id,
    title: data.title || "",
    body: data.body || "",
    date: data.date || new Date().toISOString().slice(0, 10),
    priority: data.priority || "medium",
    posted_by: data.posted_by || "Admin",
    expires: data.expires || "",
  });
  return get(id);
}

function update(id, data) {
  const existing = get(id);
  if (!existing) return null;
  const merged = { ...existing, ...data, id };
  db.prepare(`
    UPDATE announcements SET title=@title, body=@body, date=@date, priority=@priority,
      posted_by=@posted_by, expires=@expires
    WHERE id=@id
  `).run(merged);
  return get(id);
}

function remove(id) {
  const info = db.prepare("DELETE FROM announcements WHERE id = ?").run(id);
  return info.changes > 0;
}

module.exports = { list, get, create, update, remove };
