import type { ReportDetailed, ReportQueryInput, ReportSummary } from '@ott/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '../app/session';
import { buildQuery, request } from './client';
import { keys } from './keys';

type Params = Omit<ReportQueryInput, 'userIds' | 'projectIds' | 'clientIds' | 'tagIds' | 'taskIds'> & {
  userIds?: number[];
  projectIds?: number[];
  clientIds?: number[];
  tagIds?: number[];
};

export function useSummaryReport(params: Params) {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.report(wid, 'summary', params),
    queryFn: () => request<ReportSummary>(`/workspaces/${wid}/reports/summary`, { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useDetailedReport(params: Params) {
  const wid = useWorkspaceId();
  return useQuery({
    queryKey: keys.report(wid, 'detailed', params),
    queryFn: () => request<ReportDetailed>(`/workspaces/${wid}/reports/detailed`, { query: params }),
    placeholderData: keepPreviousData,
  });
}

/** URL do CSV para baixar direto pelo navegador (o cookie de sessão vai junto). */
export function useCsvUrl(params: Params): string {
  const wid = useWorkspaceId();
  return `/api/workspaces/${wid}/reports/detailed.csv${buildQuery(params)}`;
}

export type ReportParams = Params;
