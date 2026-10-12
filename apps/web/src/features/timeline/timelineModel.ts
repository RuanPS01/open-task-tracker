// Empilhamento de barras na Linha do tempo: tarefas que se sobrepõem no tempo vão
// para subfaixas diferentes dentro da faixa da pessoa (algoritmo guloso por início).
import { compareIds, type Id, type IsoDate } from '@ott/shared';

export interface LaneItem {
  id: Id;
  start: IsoDate;
  end: IsoDate;
}

export function packLanes(items: LaneItem[]): { lanes: Map<Id, number>; count: number } {
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || compareIds(a.id, b.id));
  const laneEnds: IsoDate[] = [];
  const lanes = new Map<Id, number>();
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end < item.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    lanes.set(item.id, lane);
  }
  return { lanes, count: laneEnds.length };
}
