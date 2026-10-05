'use client';

import { queryKeys } from '@/constants/query-keys';
import { getMe } from '@/services/api';
import { useUserStore } from '@/stores';
import { useQuery } from '@tanstack/react-query';

export function useMeQuery() {
  const jwt = useUserStore((state) => state.jwt);

  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: getMe,
    enabled: Boolean(jwt)
  });
}
