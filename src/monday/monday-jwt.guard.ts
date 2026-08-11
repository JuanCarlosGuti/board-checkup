import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Verifica que la peticion viene de verdad de monday.com.
 *
 * monday manda un JWT en la cabecera Authorization con esta forma:
 *   { accountId, userId, aud, exp, iat, shortLivedToken }
 *
 * El shortLivedToken vale 5 minutos y es con lo que hablamos de vuelta con la
 * API de monday, con los scopes de la app. monday solo lo emite si nuestros
 * endpoints estan en HTTPS.
 *
 * OJO, punto sin confirmar: la documentacion dice que los webhooks de ciclo de
 * vida se firman con el Client Secret y los de tablero con el Signing Secret,
 * pero no dice explicitamente cual firma las peticiones de un bloque de accion.
 * Por eso probamos el Signing Secret primero y caemos al Client Secret, y
 * dejamos un log de cual funciono. En cuanto lo veamos en produccion, se fija
 * uno solo y se borra el fallback: aceptar dos secretos indefinidamente es
 * superficie de ataque gratis.
 */
@Injectable()
export class MondayJwtGuard implements CanActivate {
  private readonly log = new Logger(MondayJwtGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { monday?: MondayClaims }>();
    const cabecera = req.headers.authorization;
    if (!cabecera) throw new UnauthorizedException('Falta la cabecera Authorization');

    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : cabecera;

    const candidatos: Array<[string, string | undefined]> = [
      ['signing', this.config.get<string>('MONDAY_SIGNING_SECRET')],
      ['client', this.config.get<string>('MONDAY_CLIENT_SECRET')],
    ];

    for (const [nombre, secreto] of candidatos) {
      if (!secreto) continue;
      try {
        const claims = jwt.verify(token, secreto) as MondayClaims;
        if (nombre === 'client') {
          this.log.warn('JWT verificado con CLIENT_SECRET, no con SIGNING_SECRET. Fijar el guard a este y quitar el fallback.');
        }
        req.monday = claims;
        return true;
      } catch {
        // probamos el siguiente
      }
    }

    throw new UnauthorizedException('JWT invalido');
  }
}

export interface MondayClaims {
  accountId: number;
  userId: number;
  aud: string;
  exp: number;
  iat: number;
  shortLivedToken: string;
}
