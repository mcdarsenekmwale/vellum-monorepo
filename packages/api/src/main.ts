import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import helmet from 'helmet';

const PRISMA_ENGINE_COMMIT = '2ba551f319ab1df4bc874a89965d8b3641056773';
const PRISMA_ENGINE_TARGET = 'debian-openssl-3.0.x';
const PRISMA_ENGINE_FILENAME = `libquery_engine-${PRISMA_ENGINE_TARGET}.so.node`;
const PRISMA_ENGINE_URL = `https://binaries.prisma.sh/all_commits/${PRISMA_ENGINE_COMMIT}/${PRISMA_ENGINE_TARGET}/libquery_engine.so.node.gz`;
const PRISMA_ENGINE_DIR = '/tmp/prisma-engines';
const PRISMA_ENGINE_PATH = `${PRISMA_ENGINE_DIR}/${PRISMA_ENGINE_FILENAME}`;

async function ensurePrismaEngine() {
  if (fs.existsSync(PRISMA_ENGINE_PATH)) {
    console.log('[Prisma] Engine binary already exists, skipping download');
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = PRISMA_ENGINE_PATH;
    return;
  }

  console.log('[Prisma] Downloading query engine binary...');
  try {
    fs.mkdirSync(PRISMA_ENGINE_DIR, { recursive: true });
    const response = await fetch(PRISMA_ENGINE_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const gzBuffer = Buffer.from(await response.arrayBuffer());
    const decompressed = zlib.gunzipSync(gzBuffer);
    fs.writeFileSync(PRISMA_ENGINE_PATH, decompressed);
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = PRISMA_ENGINE_PATH;
    console.log(`[Prisma] Engine binary saved to ${PRISMA_ENGINE_PATH}`);
  } catch (error) {
    console.error('[Prisma] Failed to download engine binary:', error instanceof Error ? error.message : error);
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  const configService = app.get(ConfigService);
  
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
  
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'http:', 'https:'],
      },
    },
  }));
  
  const corsOrigins = configService.get('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001,http://localhost:3004,http://localhost:8080,http://localhost:8081,http://localhost:8082,http://localhost:8083,http://localhost:8084,http://localhost:8085,http://localhost:8086,http://localhost:8087,http://localhost:8088,http://localhost:8089,http://localhost:19006,https://vellum-monorepo-webapp.vercel.app').split(',');
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
  SwaggerModule.setup('api/docs', app, document);
  
  const port = configService.get('PORT', 3000);
  const nodeEnv = configService.get('NODE_ENV', 'development');
  await app.listen(port);

  console.log(`\n============================================================`);
  console.log(`  Vellum API — ${nodeEnv.toUpperCase()} MODE`);
  console.log(`  Server: http://localhost:${port}`);
  console.log(`  API Docs: http://localhost:${port}/api/docs`);
  console.log(`  Health: http://localhost:${port}/api/health`);
  console.log(`============================================================\n`);
}

ensurePrismaEngine().then(() => bootstrap());