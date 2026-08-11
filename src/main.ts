import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const log = new Logger('bootstrap');

  const maxAge = Number(config.get('HSTS_MAX_AGE') ?? 86400);

  app.use(
    helmet({
      // HSTS es requisito duro del marketplace de monday. Arrancamos en 86400 y
      // se sube a 31536000 tras unos dias estables. NUNCA con preload: en la
      // practica es irreversible.
      hsts: { maxAge, includeSubDomains: true, preload: false },
      // Este servicio solo responde JSON; no hay nada que embeber ni que ejecutar.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // Nada de ValidationPipe global: no usamos DTOs con decoradores en ningun
  // lado, asi que solo agregaria class-validator y class-transformer como
  // dependencias para no hacer nada. El unico cuerpo que llega es el de monday
  // y se valida a mano en el controlador, que es donde se sabe que significa
  // cada campo.

  const port = Number(config.get('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');
  log.log(`board-checkup escuchando en :${port} (HSTS max-age=${maxAge})`);
}

void bootstrap();
