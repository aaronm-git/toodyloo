import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  useInfiniteQuery,
  useMutationState,
  useMutation as useReactQueryMutation,
} from '@tanstack/react-query'
import { formatRelativeTime } from '../date-utils'
import { useSession } from '../auth-client'
import {
  createActivityLog,
  getActivityLogs,
  updateActivityLog,
} from '../server/activity'
import { allTrackedMutationsFilter } from './mutation-keys'
import { getFriendlyErrorMessage, logMutationFailureToSentry } from './sentry'
import type { ActivityLogRecord, ActivityLogsPage } from '../server/activity'
import type {
  ActivityLogEntry,
  MutationMeta,
  OperationStatus,
  OptimisticOperation,
  OptimisticOperationsContextValue,
} from './types'
import type { ReactNode } from 'react'
import type { Mutation, MutationState } from '@tanstack/react-query'

// Page size for infinite scroll
const PAGE_SIZE = 20

// Type for mutation with our custom meta
interface TrackedMutation {
  state: MutationState<unknown, Error, unknown, unknown>
  options: {
    mutationKey?: ReadonlyArray<unknown>
    meta?: MutationMeta
    retry?: number | boolean
  }
}

/**
 * Convert a React Query mutation to our OptimisticOperation format
 */
function mutationToOperation(
  mutation: TrackedMutation,
  sentryEventIds: Record<string, string>,
  dbIdMap: Record<string, string>,
): OptimisticOperation | null {
  const { state, options } = mutation
  const meta = options.meta

  if (!meta) return null

  const status: OperationStatus =
    state.status === 'pending'
      ? 'pending'
      : state.status === 'success'
        ? 'success'
        : 'error'

  // Calculate retry info
  const maxRetries =
    typeof options.retry === 'number'
      ? options.retry
      : options.retry === false
        ? 0
        : 3
  const retryCount = state.failureCount || 0

  const mutationId = String(state.submittedAt || Date.now())
  // Use DB ID if we have one, otherwise use mutation ID
  const id = dbIdMap[mutationId] || mutationId

  // Use friendly error message
  const errorMessage = state.error
    ? getFriendlyErrorMessage(state.error)
    : undefined

  // Extract timestamp from variables for update operations, then meta, then submittedAt
  let startedAt: number
  if (meta.operationType === 'update' && state.variables) {
    const vars = state.variables as { updatedAt?: Date }
    if (vars.updatedAt) {
      startedAt =
        vars.updatedAt instanceof Date
          ? vars.updatedAt.getTime()
          : new Date(vars.updatedAt).getTime()
    } else {
      startedAt = meta.timestamp || state.submittedAt || Date.now()
    }
  } else {
    startedAt = meta.timestamp || state.submittedAt || Date.now()
  }

  return {
    id,
    type: meta.operationType,
    entityType: meta.entityType,
    entityId: meta.entityId || null,
    entityName: meta.getEntityName(state.variables),
    status,
    retryCount,
    maxRetries,
    error: errorMessage,
    sentryEventId: sentryEventIds[id],
    startedAt,
    completedAt: status !== 'pending' ? Date.now() : undefined,
    variables: state.variables,
  }
}

/**
 * Convert DB record to OptimisticOperation
 */
function dbRecordToOperation(record: ActivityLogRecord): OptimisticOperation {
  return {
    id: record.id,
    type: record.operationType,
    entityType: record.entityType,
    entityId: record.entityId,
    entityName: record.entityName,
    status: record.status,
    retryCount: record.retryCount,
    maxRetries: record.maxRetries,
    error: record.errorMessage || undefined,
    sentryEventId: record.sentryEventId || undefined,
    startedAt: record.startedAt.getTime(),
    completedAt: record.completedAt?.getTime(),
    variables: undefined,
  }
}

/**
 * Convert OptimisticOperation to ActivityLogEntry with display properties
 */
function operationToLogEntry(operation: OptimisticOperation): ActivityLogEntry {
  return {
    ...operation,
    isRetrying: operation.status === 'pending' && operation.retryCount > 0,
    relativeTime: operation.completedAt
      ? formatRelativeTime(operation.completedAt)
      : undefined,
  }
}

// Extended context value with infinite scroll support
interface ExtendedOptimisticOperationsContextValue extends OptimisticOperationsContextValue {
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isLoadingActivity: boolean
}

// Context
const OptimisticOperationsContext =
  createContext<ExtendedOptimisticOperationsContextValue | null>(null)

/**
 * Memoized wrapper for children to prevent re-renders when provider state changes.
 * This is critical for preventing focus loss in input fields when mutations trigger
 * provider re-renders via useMutationState.
 */
const MemoizedChildren = memo(function MemoizedChildren({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
})

/**
 * Provider component for optimistic operations tracking
 * Now with DB persistence and infinite scroll for activity logs
 */
export function OptimisticOperationsProvider({
  children,
}: {
  children: ReactNode
}) {
  const { data: session, isPending: isSessionPending } = useSession()
  const isAuthenticated = Boolean(session?.user && session.user.isAnonymous !== true)

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Store for Sentry event IDs (maps operation ID to Sentry event ID)
  const [sentryEventIds, setSentryEventIds] = useState<Record<string, string>>(
    {},
  )

  // Map mutation IDs to DB record IDs
  const [dbIdMap, setDbIdMap] = useState<Record<string, string>>({})

  // Track IDs of operations that were previously pending (to detect completions)
  const previouslyPendingIds = useRef<Set<string>>(new Set())

  // Track IDs already saved to DB (to avoid duplicates)
  const savedToDbIds = useRef<Set<string>>(new Set())

  // Track IDs already updated in DB
  const updatedInDbIds = useRef<Set<string>>(new Set())

  // Track which operations have been logged to Sentry
  const loggedToSentryIds = useRef<Set<string>>(new Set())

  // Load activity history from DB with infinite scroll
  const {
    data: activityPages,
    fetchNextPage,
    hasNextPage = false,
    isFetchingNextPage,
    isLoading: isLoadingActivity,
    refetch: refetchActivity,
  } = useInfiniteQuery({
    queryKey: ['activity-logs'],
    queryFn: async ({ pageParam }): Promise<ActivityLogsPage> => {
      return getActivityLogs({
        data: {
          limit: PAGE_SIZE,
          cursor: pageParam || null,
        },
      })
    },
    enabled: isAuthenticated,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  })

  // Flatten all pages into a single array of DB operations
  const dbOperations = useMemo(() => {
    if (!activityPages?.pages) return []
    return activityPages.pages.flatMap((page) =>
      page.items.map(dbRecordToOperation),
    )
  }, [activityPages])

  // Mutation to create activity log entry (not tracked - no mutationKey)
  const createActivityMutation = useReactQueryMutation({
    mutationFn: async (data: {
      mutationId: string
      operationType: 'create' | 'update' | 'delete'
      entityType: 'todo' | 'subtask' | 'list' | 'ai-todo'
      entityName: string
      entityId?: string | null
      maxRetries: number
      startedAt?: Date
    }) => {
      const result = await createActivityLog({
        data: {
          operationType: data.operationType,
          entityType: data.entityType,
          entityName: data.entityName,
          entityId: data.entityId,
          maxRetries: data.maxRetries,
          startedAt: data.startedAt,
        },
      })
      return { mutationId: data.mutationId, dbId: result.id }
    },
    onSuccess: ({ mutationId, dbId }) => {
      setDbIdMap((prev) => ({ ...prev, [mutationId]: dbId }))
    },
  })

  // Mutation to update activity log entry (not tracked - no mutationKey)
  const updateActivityMutation = useReactQueryMutation({
    mutationFn: async (data: {
      id: string
      status: 'pending' | 'success' | 'error'
      entityId?: string | null
      errorMessage?: string | null
      sentryEventId?: string | null
      retryCount?: number
    }) => {
      return updateActivityLog({ data })
    },
    onSuccess: () => {
      // Refetch first page of activity logs to get updated data
      refetchActivity()
    },
  })

  // Get all tracked mutations from React Query
  const mutations = useMutationState({
    filters: allTrackedMutationsFilter,
    select: (
      mutation: Mutation<unknown, Error, unknown, unknown>,
    ): TrackedMutation => ({
      state: mutation.state,
      options: mutation.options as TrackedMutation['options'],
    }),
  })

  // Convert mutations to operations
  const currentOperations = useMemo(() => {
    return mutations
      .map((m) => mutationToOperation(m, sentryEventIds, dbIdMap))
      .filter((op): op is OptimisticOperation => op !== null)
  }, [mutations, sentryEventIds, dbIdMap])

  // Save new operations to DB when they start
  useEffect(() => {
    currentOperations.forEach((op) => {
      // Find the original mutation to get the mutation ID
      const mutation = mutations.find((m) => {
        const meta = m.options.meta
        if (!meta) return false
        const mutationId = String(m.state.submittedAt || 0)
        return dbIdMap[mutationId] === op.id || mutationId === op.id
      })

      if (!mutation) return

      const mutationId = String(mutation.state.submittedAt || Date.now())

      // If pending and not yet saved to DB
      if (
        op.status === 'pending' &&
        !savedToDbIds.current.has(mutationId) &&
        !dbIdMap[mutationId]
      ) {
        if (!isAuthenticated) return

        savedToDbIds.current.add(mutationId)

        const meta = mutation.options.meta as MutationMeta
        const maxRetries =
          typeof mutation.options.retry === 'number'
            ? mutation.options.retry
            : mutation.options.retry === false
              ? 0
              : 3

        // Extract timestamp from variables for update operations to ensure consistency
        // For update operations, variables contain updatedAt field
        let startedAt: Date | undefined
        if (meta.operationType === 'update' && mutation.state.variables) {
          const vars = mutation.state.variables as { updatedAt?: Date }
          if (vars.updatedAt) {
            startedAt =
              vars.updatedAt instanceof Date
                ? vars.updatedAt
                : new Date(vars.updatedAt)
          }
        }
        // Fallback to meta timestamp if available
        if (!startedAt && meta.timestamp) {
          startedAt = new Date(meta.timestamp)
        }

        createActivityMutation.mutate({
          mutationId,
          operationType: meta.operationType,
          entityType: meta.entityType,
          entityName: meta.getEntityName(mutation.state.variables),
          entityId: meta.entityId,
          maxRetries,
          startedAt,
        })
      }
    })
  }, [
    currentOperations,
    mutations,
    dbIdMap,
    createActivityMutation,
    isAuthenticated,
  ])

  // Log failed operations to Sentry and update DB
  useEffect(() => {
    currentOperations.forEach((op) => {
      // Check if this is a failed operation that hasn't been logged to Sentry yet
      if (
        op.status === 'error' &&
        !sentryEventIds[op.id] &&
        !loggedToSentryIds.current.has(op.id)
      ) {
        // Get the original error from the mutation
        const mutation = mutations.find(
          (m) =>
            String(m.state.submittedAt) === op.id ||
            dbIdMap[String(m.state.submittedAt)] === op.id,
        )

        if (mutation?.state.error) {
          loggedToSentryIds.current.add(op.id)

          const eventId = logMutationFailureToSentry(
            mutation.state.error,
            op.type,
            op.entityType,
            op.entityId,
            op.variables,
            op.retryCount,
            op.maxRetries,
          )

          setSentryEventIds((prev) => ({ ...prev, [op.id]: eventId }))

          // Update DB with error info
          const dbId = dbIdMap[String(mutation.state.submittedAt)]
          if (dbId && !updatedInDbIds.current.has(dbId)) {
            updatedInDbIds.current.add(dbId)
            updateActivityMutation.mutate({
              id: dbId,
              status: 'error',
              errorMessage: getFriendlyErrorMessage(mutation.state.error),
              sentryEventId: eventId,
              retryCount: op.retryCount,
            })
          }
        }
      }
    })
  }, [
    currentOperations,
    mutations,
    sentryEventIds,
    dbIdMap,
    updateActivityMutation,
  ])

  // Update DB when operations complete successfully
  useEffect(() => {
    const currentlyPending = new Set<string>()

    currentOperations.forEach((op) => {
      // Find the mutation for this operation
      const mutation = mutations.find((m) => {
        const mutationId = String(m.state.submittedAt || 0)
        return dbIdMap[mutationId] === op.id || mutationId === op.id
      })

      if (!mutation) return

      const mutationId = String(mutation.state.submittedAt || 0)
      const dbId = dbIdMap[mutationId]

      if (op.status === 'pending') {
        currentlyPending.add(op.id)
      } else if (
        op.status === 'success' &&
        dbId &&
        previouslyPendingIds.current.has(op.id) &&
        !updatedInDbIds.current.has(dbId)
      ) {
        if (!isAuthenticated) return

        // Operation completed successfully - update DB
        updatedInDbIds.current.add(dbId)

        // Get the entityId from the mutation result if it's a create operation
        const meta = mutation.options.meta as MutationMeta
        let entityId = meta.entityId

        // For create operations, try to get the ID from the result
        if (op.type === 'create' && mutation.state.data) {
          const result = mutation.state.data as { id?: string }
          if (result.id) {
            entityId = result.id
          }
        }

        updateActivityMutation.mutate({
          id: dbId,
          status: 'success',
          entityId,
        })
      }
    })

    previouslyPendingIds.current = currentlyPending
  }, [
    currentOperations,
    mutations,
    dbIdMap,
    updateActivityMutation,
    isAuthenticated,
  ])

  // Pending operations (currently in flight)
  const pendingOperations = useMemo(
    () => currentOperations.filter((op) => op.status === 'pending'),
    [currentOperations],
  )

  // Build activity log from current pending + DB history
  const activityLog = useMemo((): Array<ActivityLogEntry> => {
    // Get IDs of currently pending operations
    const pendingIds = new Set(pendingOperations.map((op) => op.id))

    // Combine pending operations with DB history (excluding duplicates)
    const allOps = [
      ...pendingOperations,
      ...dbOperations.filter((h) => !pendingIds.has(h.id)),
    ]

    // Sort by startedAt descending (most recent first)
    const sorted = allOps.sort((a, b) => b.startedAt - a.startedAt)

    // Convert to log entries with relative times
    return sorted.map(operationToLogEntry)
  }, [pendingOperations, dbOperations])

  // Actions
  const openDrawer = useCallback(() => setIsDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [])
  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), [])

  const setSentryEventId = useCallback(
    (operationId: string, eventId: string) => {
      setSentryEventIds((prev) => ({ ...prev, [operationId]: eventId }))
    },
    [],
  )

  // Context value
  const value = useMemo(
    (): ExtendedOptimisticOperationsContextValue => ({
      operations: currentOperations,
      pendingCount: pendingOperations.length,
      hasPendingOperations: pendingOperations.length > 0,
      isDrawerOpen,
      activityLog,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      setSentryEventId,
      // Infinite scroll support
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isLoadingActivity: isAuthenticated
        ? isLoadingActivity || isSessionPending
        : false,
    }),
    [
      currentOperations,
      pendingOperations.length,
      isDrawerOpen,
      activityLog,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      setSentryEventId,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
      isLoadingActivity,
      isAuthenticated,
      isSessionPending,
    ],
  )

  return (
    <OptimisticOperationsContext.Provider value={value}>
      <MemoizedChildren>{children}</MemoizedChildren>
    </OptimisticOperationsContext.Provider>
  )
}

/**
 * Hook to access the optimistic operations context
 */
export function useOptimisticOperations(): ExtendedOptimisticOperationsContextValue {
  const context = useContext(OptimisticOperationsContext)
  if (!context) {
    throw new Error(
      'useOptimisticOperations must be used within an OptimisticOperationsProvider',
    )
  }
  return context
}

/**
 * Hook to get just the progress-related state
 */
export function useOptimisticProgress() {
  const { pendingCount, hasPendingOperations } = useOptimisticOperations()
  return { pendingCount, hasPendingOperations }
}

/**
 * Hook to get just the activity log with infinite scroll support
 */
export function useActivityLog() {
  const {
    activityLog,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoadingActivity,
  } = useOptimisticOperations()
  return {
    activityLog,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoadingActivity,
  }
}

/**
 * Hook to get drawer controls
 */
export function useActivityDrawer() {
  const { isDrawerOpen, openDrawer, closeDrawer, toggleDrawer } =
    useOptimisticOperations()
  return { isDrawerOpen, openDrawer, closeDrawer, toggleDrawer }
}
