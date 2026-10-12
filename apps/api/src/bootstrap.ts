import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { validateEnvironment } from "./config/environment.js";

export async function createApplication(): Promise<INestApplication> {
  const environment = validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.enableCors({
    origin: environment.CORS_ORIGINS,
    credentials: false,
    methods: ["GET", "HEAD", "OPTIONS"],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const openApi = new DocumentBuilder()
    .setTitle("Unified Inbox API")
    .setDescription("Milestone 2 foundation endpoints only")
    .setVersion("0.1.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, openApi));
  return app;
}
