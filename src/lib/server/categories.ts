import { createServerFn } from '@tanstack/react-start'
import * as Sentry from '@sentry/tanstackstart-react'
import { z } from 'zod'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '../../db'
import { lists, todos } from '../../db/schema'

import {  createListSchema, updateListSchema } from '../tasks'
import { isHttpErrorResponse, requireAuthSession, throwNotFound } from './auth'
import { PERF_THRESHOLDS, logIfSlow, serverLog } from './logging'
import type {ListWithCount} from '../tasks';

async function getTodoCount(userId: string, listId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.listId, listId)))

  return Number(result.count || 0)
}

export const getLists = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<ListWithCount>> => {
    return Sentry.startSpan({ name: 'getLists', op: 'db.query' }, async () => {
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()

        const allLists = await db.query.lists.findMany({
          where: eq(lists.userId, session.user.id),
          orderBy: [asc(lists.name)],
        })

        const listsWithCounts = await Promise.all(
          allLists.map(async (list) => ({
            ...list,
            todoCount: await getTodoCount(session.user.id, list.id),
          })),
        )

        logIfSlow('db.lists.findMany', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          count: allLists.length,
          userId: session.user.id,
        })

        serverLog.info('list.list.fetched', {
          count: allLists.length,
          userId: session.user.id,
        })

        return listsWithCounts
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('list.list.failed', {
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'lists', operation: 'getLists' },
        })
        throw error
      }
    })
  },
)

export const getListById = createServerFn({ method: 'GET' })
  .inputValidator(z.uuid())
  .handler(async (ctx): Promise<ListWithCount> => {
    return Sentry.startSpan({ name: 'getListById', op: 'db.query' }, async () => {
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()

        const list = await db.query.lists.findFirst({
          where: and(eq(lists.id, ctx.data), eq(lists.userId, session.user.id)),
        })

        if (!list) {
          serverLog.warn('list.get.notFound', {
            listId: ctx.data,
            userId: session.user.id,
          })
          throwNotFound('List not found')
        }

        const todoCount = await getTodoCount(session.user.id, list.id)

        logIfSlow('db.lists.findFirst', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          listId: ctx.data,
          userId: session.user.id,
        })

        return {
          ...list,
          todoCount,
        }
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('list.get.failed', { listId: ctx.data })
        Sentry.captureException(error, {
          tags: { component: 'lists', operation: 'getListById' },
          extra: { listId: ctx.data },
        })
        throw error
      }
    })
  })

export const createList = createServerFn({ method: 'POST' })
  .inputValidator(createListSchema)
  .handler(async (ctx): Promise<ListWithCount> => {
    return Sentry.startSpan({ name: 'createList', op: 'db.insert' }, async () => {
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()
        const data = createListSchema.parse(ctx.data)

        serverLog.info('list.create.started', {
          hasColor: !!data.color,
          userId: session.user.id,
        })

        const [newList] = await db
          .insert(lists)
          .values({
            userId: session.user.id,
            name: data.name,
            color: data.color,
          })
          .returning()

        const durationMs = Date.now() - startTime
        serverLog.info('list.create.success', {
          listId: newList.id,
          hasColor: !!newList.color,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.lists.insert', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          listId: newList.id,
          userId: session.user.id,
        })

        return {
          ...newList,
          todoCount: 0,
        }
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('list.create.failed', {
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'lists', operation: 'createList' },
        })
        throw error
      }
    })
  })

export const updateList = createServerFn({ method: 'POST' })
  .inputValidator(updateListSchema)
  .handler(async (ctx): Promise<ListWithCount> => {
    return Sentry.startSpan({ name: 'updateList', op: 'db.update' }, async () => {
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()
        const data = updateListSchema.parse(ctx.data)
        const { id, ...updateData } = data

        const existing = await db.query.lists.findFirst({
          where: and(eq(lists.id, id), eq(lists.userId, session.user.id)),
        })

        if (!existing) {
          throwNotFound('List not found')
        }

        const updatedFields = Object.keys(updateData).filter(
          (key) => updateData[key as keyof typeof updateData] !== undefined,
        )

        serverLog.info('list.update.started', {
          listId: id,
          updatedFields: updatedFields.join(','),
          userId: session.user.id,
        })

        const results = await db
          .update(lists)
          .set(updateData)
          .where(and(eq(lists.id, id), eq(lists.userId, session.user.id)))
          .returning()

        if (results.length === 0) {
          throwNotFound('List not found')
        }
        const updated = results[0]

        const todoCount = await getTodoCount(session.user.id, id)

        const durationMs = Date.now() - startTime
        serverLog.info('list.update.success', {
          listId: id,
          updatedFieldsCount: updatedFields.length,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.lists.update', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          listId: id,
          userId: session.user.id,
        })

        return {
          ...updated,
          todoCount,
        }
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('list.update.failed', {
          listId: ctx.data.id,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'lists', operation: 'updateList' },
          extra: { listId: ctx.data.id },
        })
        throw error
      }
    })
  })

export const deleteList = createServerFn({ method: 'POST' })
  .inputValidator(z.uuid())
  .handler(async (ctx): Promise<{ success: boolean; id: string }> => {
    return Sentry.startSpan({ name: 'deleteList', op: 'db.delete' }, async () => {
      const id = ctx.data
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()
        const todoCount = await getTodoCount(session.user.id, id)

        serverLog.info('list.delete.started', {
          listId: id,
          affectedTodos: todoCount,
          userId: session.user.id,
        })

        const deleted = await db
          .delete(lists)
          .where(and(eq(lists.id, id), eq(lists.userId, session.user.id)))
          .returning({ id: lists.id })

        if (deleted.length === 0) {
          throwNotFound('List not found')
        }

        const durationMs = Date.now() - startTime
        serverLog.info('list.delete.success', {
          listId: id,
          affectedTodos: todoCount,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.lists.delete', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          listId: id,
          userId: session.user.id,
        })

        return { success: true, id }
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('list.delete.failed', {
          listId: id,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'lists', operation: 'deleteList' },
          extra: { listId: id },
        })
        throw error
      }
    })
  })
