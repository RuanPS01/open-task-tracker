// Gráficos em SVG puro, sem biblioteca. Regras (docs/03-identidade-visual.md, seção Gráficos):
// barras com no máximo 24px e ponta arredondada de 4px, 2px de espaço entre segmentos,
// grade em linha fina, legenda sempre que houver duas séries ou mais, rótulos
// seletivos e dica ao passar o mouse. Texto nunca usa a cor da série.
import clsx from 'clsx';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Charts.module.css';

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** Passo "redondo" para o eixo: 1, 2, 5 vezes potência de 10 (em horas). */
export function niceStep(max: number, targetTicks = 4): number {
  if (max <= 0) return 1;
  const raw = max / targetTicks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * power);
  return candidates.find((step) => step >= raw) ?? 10 * power;
}

interface Hover {
  x: number;
  y: number;
  content: ReactNode;
}

function HoverTip({ hover }: { hover: Hover | null }) {
  if (!hover) return null;
  return (
    <div className={styles.tip} style={{ left: hover.x, top: hover.y }} role="tooltip">
      {hover.content}
    </div>
  );
}

export interface Series {
  key: string;
  label: string;
  color: string;
}

export function Legend({ series, shape = 'rect' }: { series: Series[]; shape?: 'rect' | 'dot' }) {
  return (
    <div className={styles.legend}>
      {series.map((item) => (
        <span key={item.key} className={styles.legendItem}>
          <i className={shape === 'dot' ? styles.legendDot : styles.legendRect} style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colunas empilhadas (duração por dia)
// ---------------------------------------------------------------------------

export interface ColumnDatum {
  key: string;
  label: string;
  values: number[];
}

export function StackedColumns({
  data,
  series,
  formatValue,
  formatTick,
  height = 220,
  emptyLabel,
  unit = 1,
}: {
  data: ColumnDatum[];
  series: Series[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  height?: number;
  emptyLabel?: string;
  /** Unidade em que o passo do eixo é escolhido (3600 para passos em horas inteiras). */
  unit?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover | null>(null);
  const axisWidth = 44;
  const bottom = 26;
  const top = 18;
  const plotHeight = height - bottom - top;
  const plotWidth = Math.max(0, width - axisWidth);
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const max = Math.max(0, ...totals);
  const step = Math.max(1, niceStep(max / unit)) * unit;
  const yMax = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const slot = data.length > 0 ? plotWidth / data.length : 0;
  const barWidth = Math.min(24, Math.max(4, slot * 0.55));
  const y = (value: number) => top + plotHeight - (value / yMax) * plotHeight;
  const showCaps = data.length <= 10;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotWidth / 48))));

  return (
    <div className={styles.chart}>
      {series.length > 1 && <Legend series={series} />}
      <div ref={ref} className={styles.plot} style={{ height }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={axisWidth} x2={width} y1={y(tick)} y2={y(tick)} className={styles.grid} />
                <text x={axisWidth - 8} y={y(tick)} className={styles.tick} textAnchor="end" dominantBaseline="middle">
                  {formatTick(tick)}
                </text>
              </g>
            ))}
            {data.map((datum, index) => {
              const cx = axisWidth + slot * index + slot / 2;
              let cursor = 0;
              const total = totals[index]!;
              const segments = datum.values
                .map((value, seriesIndex) => ({ value, seriesIndex }))
                .filter((segment) => segment.value > 0);
              return (
                <g
                  key={datum.key}
                  onMouseMove={(event) => {
                    const rect = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    setHover({
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                      content: (
                        <>
                          <strong className={styles.tipValue}>{formatValue(total)}</strong>
                          <span className={styles.tipLabel}>{datum.label}</span>
                          {series.length > 1 &&
                            series.map((item, i) => (
                              <span key={item.key} className={styles.tipRow}>
                                <i style={{ background: item.color }} />
                                {item.label}: {formatValue(datum.values[i] ?? 0)}
                              </span>
                            ))}
                        </>
                      ),
                    });
                  }}
                >
                  <rect x={axisWidth + slot * index} y={top} width={slot} height={plotHeight} className={styles.hit} />
                  {segments.map((segment, position) => {
                    const y1 = y(cursor + segment.value);
                    const y0 = y(cursor);
                    cursor += segment.value;
                    const isTop = position === segments.length - 1;
                    // 2px de espaço na cor da superfície entre segmentos empilhados.
                    const h = Math.max(1, y0 - y1 - (position > 0 ? 2 : 0));
                    const radius = isTop ? Math.min(4, h / 2, barWidth / 2) : 0;
                    const x = cx - barWidth / 2;
                    const path = `M ${x} ${y1 + h} V ${y1 + radius} Q ${x} ${y1} ${x + radius} ${y1} H ${x + barWidth - radius} Q ${x + barWidth} ${y1} ${x + barWidth} ${y1 + radius} V ${y1 + h} Z`;
                    return <path key={segment.seriesIndex} d={path} fill={series[segment.seriesIndex]!.color} />;
                  })}
                  {showCaps && total > 0 && (
                    <text x={cx} y={y(total) - 6} className={styles.cap} textAnchor="middle">
                      {formatValue(total)}
                    </text>
                  )}
                  {index % labelEvery === 0 && (
                    <text x={cx} y={height - 8} className={styles.tick} textAnchor="middle">
                      {datum.label}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={axisWidth} x2={width} y1={y(0)} y2={y(0)} className={styles.baseline} />
          </svg>
        )}
        {max === 0 && emptyLabel && <div className={styles.emptyOverlay}>{emptyLabel}</div>}
        <HoverTip hover={hover} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais (horas por membro, por tarefa)
// ---------------------------------------------------------------------------

export interface BarDatum {
  key: string;
  label: ReactNode;
  value: number;
  marker?: ReactNode;
}

export function HorizontalBars({
  data,
  formatValue,
  color = 'var(--chart-single)',
}: {
  data: BarDatum[];
  formatValue: (value: number) => string;
  color?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <div className={styles.hbars}>
      {data.map((datum) => (
        <div key={datum.key} className={styles.hbarRow} title={`${formatValue(datum.value)}`}>
          <span className={styles.hbarLabel}>
            {datum.marker}
            <span>{datum.label}</span>
          </span>
          <span className={styles.hbarTrack}>
            <span className={styles.hbar} style={{ width: `${max ? (datum.value / max) * 100 : 0}%`, background: color }} />
            <span className={styles.hbarValue}>{formatValue(datum.value)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rosca (participação por projeto) com tabela ao lado
// ---------------------------------------------------------------------------

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function Donut({
  data,
  formatValue,
  centerLabel,
  otherLabel,
  maxSegments = 6,
}: {
  data: DonutDatum[];
  formatValue: (value: number) => string;
  centerLabel: string;
  otherLabel: string;
  maxSegments?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  // Acima de 6 fatias a rosca deixa de ser legível: o resto vira "Outros".
  const head = sorted.slice(0, maxSegments - 1);
  const tail = sorted.slice(maxSegments - 1);
  const segments =
    tail.length > 1
      ? [...head, { key: 'other', label: otherLabel, value: tail.reduce((sum, d) => sum + d.value, 0), color: 'var(--chart-other)' }]
      : sorted;
  const total = segments.reduce((sum, d) => sum + d.value, 0);
  const size = 180;
  const radius = 80;
  const inner = 56;
  const center = size / 2;
  let angle = -Math.PI / 2;
  const arcs = segments.map((segment) => {
    const sweep = total ? (segment.value / total) * Math.PI * 2 : 0;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    const large = sweep > Math.PI ? 1 : 0;
    const point = (r: number, a: number) => `${center + r * Math.cos(a)} ${center + r * Math.sin(a)}`;
    const full = sweep >= Math.PI * 2 - 0.0001;
    const d = full
      ? `M ${point(radius, 0)} A ${radius} ${radius} 0 1 1 ${point(radius, Math.PI)} A ${radius} ${radius} 0 1 1 ${point(radius, 0)} M ${point(inner, 0)} A ${inner} ${inner} 0 1 0 ${point(inner, Math.PI)} A ${inner} ${inner} 0 1 0 ${point(inner, 0)} Z`
      : `M ${point(radius, start)} A ${radius} ${radius} 0 ${large} 1 ${point(radius, end)} L ${point(inner, end)} A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)} Z`;
    return { ...segment, d };
  });
  const active = segments.find((segment) => segment.key === hover);

  return (
    <div className={styles.donutWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" className={styles.donut}>
        {arcs.map((arc) => (
          <path
            key={arc.key}
            d={arc.d}
            fill={arc.color}
            className={clsx(styles.arc, hover && hover !== arc.key && styles.dim)}
            onMouseEnter={() => setHover(arc.key)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={center} y={center - 6} textAnchor="middle" className={styles.donutValue}>
          {formatValue(active ? active.value : total)}
        </text>
        <text x={center} y={center + 14} textAnchor="middle" className={styles.donutLabel}>
          {active ? active.label.slice(0, 18) : centerLabel}
        </text>
      </svg>
      <table className={styles.donutTable}>
        <tbody>
          {segments.map((segment) => (
            <tr key={segment.key} onMouseEnter={() => setHover(segment.key)} onMouseLeave={() => setHover(null)} className={clsx(hover === segment.key && styles.rowActive)}>
              <td>
                <i className={styles.legendRect} style={{ background: segment.color }} />
              </td>
              <td className={styles.donutName}>{segment.label}</td>
              <td className="tabular">{formatValue(segment.value)}</td>
              <td className={clsx('tabular', styles.muted)}>{total ? Math.round((segment.value / total) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Medidor empilhado (situação das tarefas)
// ---------------------------------------------------------------------------

export function StackedMeter({ parts, formatValue }: { parts: (Series & { value: number })[]; formatValue: (value: number) => string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div className={styles.chart}>
      <div className={styles.meter}>
        {parts
          .filter((part) => part.value > 0)
          .map((part) => (
            <span
              key={part.key}
              className={styles.meterPart}
              style={{ flexGrow: part.value, background: part.color }}
              title={`${part.label}: ${formatValue(part.value)}`}
            />
          ))}
        {total === 0 && <span className={styles.meterEmpty} />}
      </div>
      <div className={styles.legend}>
        {parts.map((part) => (
          <span key={part.key} className={styles.legendItem}>
            <i className={styles.legendRect} style={{ background: part.color }} />
            {part.label}
            <strong>{formatValue(part.value)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function StatTile({ label, value, detail, tone }: { label: string; value: ReactNode; detail?: ReactNode; tone?: 'danger' | 'success' }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={clsx(styles.tileValue, tone && styles[tone])}>{value}</span>
      {detail && <span className={styles.tileDetail}>{detail}</span>}
    </div>
  );
}
