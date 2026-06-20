import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { setupAuth, registerAuthRoutes } from "./auth/replitAuth";
import { registerAuthRoutes as registerUserAuthRoutes } from "./auth/routes";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

await setupAuth(app);
registerUserAuthRoutes(app);

app.use("/api", router);

export default app;
