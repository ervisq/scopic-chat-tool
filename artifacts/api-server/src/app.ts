import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

const allowedOrigins: string[] = [];

if (process.env.REPLIT_DEV_DOMAIN) {
  allowedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}

if (process.env.REPLIT_DOMAINS) {
  for (const domain of process.env.REPLIT_DOMAINS.split(",")) {
    const trimmed = domain.trim();
    if (trimmed) allowedOrigins.push(`https://${trimmed}`);
  }
}

if (process.env.ALLOWED_ORIGINS) {
  for (const origin of process.env.ALLOWED_ORIGINS.split(",")) {
    const trimmed = origin.trim();
    if (trimmed) allowedOrigins.push(trimmed);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
      } else if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
