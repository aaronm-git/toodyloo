import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import * as Sentry from '@sentry/tanstackstart-react'
import { chat } from '@tanstack/ai'
import { openaiText } from '@tanstack/ai-openai'
import { db } from '../../db'
import { todos, subtasks } from '../../db/schema'
import { eq, and, gte, sql } from 'drizzle-orm'
import { auth } from '../auth'

// Import schemas from single source of truth
import {
  generateTodoInputSchema,
  aiGeneratedTodoSchema,
  todoWithRelationsQueryConfig,
  type TodoWithRelations,
  type Priority,
} from '../tasks'

import { serverLog, PERF_THRESHOLDS, logIfSlow } from './logging'

const AI_DAILY_LIMIT = 15
const UNLIMITED_EMAIL = '2aaronmolina@gmail.com'

// Get AI usage stats for the current user
export const getAIUsage = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return { used: 0, limit: AI_DAILY_LIMIT, unlimited: false }
    }

    const unlimited = session.user.email === UNLIMITED_EMAIL

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(todos)
      .where(
        and(
          eq(todos.aiGenerated, true),
          gte(todos.createdAt, startOfDay),
        ),
      )

    return { used: count, limit: AI_DAILY_LIMIT, unlimited }
  })

// Generate and create a todo using AI
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
      const { prompt, lists: availableLists } = ctx.data

      // Authenticate and enforce daily rate limit
      const request = getRequest()
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session?.user) {
        throw new Error('AI_AUTH_REQUIRED')
      }

      if (session.user.email !== UNLIMITED_EMAIL) {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const [{ count: todayCount }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(todos)
          .where(
            and(
              eq(todos.aiGenerated, true),
              gte(todos.createdAt, startOfDay),
            ),
          )

        if (todayCount >= AI_DAILY_LIMIT) {
          serverLog.warn('ai.dailyLimit.exceeded', {
            userEmail: session.user.email,
            todayCount,
            limit: AI_DAILY_LIMIT,
          })
          throw new Error('AI_DAILY_LIMIT_EXCEEDED')
        }
      }

      try {
        serverLog.info('ai.generation.started', {
          promptLength: prompt.length,
          availableListsCount: availableLists.length,
        })

        // Build list options for the system prompt
        const listOptions =
          availableLists.length > 0
            ? availableLists.map((c) => `- ${c.name}`).join('\n')
            : 'No lists available'

        // Get today's date for context
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]
        const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })

        const systemPrompt = `You are a helpful task assistant that creates well-structured todos from natural language descriptions.

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

        // Track AI API call timing
        const aiStartTime = Date.now()

        serverLog.info('ai.openai.request.started', {
          model: 'gpt-4.1-nano',
          promptTokenEstimate: Math.ceil(prompt.length / 4),
          systemPromptLength: systemPrompt.length,
        })

        // Use TanStack AI with outputSchema for structured output
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
          subtasksCount: result.subtasks?.length ?? 0,
          suggestedListsCount: result.suggestedLists?.length ?? 0,
        })

        // Warn if AI call was slow
        if (aiDurationMs > PERF_THRESHOLDS.AI_OPERATION_SLOW) {
          serverLog.warn('ai.openai.request.slow', {
            durationMs: aiDurationMs,
            thresholdMs: PERF_THRESHOLDS.AI_OPERATION_SLOW,
          })
        }

        // Match suggested lists to actual list IDs
        const listIds: string[] = []
        if (result.suggestedLists && result.suggestedLists.length > 0) {
          for (const suggestedName of result.suggestedLists) {
            const matchedList = availableLists.find(
              (c) => c.name.toLowerCase() === suggestedName.toLowerCase(),
            )
            if (matchedList) {
              listIds.push(matchedList.id)
            }
          }

          serverLog.info('ai.lists.matched', {
            suggestedCount: result.suggestedLists.length,
            matchedCount: listIds.length,
          })
        }

        // Parse the due date if provided
        let dueDate: Date | null = null
        if (result.dueDate) {
          const parsed = new Date(result.dueDate)
          if (!isNaN(parsed.getTime())) {
            dueDate = parsed
          } else {
            serverLog.warn('ai.dueDate.parseError', {
              rawDueDate: result.dueDate,
            })
          }
        }

        // Create the todo in the database
        const dbStartTime = Date.now()

        const insertResult = await db
          .insert(todos)
          .values({
            name: result.name,
            description: result.description || '',
            priority: result.priority as Priority,
            dueDate: dueDate,
            listId: listIds.length > 0 ? listIds[0] : null,
            aiGenerated: true,
          })
          .returning()

        if (!Array.isArray(insertResult) || insertResult.length === 0) {
          serverLog.error('ai.todo.insert.noResult', {
            prompt: prompt.substring(0, 100),
          })
          throw new Error('Failed to create todo - no result returned')
        }

        const newTodo = insertResult[0]

        // Create subtasks if any were generated
        if (result.subtasks && result.subtasks.length > 0) {
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
          })
        }

        logIfSlow('db.ai.insert', dbStartTime, PERF_THRESHOLDS.DB_QUERY_SLOW, {
          todoId: newTodo.id,
          hasSubtasks: (result.subtasks?.length ?? 0) > 0,
        })

        // Fetch the complete todo with relations using shared config
        const todoWithRelations = await db.query.todos.findFirst({
          where: eq(todos.id, newTodo.id),
          with: todoWithRelationsQueryConfig,
        })

        if (!todoWithRelations) {
          serverLog.error('ai.todo.fetch.notFound', { todoId: newTodo.id })
          throw new Error('Failed to fetch created todo')
        }

        const totalDurationMs = Date.now() - startTime

        serverLog.info('ai.generation.completed', {
          todoId: newTodo.id,
          priority: newTodo.priority,
          hasListId: !!newTodo.listId,
          hasDueDate: !!newTodo.dueDate,
          subtasksCount: result.subtasks?.length ?? 0,
          aiDurationMs,
          totalDurationMs,
        })

        return todoWithRelations as TodoWithRelations
      } catch (error) {
        const durationMs = Date.now() - startTime

        serverLog.error('ai.generation.failed', {
          promptLength: prompt.length,
          durationMs,
          errorType: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })

        Sentry.captureException(error, {
          tags: { component: 'ai', action: 'generateTodoWithAI' },
          extra: {
            promptLength: prompt.length,
            listsCount: availableLists?.length,
            durationMs,
          },
        })

        // Preserve quota/rate-limit errors so the client can detect them
        const errMsg = error instanceof Error ? error.message : String(error)
        if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
          throw new Error('AI_QUOTA_EXCEEDED')
        }
        throw new Error('AI_GENERATION_FAILED')
      }
    })
  })
