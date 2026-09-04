require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { init } = require("./db");
const routes = require("./routes");

init();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CampusOS server running on http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn("[warn] GROQ_API_KEY not set - the AI agent chat will not work until you add it to .env (get a free key at https://console.groq.com/keys)");
  }
});
