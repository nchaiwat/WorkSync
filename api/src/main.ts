import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: true, // Allow all origins, or configure specific frontend URL
    credentials: true,
  });

  // Enable Global Validation Pipes
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Request logging middleware
  app.use((req: any, res: any, next: any) => {
    console.log(`[Request] ${req.method} ${req.url} - query:`, JSON.stringify(req.query), '- body:', JSON.stringify(req.body));
    res.on('finish', () => {
      console.log(`[Response] ${req.method} ${req.url} - status: ${res.statusCode}`);
    });
    next();
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 NestJS Backend API running on: http://localhost:${port}`);
}
bootstrap();

