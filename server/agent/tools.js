const schedules = require("../services/schedules");
const rooms = require("../services/rooms");
const events = require("../services/events");
const announcements = require("../services/announcements");
const assignments = require("../services/assignments");

// Every tool reads the LIVE database via the same services the dashboard uses,
// so any edit made in the dashboard is immediately visible to the agent.

const toolDefs = [
  {
    name: "get_current_datetime",
    description:
      "Get the current real-world date, time, and day of the week (Asia/Dhaka timezone). Always call this first if the question involves 'today', 'tomorrow', 'this week', 'next class', or any relative time.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_schedules",
    description: "List all class schedule entries. Optionally filter by day of week.",
    input_schema: {
      type: "object",
      properties: {
        day: {
          type: "string",
          enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          description: "Filter to a specific day of the week (optional).",
        },
      },
    },
  },
  {
    name: "list_rooms",
    description: "List all rooms with their capacity, equipment, floor, status, and current bookings.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_available_rooms",
    description:
      "Find rooms that are free/available given optional date, time window, minimum capacity, and required equipment. Use this before booking a room, or to answer 'is there a room free for X'.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date YYYY-MM-DD to check availability for." },
        start_time: { type: "string", description: "24h HH:MM start of the window." },
        end_time: { type: "string", description: "24h HH:MM end of the window." },
        min_capacity: { type: "number", description: "Minimum number of people the room must fit." },
        equipment: {
          type: "array",
          items: { type: "string" },
          description: "Required equipment, e.g. ['projector'].",
        },
      },
    },
  },
  {
    name: "book_room",
    description:
      "Book a room for a specific date and time window. Only call this once you have a specific room number, date, start time, and end time confirmed by the user - if any of these are missing or vague, ask the user first instead of calling this tool. This checks for conflicts automatically and will fail if the room is already booked in that window.",
    input_schema: {
      type: "object",
      properties: {
        room_number: { type: "string", description: "Room number, e.g. '7A02'." },
        date: { type: "string", description: "ISO date YYYY-MM-DD." },
        start_time: { type: "string", description: "24h HH:MM." },
        end_time: { type: "string", description: "24h HH:MM." },
        booked_by: { type: "string", description: "Name of the person booking (ask if not given)." },
        purpose: { type: "string", description: "Reason for the booking." },
      },
      required: ["room_number", "date", "start_time", "end_time", "booked_by"],
    },
  },
  {
    name: "cancel_room_booking",
    description: "Cancel an existing room booking by room number and booking id.",
    input_schema: {
      type: "object",
      properties: {
        room_number: { type: "string" },
        booking_id: { type: "string" },
      },
      required: ["room_number", "booking_id"],
    },
  },
  {
    name: "list_events",
    description: "List all campus events with date, time, venue, capacity, and current registration count/status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "register_for_event",
    description:
      "Register a student for an event by (partial) event name. Fails if the event is full, cancelled, completed, or the student is already registered.",
    input_schema: {
      type: "object",
      properties: {
        event_name: { type: "string", description: "Full or partial name of the event." },
        student_id: { type: "string", description: "Student ID. Ask the user if not provided." },
        student_name: { type: "string", description: "Student name. Ask the user if not provided." },
      },
      required: ["event_name", "student_id", "student_name"],
    },
  },
  {
    name: "cancel_event_registration",
    description: "Cancel a student's registration for an event by event name and student id.",
    input_schema: {
      type: "object",
      properties: {
        event_name: { type: "string" },
        student_id: { type: "string" },
      },
      required: ["event_name", "student_id"],
    },
  },
  {
    name: "list_announcements",
    description: "List all announcements. Optionally filter by priority level.",
    input_schema: {
      type: "object",
      properties: {
        priority: { type: "string", enum: ["high", "medium", "low"] },
      },
    },
  },
  {
    name: "list_assignments",
    description: "List all assignments with course, deadline, and status. Optionally filter by status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "submitted", "graded", "late"] },
      },
    },
  },
];

function ok(data) {
  return JSON.stringify(data);
}
function fail(error, extra = {}) {
  return JSON.stringify({ error, ...extra });
}

const executors = {
  get_current_datetime: () => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    return ok({
      day_of_week: parts.weekday,
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
      timezone: "Asia/Dhaka",
    });
  },

  list_schedules: ({ day }) => {
    const all = schedules.list();
    return ok(day ? all.filter((s) => s.day === day) : all);
  },

  list_rooms: () => ok(rooms.list()),

  search_available_rooms: (input) => ok(rooms.findAvailable(input || {})),

  book_room: ({ room_number, date, start_time, end_time, booked_by, purpose }) => {
    const room = rooms.getByRoomNumber(room_number);
    if (!room) return fail("room_not_found", { room_number });
    const result = rooms.book(room.id, { booked_by, date, start_time, end_time, purpose });
    if (result.error) return fail(result.error, { room_number, date, start_time, end_time });
    return ok({ success: true, booking: result.booking });
  },

  cancel_room_booking: ({ room_number, booking_id }) => {
    const room = rooms.getByRoomNumber(room_number);
    if (!room) return fail("room_not_found", { room_number });
    const success = rooms.cancelBooking(room.id, booking_id);
    return success ? ok({ success: true }) : fail("booking_not_found");
  },

  list_events: () => ok(events.list()),

  register_for_event: ({ event_name, student_id, student_name }) => {
    const event = events.getByName(event_name);
    if (!event) return fail("event_not_found", { event_name });
    const result = events.register(event.id, { student_id, name: student_name });
    if (result.error) return fail(result.error, { event_name: event.name });
    return ok({ success: true, event: result.event });
  },

  cancel_event_registration: ({ event_name, student_id }) => {
    const event = events.getByName(event_name);
    if (!event) return fail("event_not_found", { event_name });
    const result = events.cancelRegistration(event.id, student_id);
    if (result.error) return fail(result.error);
    return ok({ success: true, event: result.event });
  },

  list_announcements: ({ priority }) => {
    const all = announcements.list();
    return ok(priority ? all.filter((a) => a.priority === priority) : all);
  },

  list_assignments: ({ status }) => {
    const all = assignments.list();
    return ok(status ? all.filter((a) => a.status === status) : all);
  },
};

async function executeTool(name, input) {
  const fn = executors[name];
  if (!fn) return fail("unknown_tool", { name });
  try {
    return fn(input || {});
  } catch (err) {
    return fail("tool_execution_error", { message: err.message });
  }
}

module.exports = { toolDefs, executeTool };
