/** Contrato comun de todos los diagnosticos. */

export interface ItemDeTablero {
  id: string;
  name: string;
  updatedAt: string;                       // ISO 8601
  columnas: Record<string, string | null>; // id de columna -> texto plano
}

export interface ContextoDeTablero {
  boardId: string;
  /** id de la columna de estado, si el tablero tiene una */
  columnaEstado?: string;
  /** id de la columna de personas */
  columnaResponsable?: string;
  /** id de la columna de fecha limite */
  columnaFecha?: string;
  /** etiquetas de estado que significan "cerrado" */
  etiquetasCerradas: string[];
  /** dias sin movimiento a partir de los cuales un item se considera estancado */
  diasParaEstancado: number;
  /** momento del analisis, inyectado para que los tests sean deterministas */
  ahora: Date;
}

export type Severidad = 'alta' | 'media' | 'baja';

export interface Hallazgo {
  /** identificador estable de la regla, para agrupar y para i18n */
  regla: string;
  severidad: Severidad;
  /** items involucrados; en duplicados es el grupo completo */
  itemIds: string[];
  /** una linea, ya legible por una persona */
  resumen: string;
}

export interface Regla {
  readonly id: string;
  readonly peso: number; // cuanto descuenta del puntaje de salud
  evaluar(items: ItemDeTablero[], ctx: ContextoDeTablero): Hallazgo[];
}
