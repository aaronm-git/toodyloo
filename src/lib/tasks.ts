import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { asc } from 'drizzle-orm'
import { lists, priorityEnum, subtasks, todos } from '../db/schema'

// =============================================================================
// BASE SCHEMAS - Generated from Drizzle (Single Source of Truth)
// =============================================================================

// Priority schema derived from pgEnum - THE single source of truth for priority
export const prioritySchema = createSelectSchema(priorityEnum)
export type Priority = z.infer<typeof prioritySchema>

// Table schemas - select schemas are the source of truth for data shapes
export const todoSchema = createSelectSchema(todos)
export const listSchema = createSelectSchema(lists)
export const subtaskSchema = createSelectSchema(subtasks)

// =============================================================================
// COMPOSED SCHEMAS - Relations built on top of base schemas
// =============================================================================

// TodoCategory with nested category
// Previously there was a join table relation; now todos reference a single list.
export const todoListWithRelationSchema = todoSchema.extend({
  list: listSchema.nullable().optional(),
})

// Full TodoWithRelations schema
export const todoWithRelationsSchema = todoSchema.extend({
  list: listSchema.nullable().optional(),
  subtasks: z.array(subtaskSchema).optional(),
})

// Category with todo count for UI
export const listWithCountSchema = listSchema.extend({
  todoCount: z.number(),
})

// =============================================================================
// TYPES - Derived from Zod schemas (z.infer)
// =============================================================================

export type Todo = z.infer<typeof todoSchema>
export type List = z.infer<typeof listSchema>
export type Subtask = z.infer<typeof subtaskSchema>
export type TodoListWithRelation = z.infer<typeof todoListWithRelationSchema>
export type TodoWithRelations = z.infer<typeof todoWithRelationsSchema>
export type ListWithCount = z.infer<typeof listWithCountSchema>

// =============================================================================
// SHARED QUERY CONFIGURATION - Used by server functions
// =============================================================================

// Drizzle relational query config for fetching todos with all relations
// This is the single source of truth for how we fetch todos with their relationships
export const todoWithRelationsQueryConfig = {
  // Todos now include a single `list` relation
  list: true,
  // Subtasks are now simple checklist items, ordered by their orderIndex
  subtasks: {
    orderBy: [asc(subtasks.orderIndex), asc(subtasks.createdAt), asc(subtasks.id)],
  },
} as const

// =============================================================================
// INPUT VALIDATION SCHEMAS - Custom schemas for mutations
// These schemas define the shape of data accepted by our API endpoints.
// They reuse the priority schema from drizzle-zod to maintain consistency.
// =============================================================================

// Create todo input schema
export const createTodoSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).default(''),
  priority: prioritySchema.default('low'),
  dueDate: z.date().optional().nullable(),
  listId: z.uuid().optional().nullable(),
})

// Create subtask input schema
export const createSubtaskSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  todoId: z.uuid(),
  orderIndex: z.string().optional(),
})

// Update subtask input schema
export const updateSubtaskSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255).optional(),
  isComplete: z.boolean().optional(),
  orderIndex: z.string().optional(),
})

// Update todo input schema
export const updateTodoSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  priority: prioritySchema.optional(),
  dueDate: z.date().optional().nullable(),
  isComplete: z.boolean().optional(),
  listId: z.uuid().optional().nullable(),
  updatedAt: z.date().optional(), // Optional timestamp to ensure consistency with activity logs
})

// Create category input schema
export const createListSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .nullable()
    .default(null),
})

// Update list input schema
export const updateListSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .nullable()
    .optional(),
})

// =============================================================================
// AI-SPECIFIC SCHEMAS - For AI-generated content validation
// Note: These use plain Zod types (not drizzle-zod) for TanStack AI compatibility
// Using .nullish() instead of .nullable() for better compatibility (accepts missing, null, or undefined)
// =============================================================================

// Priority values as a plain array for AI schema (TanStack AI needs plain Zod enums)
const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent', 'critical'] as const

// Schema for AI-generated subtasks
// Note: Subtasks are simple checklist items with just a name
export const aiSubtaskSchema = z.object({
  name: z
    .string()
    .describe(
      'A concise, actionable subtask name. Start with a verb when appropriate (e.g., "Buy milk", "Call plumber").',
    ),
})

// Schema for AI-generated todo output
// Uses plain Zod enum for priority to ensure TanStack AI schema converter compatibility
export const aiGeneratedTodoSchema = z.object({
  name: z
    .string()
    .describe(
      'A concise, actionable task name. Should be clear and specific. Start with a verb when appropriate (e.g., "Complete quarterly report", "Schedule dentist appointment").',
    ),
  description: z
    .string()
    .nullish()
    .describe(
      'A detailed description, additional context, or helpful notes about the task. Can be omitted, null, or undefined if the task name is self-explanatory.',
    ),
  priority: z
    .enum(PRIORITY_VALUES)
    .describe(
      'Priority level based on urgency and importance: "low" for routine/nice-to-have tasks, "medium" for normal work items, "high" for important tasks needing attention soon, "urgent" for time-sensitive tasks needing immediate attention, "critical" for emergency tasks that must be done ASAP.',
    ),
  dueDate: z
    .string()
    .nullish()
    .describe(
      'Due date in ISO 8601 format (YYYY-MM-DD) if the user mentions a deadline or timeframe. Parse relative dates like "tomorrow", "next Monday", "in 3 days", "end of week". Can be omitted, null, or undefined if no deadline is mentioned or implied.',
    ),
  suggestedLists: z
    .array(z.string())
    .describe(
      'Array of list names that best match this task from the available lists provided in the system prompt. Return an empty array if none of the available lists are a good match. Do not invent new list names.',
    ),
  subtasks: z
    .array(aiSubtaskSchema)
    .describe(
      'Array of subtasks if the user explicitly mentions multiple distinct items that should be tracked separately (e.g., "Buy milk, eggs, and bread" should have 3 subtasks). Return an empty array if the task is a single action that doesn\'t need to be broken down.',
    ),
})

// Input schema for AI todo generation
export const generateTodoInputSchema = z.object({
  prompt: z.string().min(1).max(2000),
})

// =============================================================================
// INPUT TYPES - Derived from validation schemas
// =============================================================================

export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>
export type CreateListInput = z.infer<typeof createListSchema>
export type UpdateListInput = z.infer<typeof updateListSchema>
export type AIGeneratedTodo = z.infer<typeof aiGeneratedTodoSchema>
export type AISubtask = z.infer<typeof aiSubtaskSchema>
export type GenerateTodoInput = z.infer<typeof generateTodoInputSchema>

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Priority labels and utilities
export const priorityLabels: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
}

export function getPriorityLabel(priority: Priority): string {
  return priorityLabels[priority]
}

// Check if a date is overdue (past the current date)
export function isOverdue(date: Date | string | null | undefined): boolean {
  if (!date) return false
  return new Date(date) < new Date()
}

// Priority colors for UI
export const priorityColors: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
  critical: 'bg-red-600 text-white',
}

// Helper to get priority color with type safety
export function getPriorityColor(priority: Priority): string {
  return priorityColors[priority]
}
