import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as any).message || message;
        errorDetails = res;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `[${request.method}] ${request.url} - Unknown error`,
        JSON.stringify(exception),
      );
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status} ${message}`,
        errorDetails ? JSON.stringify(errorDetails) : '',
      );
    }

    const responseBody: any = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= 500) {
      if (exception instanceof Error) {
        responseBody.errorType = exception.name;
        responseBody.errorCode = (exception as any).code;
        responseBody.errorMessage = exception.message;
        responseBody.stack = process.env.NODE_ENV === 'development' ? exception.stack : undefined;
      } else if (exception instanceof HttpException) {
        responseBody.errorDetails = errorDetails;
      }
    }

    response.status(status).json(responseBody);
  }
}
