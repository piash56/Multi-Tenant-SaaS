import "dotenv/config";
import "reflect-metadata";
import { createApplication } from "./bootstrap.js";
import { validateEnvironment } from "./config/environment.js";

const environment = validateEnvironment(process.env);
const app = await createApplication();
await app.listen(environment.API_PORT, "0.0.0.0");
