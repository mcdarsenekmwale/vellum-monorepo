import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter — Security', () => {
  let filter: AllExceptionsFilter;
  let response: any;
  let request: any;
  let host: ArgumentsHost;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    request = { method: 'GET', url: '/api/some-endpoint' };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  function buildHttpException(status: HttpStatus, responseObj: any) {
    return new HttpException(responseObj, status);
  }

  describe('production mode (NODE_ENV !== "development")', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('returns a generic message for 500-level errors (no internal details)', () => {
      const err = new Error('Connection refused: postgres://user:pass@db:5432');
      (err as any).stack = 'Error: Connection refused\n  at DatabaseClient.connect (db.ts:10)';

      filter.catch(err, host);

      expect(response.status).toHaveBeenCalledWith(500);
      const body = response.json.mock.calls[0][0];
      expect(body.statusCode).toBe(500);
      expect(body.message).toBe('Internal server error');
      // Critical: no stack, no error type, no DB credentials
      expect(body.stack).toBeUndefined();
      expect(body.errorType).toBeUndefined();
      expect(body.errorMessage).toBeUndefined();
      expect(body.errorCode).toBeUndefined();
      expect(body.errorDetails).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('postgres://');
      expect(JSON.stringify(body)).not.toContain('user:pass');
    });

    it('still surfaces the user-facing message for 4xx HttpExceptions', () => {
      const err = buildHttpException(HttpStatus.BAD_REQUEST, {
        message: 'Invalid email format',
      });
      filter.catch(err, host);

      const body = response.json.mock.calls[0][0];
      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('Invalid email format');
    });

    it('does not expose the full error response object for 4xx HttpExceptions', () => {
      const err = buildHttpException(HttpStatus.UNPROCESSABLE_ENTITY, {
        message: 'Validation failed',
        error: 'Unprocessable Entity',
        details: { field: 'email', reason: 'required' },
      });
      filter.catch(err, host);

      const body = response.json.mock.calls[0][0];
      expect(body.statusCode).toBe(422);
      expect(body.message).toBe('Validation failed');
      // errorDetails must NOT be added in production
      expect(body.errorDetails).toBeUndefined();
    });

    it('handles non-Error thrown values without crashing', () => {
      // E.g. someone threw a string
      filter.catch('unexpected failure', host);
      expect(response.status).toHaveBeenCalledWith(500);
      const body = response.json.mock.calls[0][0];
      expect(body.message).toBe('Internal server error');
      expect(body.stack).toBeUndefined();
    });

    it('includes path and timestamp for traceability', () => {
      filter.catch(new Error('boom'), host);
      const body = response.json.mock.calls[0][0];
      expect(body.path).toBe('/api/some-endpoint');
      expect(body.timestamp).toBeTruthy();
      expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('development mode (NODE_ENV === "development")', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('exposes stack traces and error details for debugging', () => {
      const err = new Error('debug only');
      (err as any).stack = 'Error: debug only\n  at /path/to/file.ts:1:1';
      filter.catch(err, host);

      const body = response.json.mock.calls[0][0];
      expect(body.statusCode).toBe(500);
      // Generic Errors keep the public "Internal server error" message, but
      // the dev-mode extras (errorType, errorMessage, stack) are attached so
      // developers can debug.
      expect(body.errorType).toBe('Error');
      expect(body.errorMessage).toBe('debug only');
      expect(body.stack).toContain('at /path/to/file.ts');
    });

    it('returns the actual message for HttpExceptions (no generic masking)', () => {
      const err = buildHttpException(HttpStatus.BAD_REQUEST, {
        message: 'Field X is required',
      });
      filter.catch(err, host);
      const body = response.json.mock.calls[0][0];
      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('Field X is required');
    });
  });
});
