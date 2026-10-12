import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";

interface FilterRequest {
  id?: string;
  url: string;
}

interface FilterResponse {
  status(code: number): FilterResponse;
  json(body: unknown): void;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FilterRequest>();
    const response = context.getResponse<FilterResponse>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      status >= 500
        ? "Internal server error"
        : typeof body === "string"
          ? body
          : typeof body === "object" && body !== null && "message" in body
            ? (body as { message: unknown }).message
            : "Request failed";
    response.status(status).json({
      statusCode: status,
      code: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.id,
    });
  }
}
