import type { QueryClient } from '@tanstack/react-query'

export const REACT_QUERY_PERSIST_KEY = 'toodyloo-react-query-cache-v1'
export const ANONYMOUS_CACHE_META_KEY = 'toodyloo-anonymous-cache-meta-v1'

export interface AnonymousCacheMeta {
  ipFingerprint: string
}

export function isAnonymousUser(
  user: { isAnonymous?: boolean } | null | undefined,
): user is { isAnonymous: true } {
  return user?.isAnonymous === true
}

export function readAnonymousCacheMeta(): AnonymousCacheMeta | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(ANONYMOUS_CACHE_META_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AnonymousCacheMeta
  } catch {
    return null
  }
}

export function writeAnonymousCacheMeta(meta: AnonymousCacheMeta): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ANONYMOUS_CACHE_META_KEY, JSON.stringify(meta))
}

export function clearPersistedReactQueryCache(queryClient?: QueryClient): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(REACT_QUERY_PERSIST_KEY)
    window.localStorage.removeItem(ANONYMOUS_CACHE_META_KEY)
  }

  queryClient?.clear()
}
