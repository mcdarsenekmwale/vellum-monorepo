import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true,
  });

  const rawBodySizeLimit = '5mb';
  app.useBodyParser('json', { limit: rawBodySizeLimit });
  app.useBodyParser('urlencoded', { extended: true, limit: rawBodySizeLimit });
  app.useBodyParser('text', { limit: rawBodySizeLimit });

  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();
  
  instance.get('/debug-test', (req: any, res: any) => {
    res.json({ 
      status: 'ok', 
      message: 'Express server is running',
      timestamp: new Date().toISOString(),
    });
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:', 'http:'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'http:', 'https:'],
          workerSrc: ["'self'", 'blob:'],
        },
      },
    }),
  );

  // Build CORS origins: merge env var with required production origins
  const envCorsOrigins = (configService.get<string>('CORS_ORIGIN') ?? process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const requiredOrigins = [
    'https://vellum-monorepo-webapp.vercel.app',
    'https://vellum-admin-dashboard-eta.vercel.app',
    'https://vellum-admin-dashboard-eta-kappa.vercel.app',
  ];
  const corsOrigins = [...new Set([...envCorsOrigins, ...requiredOrigins])];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, X-Requested-With',
  });

  app.useStaticAssets(path.join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vellum API')
    .setDescription('Vellum Backend API Documentation')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const swaggerUiPath = path.join(__dirname, '..', 'swagger-ui');
  const customSwaggerUiPath = fs.existsSync(swaggerUiPath)
    ? swaggerUiPath
    : undefined;

  SwaggerModule.setup('api/docs', app, document, {
    customSwaggerUiPath,
  });

  const port = configService.get('PORT', 3000);
  const nodeEnv = configService.get('NODE_ENV', 'development');

  app.enableShutdownHooks();

  await app.listen(port);

  const server = app.getHttpServer();
  const routeCount = (server as any)._events?.request?.router?.stack?.length || 0;
  
  logger.log(`\n============================================================`);
  logger.log(`  Vellum API — ${nodeEnv.toUpperCase()} MODE`);
  logger.log(`  Server: http://localhost:${port}`);
  logger.log(`  API Docs: http://localhost:${port}/api/docs`);
  logger.log(`  Health: http://localhost:${port}/api/health`);
  logger.log(`  CORS origins: ${corsOrigins.length} configured`);
  logger.log(`  Total routes: ${routeCount}`);
  logger.log(`============================================================\n`);
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
