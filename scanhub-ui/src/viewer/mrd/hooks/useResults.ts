// hooks/useResults.ts
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '../../../api';
import { TaskType, ItemStatus, ResultOut } from '../../../openapi/generated-client/exam';
import { ItemSelection } from '../../../interfaces/components.interface';

/**
 * Utility: Normalize possible array/singleton/undefined values into an array.
 */
function normalizeToArray<T>(v: T | T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : v != null ? [v] : [];
}

/**
 * Return type for useResults hook.
 */
export type ResultsData = {
  workflowId: string;
  taskId: string;
  results: ResultOut[];
};

/**
 * Hook: useResults
 * ----------------
 * Fetches all results (files) for a given acquisition task.
 * Returns workflow ID, task ID, and the list of available results,
 * sorted by datetime_created (newest first).
 *
 * @param item - The selected task item from UI (must be Finished and Acquisition type)
 */
export function useResults(item: ItemSelection) {
  const query = useQuery<ResultsData>({
    queryKey: ['results', item.itemId, item.status],
    enabled: !!item.itemId && item.status === ItemStatus.Finished,
    staleTime: 2 * 60_000, // 2 minutes
    queryFn: async () => {
      // Validate
      if (item.status !== ItemStatus.Finished) {
        throw new Error('Task not finished yet.');
      }
      if (item.type !== 'ACQUISITION') {
        throw new Error('Task is not an acquisition task.');
      }

      // Fetch task details from API
      const { data } = await taskApi.getTaskApiV1ExamTaskTaskIdGet(item.itemId!);

      // Check that task is an acquisition with results
      const isAcquisition = data?.task_type === TaskType.Acquisition;
      const resultsRaw = normalizeToArray<ResultOut>(data?.results);
      if (!isAcquisition || resultsRaw.length === 0) {
        throw new Error('Task has no results.');
      }

      // Extract IDs
      const workflowId = String(data.workflow_id ?? '');
      const taskId = String(data.id ?? '');
      if (!workflowId || !taskId) {
        throw new Error('Missing workflow or task ID.');
      }

      // Sort results by datetime_created (descending)
      const results = resultsRaw
        .filter((r) => !!r.id && !!r.datetime_created)
        .sort(
          (a, b) =>
            new Date(b.datetime_created).getTime() -
            new Date(a.datetime_created).getTime()
        );

      return { workflowId, taskId, results };
    },
  });

  useEffect(() => {
    if (item.status === ItemStatus.Finished) {
        query.refetch();
    }
  }, [item.progress]);

  return {
    workflowId: query.data?.workflowId ?? '',
    taskId: query.data?.taskId ?? '',
    results: query.data?.results ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
