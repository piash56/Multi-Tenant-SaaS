import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./app.module.js";
import { validateWorkerEnvironment } from "./environment.js";
import { StructuredLogger } from "./logger.service.js";

validateWorkerEnvironment(process.env);
const application = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
application.useLogger(application.get(StructuredLogger));
application.enableShutdownHooks();
