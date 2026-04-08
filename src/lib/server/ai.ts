import { getRequest } from '@tanstack/react-start/server'
import { createServerFn } from '@tanstack/react-start'
import * as Sentry from '@sentry/tanstackstart-react'
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { and, eq, gte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db'
import { anonymousAiUsage, lists, subtasks, todos } from '../../db/schema'

import {
  aiGeneratedTodoSchema,
  generateTodoInputSchema,
  todoWithRelationsQueryConfig,
} from '../tasks'
import { getIpFingerprint } from './request-ip'
import { isHttpErrorResponse, requireAuthSession } from './auth'
import { PERF_THRESHOLDS, logIfSlow, serverLog } from './logging'
import type { AIGeneratedTodo, TodoWithRelations } from '../tasks'

const AI_DAILY_LIMIT = 15
const UNLIMITED_EMAIL = '2aaronmolina@gmail.com'
const anonymousGenerateTodoInputSchema = generateTodoInputSchema.extend({
  availableLists: z.array(z.string().min(1).max(100)).max(50).default([]),
})

async function getTodaysAiCount(userId: string) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.aiGenerated, true), gte(todos.createdAt, startOfDay)))

  return count
}

async function getTodaysAnonymousAiCount(headers: Headers) {
  const dateKey = new Date().toISOString().slice(0, 10)
  const ipFingerprint = getIpFingerprint(headers)

  const record = await db.query.anonymousAiUsage.findFirst({
    where: and(eq(anonymousAiUsage.ipHash, ipFingerprint), eq(anonymousAiUsage.dateKey, dateKey)),
  })

  return {
    count: record?.count ?? 0,
    dateKey,
    ipFingerprint,
  }
}

async function incrementAnonymousAiCount(ipFingerprint: string, dateKey: string) {
  await db
    .insert(anonymousAiUsage)
    .values({
      ipHash: ipFingerprint,
      dateKey,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [anonymousAiUsage.ipHash, anonymousAiUsage.dateKey],
      set: {
        count: sql`${anonymousAiUsage.count} + 1`,
        updatedAt: new Date(),
      },
    })
}

function buildAiSystemPrompt(listNames: Array<string>) {
  const listOptions =
    listNames.length > 0
      ? listNames.map((list) => `- ${list}`).join('\n')
      : 'No lists available'

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })

  return `You are a helpful task assistant that creates well-structured todos from natural language descriptions.

Today is ${dayOfWeek}, ${todayStr}.

When creating a task:
1. NAME: Create a concise, actionable task name (start with a verb when appropriate)
2. DESCRIPTION: Add helpful details, context, or steps if the user's request implies them. Omit or use null if no description needed.
3. PRIORITY: Choose based on implied urgency:
   - low: routine tasks, nice-to-haves
   - medium: normal tasks, standard work items
   - high: important tasks that need attention soon
   - urgent: time-sensitive tasks that need immediate attention
   - critical: emergency tasks that must be done ASAP
4. DUE DATE: Parse relative dates (tomorrow, next Monday, in 3 days, end of week) into ISO 8601 format (YYYY-MM-DD). If no date is mentioned or implied, omit or use null.
5. LISTS: Match to available lists below. If none match well, return an empty array.
6. SUBTASKS: Subtasks are simple checklist items with just a name (no description, priority, or date). If the user mentions multiple items that should be tracked separately, create subtasks for each item. Examples:
   - "Buy groceries tomorrow - milk, eggs, and bread" → Main task: "Buy groceries", Subtasks: [{name: "Buy milk"}, {name: "Buy eggs"}, {name: "Buy bread"}]
   - "Call mom" → No subtasks (single action), subtasks: []
   - Only create subtasks when there are clearly multiple distinct items/actions to track.

Available lists:
${listOptions}

Return a well-structured task based on the user's input.`
}

async function generateStructuredTodo(prompt: string, listNames: Array<string>, userId: string) {
  const systemPrompt = buildAiSystemPrompt(listNames)
  const aiStartTime = Date.now()

  serverLog.info('ai.openai.request.started', {
    model: 'gpt-4.1-nano',
    promptTokenEstimate: Math.ceil(prompt.length / 4),
    systemPromptLength: systemPrompt.length,
    userId,
  })

  const result = await chat({
    adapter: openaiText('gpt-4.1-nano'),
    systemPrompts: [systemPrompt],
    messages: [{ role: 'user', content: prompt }],
    outputSchema: aiGeneratedTodoSchema,
  })

  const aiDurationMs = Date.now() - aiStartTime

  serverLog.info('ai.openai.request.completed', {
    durationMs: aiDurationMs,
    generatedPriority: result.priority,
    hasDueDate: !!result.dueDate,
    subtasksCount: result.subtasks.length,
    suggestedListsCount: result.suggestedLists.length,
    userId,
  })

  if (aiDurationMs > PERF_THRESHOLDS.AI_OPERATION_SLOW) {
    serverLog.warn('ai.openai.request.slow', {
      durationMs: aiDurationMs,
      thresholdMs: PERF_THRESHOLDS.AI_OPERATION_SLOW,
    })
  }

  return result
}

export const getAIUsage = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireAuthSession()
  const isAnonymous = (session.user as { isAnonymous?: boolean }).isAnonymous === true

  if (isAnonymous) {
    const request = getRequest()
    const { count, ipFingerprint } = await getTodaysAnonymousAiCount(request.headers)

    return { used: count, limit: AI_DAILY_LIMIT, unlimited: false, ipFingerprint }
  }

  const unlimited = session.user.email === UNLIMITED_EMAIL
  const used = await getTodaysAiCount(session.user.id)

  return { used, limit: AI_DAILY_LIMIT, unlimited }
})

export const generateTodoWithAI = createServerFn({ method: 'POST' })
  .inputValidator((data) => {
    const result = generateTodoInputSchema.safeParse(data)
    if (!result.success) {
      const errorMessages = result.error.issues
        .map((issue) => `${String(issue.path.join('.'))}: ${issue.message}`)
        .join(', ')

      serverLog.warn('ai.input.validation.failed', {
        errorCount: result.error.issues.length,
        fields: result.error.issues.map((i) => String(i.path.join('.'))).join(','),
      })

      const error = new Error(`Input validation failed: ${errorMessages}`)
      Sentry.captureException(error, {
        tags: { component: 'ai', action: 'inputValidation' },
        extra: { inputData: data, validationErrors: result.error.format() },
      })
      throw error
    }
    return result.data
  })
  .handler(async (ctx): Promise<TodoWithRelations> => {
    return Sentry.startSpan({ name: 'generateTodoWithAI', op: 'ai.generate' }, async () => {
      const startTime = Date.now()
      const { prompt } = ctx.data

      try {
        const session = await requireAuthSession()
        const availableLists = await db.query.lists.findMany({
          where: eq(lists.userId, session.user.id),
        })

        if (session.user.email !== UNLIMITED_EMAIL) {
          const todayCount = await getTodaysAiCount(session.user.id)

          if (todayCount >= AI_DAILY_LIMIT) {
            serverLog.warn('ai.dailyLimit.exceeded', {
              userEmail: session.user.email,
              todayCount,
              limit: AI_DAILY_LIMIT,
            })
            throw new Error('AI_DAILY_LIMIT_EXCEEDED')
          }
        }

        serverLog.info('ai.generation.started', {
          promptLength: prompt.length,
          availableListsCount: availableLists.length,
          userId: session.user.id,
        })
        const result = await generateStructuredTodo(
          prompt,
          availableLists.map((list) => list.name),
          session.user.id,
        )

        const listIds: Array<string> = []
        if (result.suggestedLists.length > 0) {
          for (const suggestedName of result.suggestedLists) {
            const matchedList = availableLists.find(
              (list) => list.name.toLowerCase() === suggestedName.toLowerCase(),
            )
            if (matchedList) {
              listIds.push(matchedList.id)
            }
          }

          serverLog.info('ai.lists.matched', {
            suggestedCount: result.suggestedLists.length,
            matchedCount: listIds.length,
            userId: session.user.id,
          })
        }

        let dueDate: Date | null = null
        if (result.dueDate) {
          const parsed = new Date(result.dueDate)
          if (!isNaN(parsed.getTime())) {
            dueDate = parsed
          } else {
            serverLog.warn('ai.dueDate.parseError', {
              rawDueDate: result.dueDate,
              userId: session.user.id,
            })
          }
        }

        const dbStartTime = Date.now()

        const insertResult = await db
          .insert(todos)
          .values({
            userId: session.user.id,
            name: result.name,
            description: result.description || '',
            priority: result.priority,
            dueDate,
            listId: listIds.length > 0 ? listIds[0] : null,
            aiGenerated: true,
          })
          .returning()

        if (!Array.isArray(insertResult) || insertResult.length === 0) {
          serverLog.error('ai.todo.insert.noResult', {
            prompt: prompt.substring(0, 100),
            userId: session.user.id,
          })
          throw new Error('Failed to create todo - no result returned')
        }

        const newTodo = insertResult[0]

        if (result.subtasks.length > 0) {
          await db.insert(subtasks).values(
            result.subtasks.map((subtask, index) => ({
              name: subtask.name,
              todoId: newTodo.id,
              isComplete: false,
              orderIndex: index.toString(),
            })),
          )

          serverLog.info('ai.subtasks.created', {
            todoId: newTodo.id,
            count: result.subtasks.length,
            userId: session.user.id,
          })
        }

        logIfSlow('db.ai.insert', dbStartTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          todoId: newTodo.id,
          hasSubtasks: result.subtasks.length > 0,
          userId: session.user.id,
        })

        const todoWithRelations = await db.query.todos.findFirst({
          where: and(eq(todos.id, newTodo.id), eq(todos.userId, session.user.id)),
          with: todoWithRelationsQueryConfig,
        })

        if (!todoWithRelations) {
          serverLog.error('ai.todo.fetch.notFound', {
            todoId: newTodo.id,
            userId: session.user.id,
          })
          throw new Error('Failed to fetch created todo')
        }

        const totalDurationMs = Date.now() - startTime

        serverLog.info('ai.generation.completed', {
          todoId: newTodo.id,
          priority: newTodo.priority,
          hasListId: !!newTodo.listId,
          hasDueDate: !!newTodo.dueDate,
          subtasksCount: result.subtasks.length,
          aiDurationMs,
          totalDurationMs,
          userId: session.user.id,
        })

        return todoWithRelations as TodoWithRelations
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        const durationMs = Date.now() - startTime

        serverLog.error('ai.generation.failed', {
          promptLength: prompt.length,
          durationMs,
          errorType: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })

        Sentry.captureException(error, {
          tags: { component: 'ai', action: 'generateTodoWithAI' },
          extra: { promptLength: prompt.length, durationMs },
        })

        const errMsg = error instanceof Error ? error.message : String(error)
        if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
          throw new Error('AI_QUOTA_EXCEEDED')
        }
        throw new Error('AI_GENERATION_FAILED')
      }
    })
  })

export const generateAnonymousTodoWithAI = createServerFn({ method: 'POST' })
  .inputValidator(anonymousGenerateTodoInputSchema)
  .handler(async (ctx): Promise<AIGeneratedTodo> => {
    return Sentry.startSpan({ name: 'generateAnonymousTodoWithAI', op: 'ai.generate' }, async () => {
      const startTime = Date.now()
      const session = await requireAuthSession()
      const isAnonymous = (session.user as { isAnonymous?: boolean }).isAnonymous === true

      if (!isAnonymous) {
        throw new Response('Forbidden', { status: 403 })
      }

      try {
        const request = getRequest()
        const { count, dateKey, ipFingerprint } = await getTodaysAnonymousAiCount(request.headers)

        if (count >= AI_DAILY_LIMIT) {
          serverLog.warn('ai.dailyLimit.exceeded.ip', {
            ipFingerprint,
            todayCount: count,
            limit: AI_DAILY_LIMIT,
          })
          throw new Error('AI_DAILY_LIMIT_EXCEEDED')
        }

        serverLog.info('ai.generation.started.ip', {
          promptLength: ctx.data.prompt.length,
          availableListsCount: ctx.data.availableLists.length,
          ipFingerprint,
          userId: session.user.id,
        })

        const generated = await generateStructuredTodo(
          ctx.data.prompt,
          ctx.data.availableLists,
          session.user.id,
        )

        await incrementAnonymousAiCount(ipFingerprint, dateKey)

        serverLog.info('ai.generation.completed.ip', {
          promptLength: ctx.data.prompt.length,
          ipFingerprint,
          totalDurationMs: Date.now() - startTime,
          userId: session.user.id,
        })

        return generated
      } catch (error) {
        if (isHttpErrorResponse(error)) {
          throw error
        }

        const durationMs = Date.now() - startTime

        serverLog.error('ai.generation.failed.ip', {
          promptLength: ctx.data.prompt.length,
          durationMs,
          errorType: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })

        Sentry.captureException(error, {
          tags: { component: 'ai', action: 'generateAnonymousTodoWithAI' },
          extra: { promptLength: ctx.data.prompt.length, durationMs },
        })

        const errMsg = error instanceof Error ? error.message : String(error)
        if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
          throw new Error('AI_QUOTA_EXCEEDED')
        }
        throw error instanceof Error ? error : new Error('AI_GENERATION_FAILED')
      }
    })
  })
