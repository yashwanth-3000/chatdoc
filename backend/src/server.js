import "dotenv/config";
import cors from "cors";
import express from "express";
import { chatRouter } from "./chat/route.js";
import { existingFoundryUserRouter } from "./existing-foundry-user/routes.js";

const app = express();
const port = Number(process.env.PORT || 4000);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "chatdock-backend",
    version: "0.1.0",
  });
});

app.use("/api/chat", chatRouter);
app.use("/api/existing-foundry-user", existingFoundryUserRouter);

app.use((error, _request, response, _next) => {
  const status = Number(error.status || error.statusCode || 500);
  const publicMessage = status >= 500
    ? "The backend could not complete the request."
    : error.message;

  response.status(status).json({
    error: publicMessage,
    status,
  });
});

app.listen(port, () => {
  console.log(`ChatDock backend listening on http://localhost:${port}`);
});
