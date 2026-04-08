import { createServerFn } from '@tanstack/react-start'
import * as Sentry from '@sentry/tanstackstart-react'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db'
import { lists, todos } from '../../db/schema'

import {
  createTodoSchema,
  todoWithRelationsQueryConfig,
  updateTodoSchema,
} from '../tasks'
import { isHttpErrorResponse, requireAuthSession, throwNotFound } from './auth'
import { PERF_THRESHOLDS, logIfSlow, serverLog } from './logging'
import type { Todo, TodoWithRelations } from '../tasks'

async function getOwnedList(userId: string, listId: string) {
  return db.query.lists.findFirst({
    where: and(eq(lists.id, listId), eq(lists.userId, userId)),
  })
}

async function getOwnedTodo(userId: string, todoId: string) {
  return db.query.todos.findFirst({
    where: and(eq(todos.id, todoId), eq(todos.userId, userId)),
  })
}

export const getTodos = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<TodoWithRelations>> => {
    return Sentry.startSpan({ name: 'getTodos', op: 'db.query' }, async () => {
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()

        const result = await db.query.todos.findMany({
          where: eq(todos.userId, session.user.id),
          with: todoWithRelationsQueryConfig,
          orderBy: [desc(todos.createdAt)],
        })

        logIfSlow('db.todos.findMany', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          count: result.length,
          userId: session.user.id,
        })

        serverLog.info('todo.list.fetched', {
          count: result.length,
          userId: session.user.id,
        })

        return result as Array<TodoWithRelations>
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('todo.list.failed', {
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'todos', operation: 'getTodos' },
        })
        throw error
      }
    })
  },
)

export const getTodoById = createServerFn({ method: 'GET' })
  .inputValidator(z.uuid())
  .handler(async (ctx): Promise<TodoWithRelations | undefined> => {
    return Sentry.startSpan({ name: 'getTodoById', op: 'db.query' }, async () => {
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()

        const result = await db.query.todos.findFirst({
          where: and(eq(todos.id, ctx.data), eq(todos.userId, session.user.id)),
          with: todoWithRelationsQueryConfig,
        })

        logIfSlow('db.todos.findFirst', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          todoId: ctx.data,
          found: !!result,
          userId: session.user.id,
        })

        if (!result) {
          serverLog.warn('todo.get.notFound', {
            todoId: ctx.data,
            userId: session.user.id,
          })
        }

        return result as TodoWithRelations | undefined
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('todo.get.failed', { todoId: ctx.data })
        Sentry.captureException(error, {
          tags: { component: 'todos', operation: 'getTodoById' },
          extra: { todoId: ctx.data },
        })
        throw error
      }
    })
  })

export const createTodo = createServerFn({ method: 'POST' })
  .inputValidator(createTodoSchema)
  .handler(async (ctx): Promise<TodoWithRelations> => {
    return Sentry.startSpan({ name: 'createTodo', op: 'db.insert' }, async () => {
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()
        const data = createTodoSchema.parse(ctx.data)

        if (data.listId) {
          const list = await getOwnedList(session.user.id, data.listId)
          if (!list) {
            throwNotFound('List not found')
          }
        }

        serverLog.info('todo.create.started', {
          priority: data.priority,
          hasListId: !!data.listId,
          hasDueDate: !!data.dueDate,
          hasDescription: !!data.description,
          userId: session.user.id,
        })

        const result = await db
          .insert(todos)
          .values({
            userId: session.user.id,
            name: data.name,
            description: data.description,
            priority: data.priority,
            dueDate: data.dueDate || null,
            listId: data.listId ?? null,
          })
          .returning()

        const newTodo = (result as Array<Todo>)[0]

        const todoWithRelations = await db.query.todos.findFirst({
          where: and(eq(todos.id, newTodo.id), eq(todos.userId, session.user.id)),
          with: todoWithRelationsQueryConfig,
        })

        if (!todoWithRelations) {
          throwNotFound('Todo not found')
        }

        const durationMs = Date.now() - startTime
        serverLog.info('todo.create.success', {
          todoId: newTodo.id,
          priority: newTodo.priority,
          hasListId: !!newTodo.listId,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.todos.insert', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          todoId: newTodo.id,
          userId: session.user.id,
        })

        return todoWithRelations as TodoWithRelations
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('todo.create.failed', {
          priority: ctx.data.priority,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'todos', operation: 'createTodo' },
          extra: { priority: ctx.data.priority, hasListId: !!ctx.data.listId },
        })
        throw error
      }
    })
  })

export const updateTodo = createServerFn({ method: 'POST' })
  .inputValidator(updateTodoSchema)
  .handler(async (ctx): Promise<TodoWithRelations> => {
    return Sentry.startSpan({ name: 'updateTodo', op: 'db.update' }, async () => {
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()
        const data = updateTodoSchema.parse(ctx.data)
        const { id, listId, updatedAt, ...updateData } = data

        const existingTodo = await getOwnedTodo(session.user.id, id)
        if (!existingTodo) {
          throwNotFound('Todo not found')
        }

        if (listId) {
          const list = await getOwnedList(session.user.id, listId)
          if (!list) {
            throwNotFound('List not found')
          }
        }

        const updatedFields = Object.keys(updateData).filter(
          (key) => updateData[key as keyof typeof updateData] !== undefined,
        )

        serverLog.info('todo.update.started', {
          todoId: id,
          updatedFields: updatedFields.join(','),
          hasListUpdate: listId !== undefined,
          userId: session.user.id,
        })

        const updateObject: Record<string, unknown> = Object.fromEntries(
          Object.entries(updateData as Record<string, unknown>).filter(
            ([, value]) => value !== undefined,
          ),
        )

        if (updatedAt !== undefined) {
          updateObject.updatedAt = updatedAt
        }

        if (listId !== undefined) {
          updateObject.listId = listId
        }

        await db
          .update(todos)
          .set(updateObject)
          .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))

        const todoWithRelations = await db.query.todos.findFirst({
          where: and(eq(todos.id, id), eq(todos.userId, session.user.id)),
          with: todoWithRelationsQueryConfig,
        })

        if (!todoWithRelations) {
          throwNotFound('Todo not found')
        }

        const durationMs = Date.now() - startTime
        serverLog.info('todo.update.success', {
          todoId: id,
          updatedFieldsCount: updatedFields.length,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.todos.update', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          todoId: id,
          userId: session.user.id,
        })

        return todoWithRelations as TodoWithRelations
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('todo.update.failed', {
          todoId: ctx.data.id,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'todos', operation: 'updateTodo' },
          extra: { todoId: ctx.data.id },
        })
        throw error
      }
    })
  })

export const toggleTodoComplete = createServerFn({ method: 'POST' })
  .inputValidator(z.uuid())
  .handler(async (ctx): Promise<Todo> => {
    return Sentry.startSpan({ name: 'toggleTodoComplete', op: 'db.update' }, async () => {
      const id = ctx.data
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()

        const todo = await getOwnedTodo(session.user.id, id)
        if (!todo) {
          serverLog.warn('todo.toggle.notFound', { todoId: id, userId: session.user.id })
          throwNotFound('Todo not found')
        }

        const result = await db
          .update(todos)
          .set({ isComplete: !todo.isComplete })
          .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))
          .returning()

        const updated = result[0] as Todo | undefined
        if (!updated) {
          throwNotFound('Todo not found')
        }

        serverLog.info('todo.status.changed', {
          todoId: id,
          fromComplete: todo.isComplete,
          toComplete: updated.isComplete,
          priority: todo.priority,
          userId: session.user.id,
        })

        logIfSlow('db.todos.toggle', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          todoId: id,
          userId: session.user.id,
        })

        return updated
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('todo.toggle.failed', {
          todoId: id,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'todos', operation: 'toggleTodoComplete' },
          extra: { todoId: id },
        })
        throw error
      }
    })
  })

export const deleteTodo = createServerFn({ method: 'POST' })
  .inputValidator(z.uuid())
  .handler(async (ctx): Promise<{ success: boolean; id: string }> => {
    return Sentry.startSpan({ name: 'deleteTodo', op: 'db.delete' }, async () => {
      const id = ctx.data
      const startTime = Date.now()

      try {
        const session = await requireAuthSession()

        serverLog.info('todo.delete.started', { todoId: id, userId: session.user.id })

        const deleted = await db
          .delete(todos)
          .where(and(eq(todos.id, id), eq(todos.userId, session.user.id)))
          .returning({ id: todos.id })

        if (deleted.length === 0) {
          throwNotFound('Todo not found')
        }

        const durationMs = Date.now() - startTime
        serverLog.info('todo.delete.success', {
          todoId: id,
          durationMs,
          userId: session.user.id,
        })

        logIfSlow('db.todos.delete', startTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          todoId: id,
          userId: session.user.id,
        })

        return { success: true, id }
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        serverLog.error('todo.delete.failed', {
          todoId: id,
          errorType: error instanceof Error ? error.name : 'Unknown',
        })
        Sentry.captureException(error, {
          tags: { component: 'todos', operation: 'deleteTodo' },
          extra: { todoId: id },
        })
        throw error
      }
    })
  })
