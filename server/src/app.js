// server/src/app.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import morgan from "morgan";
import paymentsRouter from "./routes/payments.js";
import magicLinksRouter from "./routes/magic-links.js";
import certificatesRouter from "./routes/certificates.js";

const app = express();

// ====== LOGGING & CORS ======
app.use(morgan("dev"));
app.use(cors());

// ====== RAW BODY DLA PAYU WEBHOOK (gdy włączysz weryfikację podpisu) ======
app.use("/api/payments/notify", express.raw({ type: "*/*" }));
app.use("/api/payments/notify", (req, _res, next) => {
  try {
    req.rawBody = req.body?.toString?.() || "";
    req.body = JSON.parse(req.rawBody || "{}");
  } catch {
    req.rawBody = req.body?.toString?.() || "";
    req.body = {};
  }
  next();
});

// ====== JSON DLA POZOSTAŁYCH ENDPOINTÓW ======
app.use(express.json());

// ====== API ROUTES ======
app.use("/api/payments", paymentsRouter);
app.use("/api/magic-links", magicLinksRouter);
app.use("/api/certificates", certificatesRouter);

// ====== STATIC FRONTEND ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "../../web");
app.use(express.static(webRoot, { extensions: ["html"] }));

// Friendly SPA-ish routes for access token
app.get("/access/:token", (_req, res) => {
  res.sendFile(path.join(webRoot, "materials.html"));
});

// Fallback 404 (frontend 404.html jeżeli masz)
app.use((req, res) => {
  res.status(404).sendFile(path.join(webRoot, "404.html"));
});

export default app;

import { securityMiddleware } from "./middleware/security.js";
securityMiddleware(app);

import adminRouter from "./routes/admin.js";
app.use("/api/admin", adminRouter);

import sitemapRouter from "./routes/sitemap.js";
app.use("/sitemap.xml", sitemapRouter);

import catalogRouter from "./routes/catalog.js";
app.use("/api/catalog", catalogRouter);
import quizRouter from "./routes/quiz.js";
app.use("/api/quiz", quizRouter);
import quizRouter from "./routes/quiz.js";
app.use("/api/quiz", quizRouter);
