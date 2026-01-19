// src/viewer/dicom/hooks/useImageIds.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '../api';
import { TaskType } from '../openapi/generated-client/exam';
import { ItemSelection } from '../interfaces/components.interface'
import { ItemStatus } from '../openapi/generated-client/exam'


function normalizeToArray<T>(v: T | T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : v != null ? [v] : [];
}


/**
 * Fetches the instances from a task result, and maps them to Cornerstone3D imageIds.
 * - Accepts a selected item and optional resultId
 * - Returns { imageIds, isLoading, isError }
 * - Uses 'wado-uri:' scheme per Cornerstone v3 docs
 */
export function useImageIds(item: ItemSelection, resultId?: string) {

  const {
    data: dicomUrls = [],
    isLoading,
    isError
  } = useQuery<string[]>({
    queryKey: ['tasks', item.itemId, item.status, resultId],
    enabled: !!item.itemId,
    queryFn: async () => {

      if (item.type != 'DAG' || item.status != ItemStatus.Finished) return []

      const { data } = await taskApi.getTaskApiV1ExamTaskTaskIdGet(item.itemId!);

      // Only DAG tasks with results
      const isDag = data?.task_type === TaskType.Dag;
      const results = normalizeToArray<any>(data?.results);
      if (!isDag || results.length === 0) return [];

      let selectedResult;

      if (resultId) {
        // Find specific result
        selectedResult = results.find(r => r.id === resultId);
      } else {
        // Fallback: Pick newest by datetime_created
        selectedResult = results.reduce((a, b) =>
          new Date(a?.datetime_created ?? 0) > new Date(b?.datetime_created ?? 0) ? a : b
        );
      }

      if (!selectedResult) return [];

      const instances = (selectedResult?.meta as any)?.instances;
      const urls = normalizeToArray<string>(instances).filter(Boolean);

      // Ensure correct order by sorting urls, i.e. numeric suffixes in filenames
      urls.sort();
      return urls;
    },
  });

  const imageIds = useMemo(
    () =>
      dicomUrls
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
        .map((u) => (u.startsWith('wadouri:') ? u : `wadouri:${u}`)),
    [dicomUrls]
  );

  return { imageIds, isLoading, isError };
}
