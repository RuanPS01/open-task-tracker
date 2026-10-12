import type { ReportQueryInput } from '@ott/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { usePreferences, useWorkspaceId } from '../app/session';
import { backend } from './backend';
import { keys } from './keys';

export type ReportParams = ReportQueryInput;

export function useSummaryReport(params: ReportParams) {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.report(wid, 'summary', params),
    queryFn: () => backend().reports.summary(wid, params),
    placeholderData: keepPreviousData,
  });
}

export function useDetailedReport(params: ReportParams) {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.report(wid, 'detailed', params),
    queryFn: () => backend().reports.detailed(wid, params),
    placeholderData: keepPreviousData,
  });
}

/** Gera o CSV do relatório detalhado no navegador e dispara o download. */
export function useDownloadCsv(): (params: ReportParams) => Promise<void> {
  const wid = useWorkspaceId();
  const { locale } = usePreferences();
  return useCallback(
    async (params: ReportParams) => {
      const csv = await backend().reports.csv(wid, params, locale);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${params.start}-a-${params.end}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [wid, locale],
  );
}
