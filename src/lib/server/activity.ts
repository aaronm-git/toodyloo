/**
 * Activity Log Server Functions
 *
 * Handles CRUD operations for persisting activity logs to the database.
 * These functions are used by the optimistic operations context to
 * maintain a persistent activity history.
 *
 * Uses cursor-based pagination for efficient infinite scroll.
 */

import { createServerFn } from '@tanstack/react-start'
import * as Sentry from '@sentry/tanstackstart-react'
import { and, desc, eq, lt } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db'
import { activityLogs } from '../../db/schema'

import { isHttpErrorResponse, requireAuthSession, throwNotFound } from './auth'
import { PERF_THRESHOLDS, logIfSlow, serverLog } from './logging'

const createActivitySchema = z.object({
  operationType: z.enum(['create', 'update', 'delete']),
  entityType: z.enum(['todo', 'subtask', 'list', 'ai-todo']),
  entityId: z.string().nullable().optional(),
  entityName: z.string(),
  maxRetries: z.number().default(3),
  startedAt: z.date().optional(),
})

const updateActivitySchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'success', 'error']),
  entityId: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  sentryEventId: z.string().nullable().optional(),
  retryCount: z.number().optional(),
  completedAt: z.date().optional(),
})

const getActivityLogsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().nullable().optional(),
})

export type CreateActivityInput = z.infer<typeof createActivitySchema>
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>
export type GetActivityLogsInput = z.infer<typeof getActivityLogsSchema>

export interface ActivityLogRecord {
  id: string
  operationType: 'create' | 'update' | 'delete'
  entityType: 'todo' | 'subtask' | 'list' | 'ai-todo'
  entityId: string | null
  entityName: string
  status: 'pending' | 'success' | 'error'
  errorMessage: string | null
  sentryEventId: string | null
  retryCount: number
  maxRetries: number
  startedAt: Date
  completedAt: Date | null
  userId: string
}

export interface ActivityLogsPage {
  items: Array<ActivityLogRecord>
  nextCursor: string | null
  hasMore: boolean
}

export const createActivityLog = createServerFn({ method: 'POST' })
  .inputValidator(createActivitySchema)
  .handler(async (ctx): Promise<ActivityLogRecord> => {
    return Sentry.startSpan({ name: 'createActivityLog', op: 'db.insert' }, async () => {
      const startTime = Date.now()
      const { operationType, entityType, entityId, entityName, maxRetries, startedAt } = ctx.data

      try {
        const session = await requireAuthSession()

        const insertValues = {
          operationType,
          entityType,
          entityId: entityId || null,
          entityName,
          status: 'pending' as const,
          maxRetries: String(maxRetries),
          userId: session.user.id,
          ...(startedAt ? { startedAt } : {}),
        }

        const [result] = await db.insert(activityLogs).values(insertValues).returning()

        const durationMs = Date.now() - startTime
        serverLog.info('activity.log.created', {
          activityId: result.id,
          operationType,
          entityType,
          hasEntityId: !!entityId,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.activityLogs.insert', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          activityId: result.id,
          userId: session.user.id,
        })

        return {
          ...result,
          retryCount: Number(result.retryCount),
          maxRetries: Number(result.maxRetries),
        } as ActivityLogRecord
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('activity.log.create.failed', {
          operationType,
          entityType,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'activity', operation: 'createActivityLog' },
          extra: { operationType, entityType },
        })
        throw error
      }
    })
  })

export const updateActivityLog = createServerFn({ method: 'POST' })
  .inputValidator(updateActivitySchema)
  .handler(async (ctx): Promise<ActivityLogRecord> => {
    return Sentry.startSpan({ name: 'updateActivityLog', op: 'db.update' }, async () => {
      const startTime = Date.now()
      const { id, status, entityId, errorMessage, sentryEventId, retryCount, completedAt } =
        ctx.data

      try {
        const session = await requireAuthSession()

        const updateData: Record<string, unknown> = { status }

        if (entityId !== undefined) updateData.entityId = entityId
        if (errorMessage !== undefined) updateData.errorMessage = errorMessage
        if (sentryEventId !== undefined) updateData.sentryEventId = sentryEventId
        if (retryCount !== undefined) updateData.retryCount = String(retryCount)
        if (completedAt !== undefined) updateData.completedAt = completedAt

        if ((status === 'success' || status === 'error') && completedAt === undefined) {
          updateData.completedAt = new Date()
        }

        const results = await db
          .update(activityLogs)
          .set(updateData)
          .where(and(eq(activityLogs.id, id), eq(activityLogs.userId, session.user.id)))
          .returning()

        if (results.length === 0) {
          throwNotFound(`Activity log entry ${id} not found`)
        }
        const result = results[0]

        const durationMs = Date.now() - startTime
        serverLog.info('activity.log.updated', {
          activityId: id,
          status,
          hasError: !!errorMessage,
          hasSentryEventId: !!sentryEventId,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.activityLogs.update', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          activityId: id,
          userId: session.user.id,
        })

        return {
          ...result,
          retryCount: Number(result.retryCount),
          maxRetries: Number(result.maxRetries),
        } as ActivityLogRecord
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('activity.log.update.failed', {
          activityId: id,
          status,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'activity', operation: 'updateActivityLog' },
          extra: { activityId: id, status },
        })
        throw error
      }
    })
  })

export const getActivityLogs = createServerFn({ method: 'GET' })
  .inputValidator(getActivityLogsSchema)
  .handler(async (ctx): Promise<ActivityLogsPage> => {
    return Sentry.startSpan({ name: 'getActivityLogs', op: 'db.query' }, async () => {
      const startTime = Date.now()
      const { limit, cursor } = ctx.data

      try {
        const session = await requireAuthSession()

        const conditions = cursor
          ? and(
              eq(activityLogs.userId, session.user.id),
              lt(activityLogs.startedAt, new Date(cursor)),
            )
          : eq(activityLogs.userId, session.user.id)

        const results = await db
          .select()
          .from(activityLogs)
          .where(conditions)
          .orderBy(desc(activityLogs.startedAt))
          .limit(limit + 1)

        const hasMore = results.length > limit
        const items = hasMore ? results.slice(0, limit) : results
        const nextCursor =
          hasMore && items.length > 0 ? items[items.length - 1].startedAt.toISOString() : null

        logIfSlow('db.activityLogs.findMany', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          limit,
          hasCursor: !!cursor,
          returnedCount: items.length,
          userId: session.user.id,
        })

        serverLog.info('activity.logs.fetched', {
          count: items.length,
          hasMore,
          hasCursor: !!cursor,
          userId: session.user.id,
        })

        return {
          items: items.map((record) => ({
            ...record,
            retryCount: Number(record.retryCount),
            maxRetries: Number(record.maxRetries),
          })) as Array<ActivityLogRecord>,
          nextCursor,
          hasMore,
        }
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('activity.logs.fetch.failed', {
          limit,
          hasCursor: !!cursor,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'activity', operation: 'getActivityLogs' },
          extra: { limit, hasCursor: !!cursor },
        })
        throw error
      }
    })
  })

export const cleanupActivityLogs = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      olderThanDays: z.number().default(7),
    }),
  )
  .handler(async (ctx): Promise<{ deleted: number }> => {
    return Sentry.startSpan({ name: 'cleanupActivityLogs', op: 'db.delete' }, async () => {
      const startTime = Date.now()
      const { olderThanDays } = ctx.data

      try {
        const session = await requireAuthSession()
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

        serverLog.info('activity.cleanup.started', {
          olderThanDays,
          cutoffDate: cutoffDate.toISOString(),
          userId: session.user.id,
        })

        const result = await db
          .delete(activityLogs)
          .where(
            and(
              eq(activityLogs.userId, session.user.id),
              lt(activityLogs.startedAt, cutoffDate),
              eq(activityLogs.status, 'success'),
            ),
          )
          .returning({ id: activityLogs.id })

        const durationMs = Date.now() - startTime
        serverLog.info('activity.cleanup.completed', {
          deleted: result.length,
          olderThanDays,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.activityLogs.cleanup', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          deleted: result.length,
          userId: session.user.id,
        })

        return { deleted: result.length }
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('activity.cleanup.failed', {
          olderThanDays,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'activity', operation: 'cleanupActivityLogs' },
          extra: { olderThanDays },
        })
        throw error
      }
    })
  })
