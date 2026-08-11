import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private readonly config: ConfigService) {}

  /** Render lo usa para saber si el servicio esta vivo. */
  @Get('health')
  health() {
    return { ok: true, servicio: 'board-checkup' };
  }

  /**
   * Verificacion de dominio de monday.
   *
   * Se sirve desde aqui, y no como archivo estatico, porque el Content-Type
   * tiene que ser application/json si o si: servirlo como text/html hace fallar
   * la verificacion en silencio. El Client ID es publico por diseno.
   */
  @Get('monday-app-association.json')
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=300')
  association() {
    return { apps: [{ clientID: this.config.get<string>('MONDAY_CLIENT_ID') }] };
  }
}
