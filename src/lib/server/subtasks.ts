import { createServerFn } from '@tanstack/react-start'
import * as Sentry from '@sentry/tanstackstart-react'
import { z } from 'zod'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { subtasks, todos } from '../../db/schema'

import { createSubtaskSchema, updateSubtaskSchema } from '../tasks'
import { isHttpErrorResponse, requireAuthSession, throwNotFound } from './auth'
import { PERF_THRESHOLDS, logIfSlow, serverLog } from './logging'
import type { Subtask } from '../tasks'

async function getOwnedTodo(userId: string, todoId: string) {
  return db.query.todos.findFirst({
    where: and(eq(todos.id, todoId), eq(todos.userId, userId)),
  })
}

async function getOwnedSubtask(userId: string, subtaskId: string) {
  const results = await db
    .select({
      id: subtasks.id,
      isComplete: subtasks.isComplete,
      todoId: subtasks.todoId,
    })
    .from(subtasks)
    .innerJoin(todos, eq(subtasks.todoId, todos.id))
    .where(and(eq(subtasks.id, subtaskId), eq(todos.userId, userId)))

  return results[0] as
    | {
        id: string
        isComplete: boolean
        todoId: string
      }
    | undefined
}

export const getSubtasksForTodo = createServerFn({ method: 'GET' })
  .inputValidator(z.uuid())
  .handler(async (ctx): Promise<Array<Subtask>> => {
    return Sentry.startSpan({ name: 'getSubtasksForTodo', op: 'db.query' }, async () => {
      const startTime = Date.now()
      const todoId = ctx.data

      try {
        const session = await requireAuthSession()
        const ownedTodo = await getOwnedTodo(session.user.id, todoId)

        if (!ownedTodo) {
          throwNotFound('Todo not found')
        }

        const result = await db.query.subtasks.findMany({
          where: eq(subtasks.todoId, todoId),
          orderBy: [asc(subtasks.orderIndex), asc(subtasks.createdAt), asc(subtasks.id)],
        })

        logIfSlow('db.subtasks.findMany', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          todoId,
          count: result.length,
          userId: session.user.id,
        })

        serverLog.info('subtask.list.fetched', {
          todoId,
          count: result.length,
          userId: session.user.id,
        })

        return result as Array<Subtask>
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('subtask.list.failed', {
          todoId,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'subtasks', operation: 'getSubtasksForTodo' },
          extra: { todoId },
        })
        throw error
      }
    })
  })

export const createSubtask = createServerFn({ method: 'POST' })
  .inputValidator(createSubtaskSchema)
  .handler(async (ctx): Promise<Subtask> => {
    return Sentry.startSpan({ name: 'createSubtask', op: 'db.insert' }, async () => {
      const startTime = Date.now()
      const data = ctx.data

      try {
        const session = await requireAuthSession()
        const ownedTodo = await getOwnedTodo(session.user.id, data.todoId)

        if (!ownedTodo) {
          throwNotFound('Todo not found')
        }

        serverLog.info('subtask.create.started', {
          todoId: data.todoId,
          hasOrderIndex: !!data.orderIndex,
          userId: session.user.id,
        })

        const result = await db
          .insert(subtasks)
          .values({
            name: data.name,
            todoId: data.todoId,
            orderIndex: data.orderIndex || new Date().toISOString(),
            isComplete: false,
          })
          .returning()

        const newSubtask = result[0] as Subtask

        const durationMs = Date.now() - startTime
        serverLog.info('subtask.create.success', {
          subtaskId: newSubtask.id,
          todoId: data.todoId,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.subtasks.insert', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          subtaskId: newSubtask.id,
          userId: session.user.id,
        })

        return newSubtask
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('subtask.create.failed', {
          todoId: data.todoId,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'subtasks', operation: 'createSubtask' },
          extra: { todoId: data.todoId },
        })
        throw error
      }
    })
  })

export const updateSubtask = createServerFn({ method: 'POST' })
  .inputValidator(updateSubtaskSchema)
  .handler(async (ctx): Promise<Subtask> => {
    return Sentry.startSpan({ name: 'updateSubtask', op: 'db.update' }, async () => {
      const startTime = Date.now()
      const { id, ...updateData } = ctx.data

      try {
        const session = await requireAuthSession()
        const existingSubtask = await getOwnedSubtask(session.user.id, id)

        if (existingSubtask === undefined) {
          throwNotFound('Subtask not found')
        }

        const updatedFields = Object.keys(updateData).filter(
          (key) => updateData[key as keyof typeof updateData] !== undefined,
        )

        serverLog.info('subtask.update.started', {
          subtaskId: id,
          updatedFields: updatedFields.join(','),
          userId: session.user.id,
        })

        const cleanData = Object.fromEntries(
          Object.entries(updateData as Record<string, unknown>).filter(
            ([, value]) => value !== undefined,
          ),
        )

        const result = await db
          .update(subtasks)
          .set(cleanData)
          .where(eq(subtasks.id, id))
          .returning()

        const updatedSubtask = result[0] as Subtask | undefined
        if (!updatedSubtask) {
          throwNotFound('Subtask not found')
        }

        const durationMs = Date.now() - startTime
        serverLog.info('subtask.update.success', {
          subtaskId: id,
          updatedFieldsCount: updatedFields.length,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.subtasks.update', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          subtaskId: id,
          userId: session.user.id,
        })

        return updatedSubtask
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('subtask.update.failed', {
          subtaskId: id,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'subtasks', operation: 'updateSubtask' },
          extra: { subtaskId: id },
        })
        throw error
      }
    })
  })

export const toggleSubtaskComplete = createServerFn({ method: 'POST' })
  .inputValidator(z.uuid())
  .handler(async (ctx): Promise<Subtask> => {
    return Sentry.startSpan({ name: 'toggleSubtaskComplete', op: 'db.update' }, async () => {
      const id = ctx.data
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()
        const current = await getOwnedSubtask(session.user.id, id)

        if (current === undefined) {
          serverLog.warn('subtask.toggle.notFound', {
            subtaskId: id,
            userId: session.user.id,
          })
          throwNotFound('Subtask not found')
        }

        const result = await db
          .update(subtasks)
          .set({ isComplete: !current.isComplete })
          .where(eq(subtasks.id, id))
          .returning()

        const updatedSubtask = result[0] as Subtask | undefined
        if (!updatedSubtask) {
          throwNotFound('Subtask not found')
        }

        serverLog.info('subtask.status.changed', {
          subtaskId: id,
          fromComplete: current.isComplete,
          toComplete: updatedSubtask.isComplete,
          userId: session.user.id,
        })

        logIfSlow('db.subtasks.toggle', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          subtaskId: id,
          userId: session.user.id,
        })

        return updatedSubtask
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('subtask.toggle.failed', {
          subtaskId: id,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'subtasks', operation: 'toggleSubtaskComplete' },
          extra: { subtaskId: id },
        })
        throw error
      }
    })
  })

export const deleteSubtask = createServerFn({ method: 'POST' })
  .inputValidator(z.uuid())
  .handler(async (ctx): Promise<void> => {
    return Sentry.startSpan({ name: 'deleteSubtask', op: 'db.delete' }, async () => {
      const id = ctx.data
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()
        const existingSubtask = await getOwnedSubtask(session.user.id, id)

        if (existingSubtask === undefined) {
          throwNotFound('Subtask not found')
        }

        serverLog.info('subtask.delete.started', {
          subtaskId: id,
          userId: session.user.id,
        })

        await db.delete(subtasks).where(eq(subtasks.id, id))

        const durationMs = Date.now() - startTime
        serverLog.info('subtask.delete.success', {
          subtaskId: id,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.subtasks.delete', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          subtaskId: id,
          userId: session.user.id,
        })
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('subtask.delete.failed', {
          subtaskId: id,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'subtasks', operation: 'deleteSubtask' },
          extra: { subtaskId: id },
        })
        throw error
      }
    })
  })
