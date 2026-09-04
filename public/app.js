const API = "/api";

const state = {
  view: "schedules",
  data: { schedules: [], rooms: [], events: [], announcements: [], assignments: [] },
  chatHistory: [],
};

const VIEW_META = {
  schedules: { title: "Class Schedule", subtitle: "Every class, section, room, and instructor — live from the backend." },
  rooms: { title: "Rooms", subtitle: "Capacity, equipment, and live bookings for every room on campus." },
  events: { title: "Campus Events", subtitle: "What's happening, and who's registered." },
  announcements: { title: "Announcements", subtitle: "Notices from departments, sorted by most recent." },
  assignments: { title: "Assignments", subtitle: "Deadlines and submission status across all courses." },
};

// ---------------- API helpers ----------------
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.body = body;
    throw err;
  }
  return body;
}

// ---------------- Load all data ----------------
async function loadAll() {
  const [schedules, rooms, events, announcements, assignments] = await Promise.all([
    api("/schedules"),
    api("/rooms"),
    api("/events"),
    api("/announcements"),
    api("/assignments"),
  ]);
  state.data = { schedules, rooms, events, announcements, assignments };
  document.getElementById("count-schedules").textContent = schedules.length;
  document.getElementById("count-rooms").textContent = rooms.length;
  document.getElementById("count-events").textContent = events.length;
  document.getElementById("count-announcements").textContent = announcements.length;
  document.getElementById("count-assignments").textContent = assignments.length;
  renderView();
}

const DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------------- Renderers ----------------
function renderView() {
  const container = document.getElementById(`view-${state.view}`);
  const renderer = { schedules: renderSchedules, rooms: renderRooms, events: renderEvents, announcements: renderAnnouncements, assignments: renderAssignments }[state.view];
  container.innerHTML = renderer();
  attachActionHandlers(container);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderSchedules() {
  const items = [...state.data.schedules].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.start_time.localeCompare(b.start_time));
  if (!items.length) return emptyState("No classes scheduled yet.");
  return `<div class="card-grid">${items.map((s) => `
    <div class="card" data-id="${s.id}">
      <h3>${esc(s.course)} <span style="font-weight:400;color:var(--muted);font-size:12.5px;">· Sec ${esc(s.section)}</span></h3>
      <div class="meta">
        ${esc(s.title)}<br/>
        ${esc(s.day)} · ${esc(s.start_time)}–${esc(s.end_time)}<br/>
        Room ${esc(s.room)} · ${esc(s.instructor)}
      </div>
      <div class="actions">
        <button class="btn btn-ghost btn-small act-edit">Edit</button>
        <button class="btn btn-danger btn-small act-delete">Delete</button>
      </div>
    </div>`).join("")}</div>`;
}

function renderRooms() {
  const items = [...state.data.rooms].sort((a, b) => a.room_number.localeCompare(b.room_number));
  if (!items.length) return emptyState("No rooms yet.");
  return `<div class="card-grid">${items.map((r) => `
    <div class="card" data-id="${r.id}">
      <h3>${esc(r.room_number)} <span class="tag tag-${r.status}">${esc(r.status)}</span></h3>
      <div class="meta">
        ${esc(r.type)} · Floor ${esc(r.floor)} · Capacity ${esc(r.capacity)}<br/>
        ${(r.equipment || []).map(esc).join(", ") || "No equipment listed"}
      </div>
      ${r.bookings.length ? `<div style="margin-top:8px;">${r.bookings.map((b) => `
        <div class="booking-row">
          <span>${esc(b.date)} ${esc(b.start_time)}–${esc(b.end_time)} · ${esc(b.booked_by)}</span>
          <span class="act-cancel-booking" data-booking="${esc(b.booking_id)}" style="cursor:pointer;color:var(--red);">✕</span>
        </div>`).join("")}</div>` : `<div class="meta" style="margin-top:8px;font-style:italic;">No bookings</div>`}
      <div class="actions">
        <button class="btn btn-ghost btn-small act-book">Book</button>
        <button class="btn btn-ghost btn-small act-edit">Edit</button>
        <button class="btn btn-danger btn-small act-delete">Delete</button>
      </div>
    </div>`).join("")}</div>`;
}

function renderEvents() {
  const items = [...state.data.events].sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return emptyState("No events yet.");
  return `<div class="card-grid">${items.map((e) => `
    <div class="card" data-id="${e.id}">
      <h3>${esc(e.name)} <span class="tag tag-${e.status}">${esc(e.status)}</span></h3>
      <div class="meta">
        ${esc(e.date)} · ${esc(e.start_time)}–${esc(e.end_time)} · ${esc(e.venue)}<br/>
        ${esc(e.organizer)} · ${e.registered}/${e.capacity} registered
      </div>
      <div class="actions">
        <button class="btn btn-ghost btn-small act-register">Register</button>
        <button class="btn btn-ghost btn-small act-edit">Edit</button>
        <button class="btn btn-danger btn-small act-delete">Delete</button>
      </div>
    </div>`).join("")}</div>`;
}

function renderAnnouncements() {
  const items = [...state.data.announcements].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) return emptyState("No announcements yet.");
  return `<div class="card-grid">${items.map((a) => `
    <div class="card" data-id="${a.id}">
      <h3>${esc(a.title)} <span class="tag tag-${a.priority}">${esc(a.priority)}</span></h3>
      <div class="meta">${esc(a.body)}</div>
      <div class="meta" style="margin-top:8px;">Posted ${esc(a.date)} by ${esc(a.posted_by)} · Expires ${esc(a.expires)}</div>
      <div class="actions">
        <button class="btn btn-ghost btn-small act-edit">Edit</button>
        <button class="btn btn-danger btn-small act-delete">Delete</button>
      </div>
    </div>`).join("")}</div>`;
}

function renderAssignments() {
  const items = [...state.data.assignments].sort((a, b) => a.deadline.localeCompare(b.deadline));
  if (!items.length) return emptyState("No assignments yet.");
  return `<div class="card-grid">${items.map((a) => `
    <div class="card" data-id="${a.id}">
      <h3>${esc(a.title)} <span class="tag tag-${a.status}">${esc(a.status)}</span></h3>
      <div class="meta">
        ${esc(a.course)} · ${esc(a.course_title)}<br/>
        Deadline ${esc(a.deadline)} · ${esc(a.marks)} marks · ${esc(a.submission_platform)}
      </div>
      <div class="actions">
        <button class="btn btn-ghost btn-small act-edit">Edit</button>
        <button class="btn btn-danger btn-small act-delete">Delete</button>
      </div>
    </div>`).join("")}</div>`;
}

function emptyState(msg) {
  return `<div class="empty-state">${esc(msg)}</div>`;
}

// ---------------- Nav ----------------
document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    el.classList.add("active");
    state.view = el.dataset.view;
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById(`view-${state.view}`).classList.remove("hidden");
    document.getElementById("view-title").textContent = VIEW_META[state.view].title;
    document.getElementById("view-subtitle").textContent = VIEW_META[state.view].subtitle;
    renderView();
  });
});

// ---------------- Action buttons on cards ----------------
function attachActionHandlers(container) {
  container.querySelectorAll(".card").forEach((card) => {
    const id = card.dataset.id;
    const item = state.data[state.view].find((x) => x.id === id);
    card.querySelector(".act-edit")?.addEventListener("click", () => openFormModal(state.view, item));
    card.querySelector(".act-delete")?.addEventListener("click", () => deleteItem(state.view, item));
    card.querySelector(".act-book")?.addEventListener("click", () => openBookModal(item));
    card.querySelector(".act-register")?.addEventListener("click", () => openRegisterModal(item));
    card.querySelectorAll(".act-cancel-booking").forEach((el) => {
      el.addEventListener("click", async () => {
        if (!confirm("Cancel this booking?")) return;
        await api(`/rooms/${id}/bookings/${el.dataset.booking}`, { method: "DELETE" });
        await loadAll();
      });
    });
  });
}

async function deleteItem(view, item) {
  const label = item.title || item.name || item.course || item.room_number || "this item";
  if (!confirm(`Delete ${label}? This can't be undone.`)) return;
  await api(`/${view}/${item.id}`, { method: "DELETE" });
  await loadAll();
}

// ---------------- Add button ----------------
document.getElementById("add-btn").addEventListener("click", () => openFormModal(state.view, null));

// ---------------- Modal ----------------
const backdrop = document.getElementById("modal-backdrop");
const modalContent = document.getElementById("modal-content");
function closeModal() { backdrop.classList.add("hidden"); modalContent.innerHTML = ""; }
backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

const FIELD_DEFS = {
  schedules: [
    ["course", "Course code", "text"], ["title", "Course title", "text"],
    ["day", "Day", "select", DAY_ORDER.slice(0, 5)],
    ["start_time", "Start time", "time"], ["end_time", "End time", "time"],
    ["room", "Room", "text"], ["instructor", "Instructor", "text"], ["section", "Section", "text"],
  ],
  rooms: [
    ["room_number", "Room number", "text"],
    ["type", "Type", "select", ["classroom", "lab", "seminar"]],
    ["capacity", "Capacity", "number"],
    ["equipment", "Equipment (comma separated)", "text"],
    ["floor", "Floor", "number"],
    ["status", "Status", "select", ["available", "unavailable"]],
  ],
  events: [
    ["name", "Event name", "text"], ["description", "Description", "textarea"],
    ["date", "Date", "date"], ["end_date", "End date", "date"],
    ["start_time", "Start time", "time"], ["end_time", "End time", "time"],
    ["venue", "Venue", "text"], ["organizer", "Organizer", "text"],
    ["capacity", "Capacity", "number"],
    ["status", "Status", "select", ["upcoming", "ongoing", "completed", "cancelled", "full"]],
  ],
  announcements: [
    ["title", "Title", "text"], ["body", "Body", "textarea"],
    ["date", "Date", "date"], ["priority", "Priority", "select", ["high", "medium", "low"]],
    ["posted_by", "Posted by", "text"], ["expires", "Expires", "date"],
  ],
  assignments: [
    ["course", "Course code", "text"], ["course_title", "Course title", "text"],
    ["title", "Assignment title", "text"], ["description", "Description", "textarea"],
    ["assigned_date", "Assigned date", "date"], ["deadline", "Deadline", "date"],
    ["submission_platform", "Submission platform", "text"],
    ["status", "Status", "select", ["pending", "submitted", "graded", "late"]],
    ["marks", "Marks", "number"],
  ],
};

function fieldHtml([key, label, type, options], value) {
  const v = value ?? "";
  if (type === "select") {
    return `<div class="form-row"><label>${label}</label><select name="${key}">${options.map((o) => `<option value="${o}" ${v === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
  }
  if (type === "textarea") {
    return `<div class="form-row"><label>${label}</label><textarea name="${key}">${esc(v)}</textarea></div>`;
  }
  return `<div class="form-row"><label>${label}</label><input type="${type}" name="${key}" value="${esc(v)}" /></div>`;
}

function openFormModal(view, item) {
  const isEdit = !!item;
  const fields = FIELD_DEFS[view];
  const label = { schedules: "Class", rooms: "Room", events: "Event", announcements: "Announcement", assignments: "Assignment" }[view];
  modalContent.innerHTML = `
    <h2>${isEdit ? "Edit" : "Add"} ${label}</h2>
    <form id="entity-form">
      ${fields.map(([key, l, type, options]) => fieldHtml([key, l, type, options], item ? (key === "equipment" ? (item.equipment || []).join(", ") : item[key]) : "")).join("")}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? "Save changes" : "Add"}</button>
      </div>
    </form>`;
  backdrop.classList.remove("hidden");
  document.getElementById("cancel-btn").addEventListener("click", closeModal);
  document.getElementById("entity-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {};
    for (const [key, , type] of fields) {
      let val = fd.get(key);
      if (type === "number") val = val === "" ? 0 : Number(val);
      if (key === "equipment") val = val.split(",").map((s) => s.trim()).filter(Boolean);
      payload[key] = val;
    }
    if (isEdit) {
      await api(`/${view}/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api(`/${view}`, { method: "POST", body: JSON.stringify(payload) });
    }
    closeModal();
    await loadAll();
  });
}

function openBookModal(room) {
  modalContent.innerHTML = `
    <h2>Book ${esc(room.room_number)}</h2>
    <form id="book-form">
      <div class="form-row"><label>Booked by</label><input type="text" name="booked_by" required /></div>
      <div class="form-row"><label>Date</label><input type="date" name="date" required /></div>
      <div class="form-grid">
        <div class="form-row"><label>Start time</label><input type="time" name="start_time" required /></div>
        <div class="form-row"><label>End time</label><input type="time" name="end_time" required /></div>
      </div>
      <div class="form-row"><label>Purpose</label><input type="text" name="purpose" /></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Book room</button>
      </div>
    </form>`;
  backdrop.classList.remove("hidden");
  document.getElementById("cancel-btn").addEventListener("click", closeModal);
  document.getElementById("book-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api(`/rooms/${room.id}/book`, { method: "POST", body: JSON.stringify(payload) });
      closeModal();
      await loadAll();
    } catch (err) {
      alert(err.body?.error === "conflict" ? "That room is already booked in that window." : "Could not book room: " + err.message);
    }
  });
}

function openRegisterModal(event) {
  modalContent.innerHTML = `
    <h2>Register for ${esc(event.name)}</h2>
    <form id="register-form">
      <div class="form-row"><label>Student ID</label><input type="text" name="student_id" required /></div>
      <div class="form-row"><label>Name</label><input type="text" name="name" required /></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-primary">Register</button>
      </div>
    </form>`;
  backdrop.classList.remove("hidden");
  document.getElementById("cancel-btn").addEventListener("click", closeModal);
  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api(`/events/${event.id}/register`, { method: "POST", body: JSON.stringify(payload) });
      closeModal();
      await loadAll();
    } catch (err) {
      alert("Could not register: " + (err.body?.error || err.message));
    }
  });
}

// ---------------- Chat ----------------
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");

function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg msg-${role}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

async function sendChat(text) {
  if (!text.trim()) return;
  addMsg("user", text);
  chatInput.value = "";
  const typing = addMsg("typing", "Thinking...");
  typing.classList.add("msg-typing");
  try {
    const res = await api("/chat", { method: "POST", body: JSON.stringify({ message: text, history: state.chatHistory }) });
    typing.remove();
    addMsg("agent", res.reply || "(no response)");
    state.chatHistory = res.history || state.chatHistory;
    // Refresh dashboard in case the agent changed data
    if (res.toolCalls && res.toolCalls.length) await loadAll();
  } catch (err) {
    typing.remove();
    addMsg("error", "Agent error: " + (err.body?.detail || err.message));
  }
}

document.getElementById("chat-send").addEventListener("click", () => sendChat(chatInput.value));
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(chatInput.value); });
document.querySelectorAll(".suggestion-chip").forEach((chip) => {
  chip.addEventListener("click", () => sendChat(chip.textContent));
});

// ---------------- Init ----------------
loadAll().catch((err) => {
  console.error(err);
  alert("Could not load data from the backend. Is the server running?");
});
