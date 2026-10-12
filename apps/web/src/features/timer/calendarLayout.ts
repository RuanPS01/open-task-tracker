// Geometria do calendário do cronômetro: recorte por dia e colunas para
// apontamentos sobrepostos (mesma ideia do Google Agenda e do Toggl).

export interface DaySegment {
  id: number;
  /** Minutos desde a meia-noite local do dia exibido. */
  startMin: number;
  endMin: number;
}

export interface PlacedSegment extends DaySegment {
  column: number;
  columns: number;
}

/**
 * Recorta um apontamento ao dia [dayStart, dayStart + 24h). Um apontamento que passa
 * da meia-noite aparece nos dois dias. Devolve null se não toca o dia.
 */
export function segmentForDay(
  id: number,
  start: Date,
  end: Date,
  dayStart: Date,
): DaySegment | null {
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  if (end <= dayStart || start >= dayEnd) return null;
  const clippedStart = start < dayStart ? dayStart : start;
  const clippedEnd = end > dayEnd ? dayEnd : end;
  const toMin = (date: Date) => (date.getTime() - dayStart.getTime()) / 60_000;
  return { id, startMin: toMin(clippedStart), endMin: toMin(clippedEnd) };
}

/**
 * Distribui segmentos que se sobrepõem em colunas lado a lado. Cada grupo de
 * sobreposição (cluster) usa o número de colunas que precisar; segmentos fora de
 * qualquer sobreposição ocupam a largura toda.
 */
export function layoutDay(segments: DaySegment[], minHeightMin = 15): PlacedSegment[] {
  const sorted = [...segments].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: PlacedSegment[] = [];
  let cluster: PlacedSegment[] = [];
  let clusterEnd = -Infinity;
  const columnEnds: number[] = [];

  const flush = () => {
    const columns = Math.max(1, ...cluster.map((segment) => segment.column + 1));
    for (const segment of cluster) segment.columns = columns;
    placed.push(...cluster);
    cluster = [];
    columnEnds.length = 0;
  };

  for (const segment of sorted) {
    // Segmentos muito curtos são desenhados com altura mínima; a sobreposição
    // considera essa altura para os textos não se encavalarem.
    const visualEnd = Math.max(segment.endMin, segment.startMin + minHeightMin);
    if (segment.startMin >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let column = columnEnds.findIndex((end) => end <= segment.startMin);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = visualEnd;
    cluster.push({ ...segment, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, visualEnd);
  }
  flush();
  return placed;
}

/** Arredonda minutos para o passo da grade (15 min por padrão). */
export function snapMinutes(minutes: number, step = 15): number {
  return Math.round(minutes / step) * step;
}
