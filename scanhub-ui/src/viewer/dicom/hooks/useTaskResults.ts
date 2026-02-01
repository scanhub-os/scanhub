import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '../../../api';
import { ItemStatus, ResultOut } from '../../../openapi/generated-client/exam';
import { ItemSelection } from '../../../interfaces/components.interface';

/**
 * Utility: Normalize possible array/singleton/undefined values into an array.
 */
function normalizeToArray<T>(v: T | T[] | undefined | null): T[] {
    return Array.isArray(v) ? v : v != null ? [v] : [];
}

/**
 * Return type for useTaskResults hook.
 */
export type ResultsData = {
    taskId: string;
    results: ResultOut[];
};

/**
 * Hook: useTaskResults
 * ----------------
 * Fetches all results for a given task (DAG or otherwise).
 * Returns task ID and the list of available results,
 * sorted by datetime_created (newest first).
 *
 * @param item - The selected task item from UI
 */
export function useTaskResults(item: ItemSelection) {
    const query = useQuery<ResultsData>({
        queryKey: ['task-results', item.itemId, item.status],
        enabled: !!item.itemId && item.status === ItemStatus.Finished,
        staleTime: 2 * 60_000, // 2 minutes
        queryFn: async () => {
            // Validate
            if (!item.itemId) throw new Error('No item ID');

            if (item.status !== ItemStatus.Finished) {
                // Return empty if not finished, or handle as error? 
                // For now, let's assume we might want to see partial results? 
                // Actually user code usually checks for Finished.
                // Let's stick to Finished for now to match existting logic.
                return { taskId: item.itemId!, results: [] };
            }

            // Fetch task details from API
            const { data } = await taskApi.getTaskApiV1ExamTaskTaskIdGet(item.itemId!);

            // We expect results
            const resultsRaw = normalizeToArray<ResultOut>(data?.results);

            // Sort results by datetime_created (descending)
            const results = resultsRaw
                .filter((r) => !!r.id && !!r.datetime_created)
                .sort(
                    (a, b) =>
                        new Date(b.datetime_created).getTime() -
                        new Date(a.datetime_created).getTime()
                );

            return { taskId: String(data.id), results };
        },
    });

    useEffect(() => {
        if (item.status === ItemStatus.Finished) {
            query.refetch();
        }
    }, [item.status]);

    return {
        taskId: query.data?.taskId ?? '',
        results: query.data?.results ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
    };
}
