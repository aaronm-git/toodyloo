import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { isAnonymousUser, clearPersistedReactQueryCache, readAnonymousCacheMeta, writeAnonymousCacheMeta } from '../lib/anonymous-cache'
import { useSession } from '../lib/auth-client'
import { getAnonymousSessionContext } from '../lib/server/anonymous-session'

export function useAnonymousCacheGuard() {
  const queryClient = useQueryClient()
  const { data: session, isPending } = useSession()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isPending) return

    if (!isAnonymousUser(session?.user)) {
      setReady(true)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const context = await getAnonymousSessionContext()
        const cachedMeta = readAnonymousCacheMeta()

        if (cachedMeta?.ipFingerprint && cachedMeta.ipFingerprint !== context.ipFingerprint) {
          clearPersistedReactQueryCache(queryClient)
        }

        if (!queryClient.getQueryData(['todos'])) {
          queryClient.setQueryData(['todos'], [])
        }

        if (!queryClient.getQueryData(['lists'])) {
          queryClient.setQueryData(['lists'], [])
        }

        writeAnonymousCacheMeta({ ipFingerprint: context.ipFingerprint })
      } finally {
        if (!cancelled) {
          setReady(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isPending, queryClient, session?.user])

  return ready
}
