import { Injectable, Logger } from '@nestjs/common';
import { ItemDeTablero } from '../diagnostics/rules/rule.types';

export interface ColumnaDeTablero { id: string; title: string; type: string; settings_str?: string }

export interface LecturaDeTablero {
  boardId: string;
  nombre: string;
  columnas: ColumnaDeTablero[];
  items: ItemDeTablero[];
  totalEnTablero: number;
  /** true si el tablero tiene mas items de los que alcanzamos a leer */
  parcial: boolean;
  msApi: number;
}

/**
 * Cliente de la API GraphQL de monday.
 *
 * La forma de la consulta NO es casual: sale de medir.
 *
 *   500 items pidiendo todas las columnas + el JSON crudo -> 12.020 pts, 1.890 ms
 *   500 items pidiendo solo las columnas necesarias, solo texto -> 7.020 pts, 1.650 ms
 *
 * Es 42% menos complejidad. Casi no cambia el tiempo, pero el presupuesto de
 * complejidad es del CLIENTE, no nuestro, y gastarselo es una forma silenciosa
 * de romperle otras integraciones.
 */
@Injectable()
export class MondayApiClient {
  private readonly log = new Logger(MondayApiClient.name);
  private static readonly ENDPOINT = 'https://api.monday.com/v2';

  /** tipos de columna que alimentan algun diagnostico; el resto no se pide */
  private static readonly TIPOS_UTILES = ['status', 'people', 'person', 'date', 'timeline', 'email', 'phone'];

  async leerTablero(token: string, boardId: string, limite: number): Promise<LecturaDeTablero> {
    const meta = await this.consultar<MetaResp>(token, `
      query {
        boards(ids: [${boardId}]) {
          id name items_count
          columns { id title type settings_str }
        }
      }
    `);

    const board = meta.boards?.[0];
    if (!board) throw new Error(`El tablero ${boardId} no existe o la app no tiene acceso`);

    const utiles = board.columns.filter((c) => MondayApiClient.TIPOS_UTILES.includes(c.type));
    const ids = utiles.map((c) => `"${c.id}"`).join(', ');
    const seleccion = ids ? `column_values(ids: [${ids}]) { id text }` : 'column_values { id text }';

    const t0 = Date.now();
    const datos = await this.consultar<ItemsResp>(token, `
      query {
        boards(ids: [${boardId}]) {
          items_page(limit: ${limite}) {
            cursor
            items { id name updated_at ${seleccion} }
          }
        }
      }
    `);
    const msApi = Date.now() - t0;

    const crudos = datos.boards?.[0]?.items_page?.items ?? [];
    const items: ItemDeTablero[] = crudos.map((i) => ({
      id: i.id,
      name: i.name,
      updatedAt: i.updated_at,
      columnas: Object.fromEntries(i.column_values.map((c) => [c.id, c.text])),
    }));

    return {
      boardId: board.id,
      nombre: board.name,
      columnas: board.columns,
      items,
      totalEnTablero: board.items_count ?? items.length,
      parcial: (board.items_count ?? 0) > items.length,
      msApi,
    };
  }

  private async consultar<T>(token: string, query: string): Promise<T> {
    const res = await fetch(MondayApiClient.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> };

    if (json.errors?.length) {
      const codigo = json.errors[0].extensions?.code;
      // No reintentamos aqui: estamos dentro de una invocacion sincrona de
      // Sidekick con un presupuesto de segundos. Esperar el reset del minuto
      // seria peor que responder "ahora no puedo".
      if (codigo === 'COMPLEXITY_BUDGET_EXHAUSTED') {
        throw new PresupuestoAgotadoError();
      }
      this.log.error(`API de monday: ${JSON.stringify(json.errors).slice(0, 300)}`);
      throw new Error(json.errors[0].message);
    }
    return json.data as T;
  }
}

export class PresupuestoAgotadoError extends Error {
  constructor() { super('La cuenta agoto su presupuesto de API de monday por este minuto'); }
}

interface MetaResp { boards: Array<{ id: string; name: string; items_count: number; columns: ColumnaDeTablero[] }> }
interface ItemsResp {
  boards: Array<{ items_page: { cursor: string | null; items: Array<{
    id: string; name: string; updated_at: string; column_values: Array<{ id: string; text: string | null }>;
  }> } }>;
}
