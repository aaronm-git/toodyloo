import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const priorityEnum = pgEnum('priority', [
  'low',
  'medium',
  'high',
  'urgent',
  'critical',
])

export type Priority = 'low' | 'medium' | 'high' | 'urgent' | 'critical'

// Recurrence pattern types for recurring todos
export const recurrenceTypeEnum = pgEnum('recurrence_type', [
  'daily',
  'weekly',
  'monthly',
  'annually',
  'custom',
])

export type RecurrenceType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'annually'
  | 'custom'

export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color'),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

// Define todos table first (before todoCategories) to avoid circular reference issues
// Note: Self-references (parentId, recurringTodoId) use arrow functions to handle circular dependencies
// TypeScript has limitations with self-referencing tables, but this works correctly at runtime
// @ts-ignore - TypeScript limitation with self-referencing tables in Drizzle ORM
export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  priority: priorityEnum('priority').notNull().default('low'),
  isComplete: boolean().notNull().default(false),
  dueDate: timestamp({ withTimezone: true }),

  // Recurring todos support
  // If recurrenceType is set, this todo repeats according to the pattern
  recurrenceType: recurrenceTypeEnum('recurrence_type'),

  // Recurrence configuration stored as JSON for flexible patterns
  // For 'custom' recurrence, this can store complex rules like "every 3rd Tuesday"
  // Format: { interval: number, dayOfWeek?: number[], dayOfMonth?: number, etc. }
  recurrenceConfig: text('recurrence_config'), // JSON string

  // Reference to the original recurring todo template
  // When instances are auto-created, they reference this parent recurring todo
  // The template todo itself has recurrenceType set, instances have this field set
  // @ts-ignore - TypeScript limitation with self-referencing tables
  recurringTodoId: uuid('recurring_todo_id').references(() => todos.id, {
    onDelete: 'cascade',
  }),

  // Next occurrence date for recurring todos
  // Used to determine when the next instance should be created
  nextOccurrence: timestamp({ withTimezone: true }),

  // End date for recurring todos (optional)
  // If set, the recurrence stops after this date
  recurrenceEndDate: timestamp({ withTimezone: true }),

  aiGenerated: boolean('ai_generated').notNull().default(false),

  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  // Each todo belongs to a single list (formerly category). Nullable for todos without a list.
  listId: uuid('list_id').references(() => lists.id, { onDelete: 'set null' }),
})

// Subtasks table: Simple checklist items that belong to a todo
// Unlike todos, subtasks only have a name - they're meant to be simple like Wunderlist
export const subtasks = pgTable('subtasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  todoId: uuid('todo_id')
    .notNull()
    .references(() => todos.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isComplete: boolean('is_complete').notNull().default(false),
  // Order index for maintaining user-defined order (using integer for simplicity)
  orderIndex: text('order_index').notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

// NOTE: The previous many-to-many join table `todo_lists` has been migrated to a single
// foreign key `todos.list_id`. The join table definition has been removed.

// Reminders table: Separate table to support multiple reminders per todo
// This allows users to set multiple reminders (e.g., 1 day before, 1 hour before)
// For recurring todos, reminders are stored on the template and inherited by instances
export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  todoId: uuid('todo_id')
    .notNull()
    .references(() => todos.id, { onDelete: 'cascade' }),

  // When the reminder should fire (absolute timestamp)
  // For recurring todos, this is calculated relative to the instance's dueDate
  remindAt: timestamp({ withTimezone: true }).notNull(),

  // Whether the reminder has been sent/triggered
  isSent: boolean().notNull().default(false),

  // Optional notification method (email, push, in-app, etc.)
  // Stored as text for flexibility, could be an enum if needed
  notificationMethod: text('notification_method'),

  // For recurring todos: Reminder offset stored as JSON
  // Format: { value: number, unit: 'minutes' | 'hours' | 'days' | 'weeks' }
  // Example: { value: 1, unit: 'days' } means "1 day before due date"
  // If set, this reminder is inherited by recurring instances with adjusted remindAt dates
  // If null, this is a one-time reminder for a specific todo instance
  reminderOffset: text('reminder_offset'), // JSON string

  // Reference to the recurring template this reminder belongs to (if applicable)
  // If set, this reminder is part of the template and will be copied to instances
  // If null, this reminder is for a specific todo instance only
  recurringTemplateId: uuid('recurring_template_id').references(() => todos.id, {
    onDelete: 'cascade',
  }),

  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

// Set up table relationships for our database using Drizzle ORM

// Define how the "todos" table relates to others.
// @ts-ignore - TypeScript limitation with self-referencing relations in Drizzle ORM
export const todosRelations = relations(todos, ({ many, one }) => ({
  // A single todo belongs to one list (formerly a category).
  list: one(lists, {
    fields: [todos.listId],
    references: [lists.id],
  }),

  // A todo can have many simple subtasks (checklist items)
  subtasks: many(subtasks),

  // Recurring todos: A recurring template can have many instances
  recurringInstances: many(todos, {
    relationName: 'recurringInstances',
  }),

  // Recurring todos: An instance references its recurring template
  recurringTemplate: one(todos, {
    fields: [todos.recurringTodoId],
    references: [todos.id],
    relationName: 'recurringInstances',
  }),

  // A todo can have multiple reminders (for this specific instance)
  reminders: many(reminders),
  
  // If this is a recurring template, it can have template reminders
  // These reminders are inherited by all instances
  templateReminders: many(reminders, {
    relationName: 'templateReminders',
  }),
}))

// Define how the "lists" table relates to others.
// Here, a single list can have many todos, also via the "todoLists" join table.
export const listsRelations = relations(lists, ({ many }) => ({
  // The 'todos' property lets us fetch all todos that reference this list.
  todos: many(todos),
}))

// Define relationships on the join table "todoCategories"
// This table links todos and categories by their IDs.
// The join-table relations were removed when migrating to single list ownership.

// Define relationships for subtasks
export const subtasksRelations = relations(subtasks, ({ one }) => ({
  // Each subtask belongs to one todo
  todo: one(todos, {
    fields: [subtasks.todoId],
    references: [todos.id],
  }),
}))

// Define relationships for reminders
export const remindersRelations = relations(reminders, ({ one }) => ({
  // Each reminder belongs to one todo (the instance)
  todo: one(todos, {
    fields: [reminders.todoId],
    references: [todos.id],
  }),
  // If this reminder is part of a recurring template, link to the template
  // This allows fetching all reminders for a recurring todo template
  recurringTemplate: one(todos, {
    fields: [reminders.recurringTemplateId],
    references: [todos.id],
    relationName: 'templateReminders',
  }),
}))

// Update todos relations to include template reminders
// (This needs to be added to the existing todosRelations)

// ============================================================
// Activity Log Schema
// ============================================================
// Tracks all user operations for the activity log feature
// This provides persistent, DB-backed activity history

export const operationTypeEnum = pgEnum('operation_type', [
  'create',
  'update',
  'delete',
])

export const entityTypeEnum = pgEnum('entity_type', [
  'todo',
  'subtask',
  'list',
  'ai-todo',
])

export const operationStatusEnum = pgEnum('operation_status', [
  'pending',
  'success',
  'error',
])

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Operation details
  operationType: operationTypeEnum('operation_type').notNull(),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityId: text('entity_id'), // The ID of the entity (null for failed creates)
  entityName: text('entity_name').notNull(), // Human-readable name for display
  
  // Status tracking
  status: operationStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  sentryEventId: text('sentry_event_id'),
  
  // Retry tracking
  retryCount: text('retry_count').notNull().default('0'),
  maxRetries: text('max_retries').notNull().default('3'),
  
  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  
  // User association (optional - for multi-user support)
  userId: text('user_id'),
})

// ============================================================
// Better Auth Schema Integration
// ============================================================
// Import and re-export Better Auth tables so they're included in migrations
// Backwards-compatibility aliases: expose old names so existing code keeps working.
export * from '../../auth-schema'
