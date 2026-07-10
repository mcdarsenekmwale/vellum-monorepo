import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import helmet from 'helmet';

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
  
  const corsOrigins = configService.get('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3004,http://localhost:8080,http://localhost:8081,http://localhost:8082,http://localhost:8083,http://localhost:8084,http://localhost:8085,http://localhost:8086,http://localhost:8087,http://localhost:8088,http://localhost:8089,http://localhost:19006,https://vellum-monorepo-webapp.vercel.app').split(',');
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

bootstrap();