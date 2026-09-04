const { db } = require("../db");
const { v4: uuidv4 } = require("uuid");

function attachBookings(room) {
  if (!room) return room;
  const bookings = db
    .prepare("SELECT booking_id, booked_by, date, start_time, end_time, purpose FROM bookings WHERE room_id = ? ORDER BY date, start_time")
    .all(room.id);
  return { ...room, equipment: JSON.parse(room.equipment || "[]"), bookings };
}

function list() {
  const rooms = db.prepare("SELECT * FROM rooms ORDER BY room_number").all();
  return rooms.map(attachBookings);
}

function get(id) {
  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
  return attachBookings(room);
}

function getByRoomNumber(roomNumber) {
  const room = db.prepare("SELECT * FROM rooms WHERE room_number = ?").get(roomNumber);
  return attachBookings(room);
}

function create(data) {
  const id = data.id || `room-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO rooms (id, room_number, type, capacity, equipment, floor, status)
    VALUES (@id, @room_number, @type, @capacity, @equipment, @floor, @status)
  `).run({
    id,
    room_number: data.room_number || "",
    type: data.type || "classroom",
    capacity: data.capacity || 0,
    equipment: JSON.stringify(data.equipment || []),
    floor: data.floor || 0,
    status: data.status || "available",
  });
  return get(id);
}

function update(id, data) {
  const existing = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
  if (!existing) return null;
  const merged = {
    ...existing,
    ...data,
    id,
    equipment: JSON.stringify(data.equipment !== undefined ? data.equipment : JSON.parse(existing.equipment || "[]")),
  };
  db.prepare(`
    UPDATE rooms SET room_number=@room_number, type=@type, capacity=@capacity,
      equipment=@equipment, floor=@floor, status=@status
    WHERE id=@id
  `).run(merged);
  return get(id);
}

function remove(id) {
  const info = db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  return info.changes > 0;
}

function timesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isRoomFree(roomId, date, startTime, endTime, excludeBookingId = null) {
  const bookings = db.prepare("SELECT * FROM bookings WHERE room_id = ? AND date = ?").all(roomId, date);
  return !bookings.some(
    (b) => b.booking_id !== excludeBookingId && timesOverlap(startTime, endTime, b.start_time, b.end_time)
  );
}

function book(roomId, { booked_by, date, start_time, end_time, purpose }) {
  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId);
  if (!room) return { error: "room_not_found" };
  if (room.status === "unavailable") return { error: "room_unavailable" };
  if (!isRoomFree(roomId, date, start_time, end_time)) {
    return { error: "conflict" };
  }
  const booking_id = `bk-${uuidv4().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO bookings (booking_id, room_id, booked_by, date, start_time, end_time, purpose)
    VALUES (@booking_id, @room_id, @booked_by, @date, @start_time, @end_time, @purpose)
  `).run({ booking_id, room_id: roomId, booked_by: booked_by || "Unknown", date, start_time, end_time, purpose: purpose || "" });
  return { booking: db.prepare("SELECT * FROM bookings WHERE booking_id = ?").get(booking_id) };
}

function cancelBooking(roomId, bookingId) {
  const info = db.prepare("DELETE FROM bookings WHERE booking_id = ? AND room_id = ?").run(bookingId, roomId);
  return info.changes > 0;
}

function findAvailable({ date, start_time, end_time, min_capacity, equipment }) {
  const rooms = list();
  return rooms.filter((r) => {
    if (r.status === "unavailable") return false;
    if (min_capacity && r.capacity < min_capacity) return false;
    if (equipment && equipment.length) {
      const hasAll = equipment.every((eq) => r.equipment.some((e) => e.toLowerCase().includes(eq.toLowerCase())));
      if (!hasAll) return false;
    }
    if (date && start_time && end_time) {
      const free = isRoomFree(r.id, date, start_time, end_time);
      if (!free) return false;
    }
    return true;
  });
}

module.exports = {
  list,
  get,
  getByRoomNumber,
  create,
  update,
  remove,
  book,
  cancelBooking,
  findAvailable,
  isRoomFree,
};
