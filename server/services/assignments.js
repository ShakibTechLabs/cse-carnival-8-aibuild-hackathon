const { db } = require("../db");
const { v4: uuidv4 } = require("uuid");

function list() {
  return db.prepare("SELECT * FROM assignments ORDER BY deadline").all();
}

function get(id) {
  return db.prepare("SELECT * FROM assignments WHERE id = ?").get(id);
}

function create(data) {
  const id = data.id || `asgn-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO assignments (id, course, course_title, title, description, assigned_date, deadline, submission_platform, status, marks)
    VALUES (@id, @course, @course_title, @title, @description, @assigned_date, @deadline, @submission_platform, @status, @marks)
  `).run({
    id,
    course: data.course || "",
    course_title: data.course_title || "",
    title: data.title || "",
    description: data.description || "",
    assigned_date: data.assigned_date || new Date().toISOString().slice(0, 10),
    deadline: data.deadline || "",
    submission_platform: data.submission_platform || "",
    status: data.status || "pending",
    marks: data.marks || 0,
  });
  return get(id);
}

function update(id, data) {
  const existing = get(id);
  if (!existing) return null;
  const merged = { ...existing, ...data, id };
  db.prepare(`
    UPDATE assignments SET course=@course, course_title=@course_title, title=@title,
      description=@description, assigned_date=@assigned_date, deadline=@deadline,
      submission_platform=@submission_platform, status=@status, marks=@marks
    WHERE id=@id
  `).run(merged);
  return get(id);
}

function remove(id) {
  const info = db.prepare("DELETE FROM assignments WHERE id = ?").run(id);
  return info.changes > 0;
}

module.exports = { list, get, create, update, remove };
