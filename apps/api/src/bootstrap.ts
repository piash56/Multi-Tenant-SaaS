import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { validateEnvironment } from "./config/environment.js";

export async function createApplication(): Promise<INestApplication> {
  const environment = validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.use(cookieParser());
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.enableCors({
    origin: environment.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-Id"],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (environment.SWAGGER_ENABLED) {
    const openApi = new DocumentBuilder()
      .setTitle("Unified Inbox API")
      .setDescription(
        "Milestone 4 authentication, authorization, tenant isolation, and health endpoints",
      )
      .setVersion("0.4.0")
      .addCookieAuth("saas_access")
      .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, openApi));
  }
  return app;
}
