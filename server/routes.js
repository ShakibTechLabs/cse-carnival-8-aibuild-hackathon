const express = require("express");
const schedules = require("./services/schedules");
const rooms = require("./services/rooms");
const events = require("./services/events");
const announcements = require("./services/announcements");
const assignments = require("./services/assignments");
const { handleChat } = require("./agent/chat");

const router = express.Router();

function crud(name, service) {
  router.get(`/${name}`, (req, res) => res.json(service.list()));
  router.get(`/${name}/:id`, (req, res) => {
    const item = service.get(req.params.id);
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json(item);
  });
  router.post(`/${name}`, (req, res) => res.status(201).json(service.create(req.body)));
  router.put(`/${name}/:id`, (req, res) => {
    const updated = service.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "not_found" });
    res.json(updated);
  });
  router.delete(`/${name}/:id`, (req, res) => {
    const ok = service.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: "not_found" });
    res.json({ success: true });
  });
}

crud("schedules", schedules);
crud("rooms", rooms);
crud("events", events);
crud("announcements", announcements);
crud("assignments", assignments);

// --- Room booking actions ---
router.post("/rooms/:id/book", (req, res) => {
  const result = rooms.book(req.params.id, req.body);
  if (result.error) return res.status(409).json(result);
  res.status(201).json(result.booking);
});

router.delete("/rooms/:id/bookings/:bookingId", (req, res) => {
  const ok = rooms.cancelBooking(req.params.id, req.params.bookingId);
  if (!ok) return res.status(404).json({ error: "not_found" });
  res.json({ success: true });
});

router.post("/rooms/search", (req, res) => {
  res.json(rooms.findAvailable(req.body));
});

// --- Event registration actions ---
router.post("/events/:id/register", (req, res) => {
  const result = events.register(req.params.id, req.body);
  if (result.error) return res.status(409).json(result);
  res.status(201).json(result.event);
});

router.delete("/events/:id/registrations/:studentId", (req, res) => {
  const result = events.cancelRegistration(req.params.id, req.params.studentId);
  if (result.error) return res.status(404).json(result);
  res.json(result.event);
});

// --- AI Agent chat endpoint ---
router.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }
    const result = await handleChat(message, history || []);
    res.json(result);
  } catch (err) {
    console.error("[chat] error:", err);
    res.status(500).json({ error: "agent_error", detail: err.message });
  }
});

module.exports = router;
