const { toolDefs, executeTool } = require("./tools");

// Groq offers a free API tier (no credit card required) with fast inference
// and native OpenAI-style tool/function calling. Get a key at https://console.groq.com/keys
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `You are the CampusOS AI Agent, a helpful senior-student assistant for a university campus (schedules, rooms, events, announcements, assignments).

Rules:
1. Never guess data - always call a tool before answering a factual question. Data can change anytime, so never rely on memory from earlier in this conversation.
2. For "today"/"tomorrow"/"this week"/"next class" etc, call get_current_datetime first. Campus week is Sunday-Thursday.
3. Before booking a room or registering for an event, you need a specific room/event, date, and start+end time (and who it's for). If any of that is missing or vague, ask - don't call the booking tool yet.
4. On a booking conflict, say so plainly and suggest alternatives (search_available_rooms can help).
5. Politely refuse and explain if asked to do something outside campus schedules/rooms/events/announcements/assignments, or something that shouldn't be allowed (e.g. booking an unavailable room).
6. Be concise, friendly, and specific - use real course names, room numbers, times from the data.
7. After an action, confirm exactly what was done.
8. Never claim to have done something without actually calling the tool.`;

// Convert our provider-agnostic tool defs {name, description, input_schema}
// into OpenAI/Groq's function-calling format.
const openAiTools = toolDefs.map((t) => ({
  type: "function",
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  },
}));

async function callGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys and add it to your .env file."
    );
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        tools: openAiTools,
        tool_choice: "auto",
        max_tokens: 700,
      }),
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      // Free tier rate limit hit - Groq tells us how long to wait, so back off and retry
      // instead of failing the user's request outright.
      const retryAfterHeader = response.headers.get("retry-after");
      const bodyText = await response.text();
      let waitSeconds = retryAfterHeader ? parseFloat(retryAfterHeader) : null;
      if (!waitSeconds) {
        const match = bodyText.match(/try again in ([\d.]+)s/i);
        waitSeconds = match ? parseFloat(match[1]) : 2 * (attempt + 1);
      }
      await new Promise((r) => setTimeout(r, Math.min(waitSeconds, 15) * 1000 + 250));
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Groq API error ${response.status}: ${text}`);
    }
    return response.json();
  }

  throw new Error("Groq API is rate-limited (free tier) and did not recover after retries. Please wait a moment and try again.");
}

async function handleChat(userMessage, history = []) {
  const messages = [...history, { role: "user", content: userMessage }];
  const toolCallLog = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const data = await callGroq(messages);
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error("Unexpected response from Groq API: " + JSON.stringify(data));
    }

    const toolCalls = message.tool_calls || [];

    if (toolCalls.length === 0) {
      messages.push({ role: "assistant", content: message.content || "" });
      return { reply: message.content || "", history: messages, toolCalls: toolCallLog };
    }

    // Model wants to use tools: run them and feed results back
    messages.push({ role: "assistant", content: message.content || null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      let input = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        input = {};
      }
      const resultText = await executeTool(call.function.name, input);
      toolCallLog.push({ name: call.function.name, input, result: resultText });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: resultText,
      });
    }
  }

  return {
    reply: "I had to stop after several steps without a final answer - could you rephrase or simplify your request?",
    history: messages,
    toolCalls: toolCallLog,
  };
}

module.exports = { handleChat };
