import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import apiRoutes from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { openApiSpec } from "./openapi.js";
import { env } from "./config.js";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  const corsOrigins = env.corsOrigins
    ? env.corsOrigins.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  app.use(cors(corsOrigins ? { origin: corsOrigins, credentials: true } : {}));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/openapi.json", (req, res) => res.json(openApiSpec));
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: "FitGuard API",
    })
  );

  app.use("/api", apiRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.use(errorHandler);
  return app;
}
