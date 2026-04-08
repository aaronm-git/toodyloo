import { useCallback, useState } from 'react'
import {
  X,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Checkbox } from './ui/checkbox'
import { Separator } from './ui/separator'
import { EditableInput } from './ui/editable-input'
import { EditableTextarea } from './ui/editable-textarea'
import { EditableDate } from './ui/editable-date'
import { EditableSelect, type SelectOption } from './ui/editable-select'
import { cn } from '../lib/utils'
import { getPriorityColor, priorityLabels, isOverdue, type Priority } from '../lib/tasks'
import type { TodoWithRelations, ListWithCount, Subtask } from '../lib/tasks'
import { format } from 'date-fns'
import { formatRelativeTime } from '../lib/date-utils'

interface DetailsProps {
  todo: TodoWithRelations | null
  lists?: ListWithCount[]
  isDraft?: boolean
  autoFocusName?: boolean
  onClose: () => void
  onToggleComplete: (id: string) => void
  onUpdateTodo: (id: string, updates: Partial<{
    name: string
    description: string
    priority: Priority
    dueDate: Date | null
    listId: string | null
  }>) => void
  onDelete: (id: string) => void
  onCategoryClick?: (categoryId: string) => void
  onUpdateSubtask?: (id: string, name: string) => void
  onDeleteSubtask?: (id: string) => void
  onRequestDeleteSubtask?: (id: string) => void
  onToggleSubtaskComplete?: (id: string) => void
  onCreateSubtaskInline?: (todoId: string, name: string) => void
  onCancelDraft?: () => void
  className?: string
  hideCloseButton?: boolean
}

export function Details({
  todo,
  lists = [],
  isDraft = false,
  autoFocusName = false,
  onClose,
  onToggleComplete,
  onUpdateTodo,
  onDelete,
  onCategoryClick,
  onUpdateSubtask,
  onDeleteSubtask,
  onRequestDeleteSubtask,
  onToggleSubtaskComplete,
  onCreateSubtaskInline,
  onCancelDraft,
  className,
  hideCloseButton = false,
}: DetailsProps) {
  // State for ghost/draft subtask
  const [draftSubtaskId, setDraftSubtaskId] = useState<string | null>(null)

  // Priority options for select
  const priorityOptions: SelectOption[] = Object.entries(priorityLabels).map(
    ([value, label]) => ({ value, label })
  )

  // List options for select
  const listOptions: SelectOption[] = lists.map((list) => ({
    value: list.id,
    label: list.name,
    color: list.color || undefined,
  }))

  // Handlers
  const handleNameSave = useCallback((name: string) => {
    if (!todo) return
    if (isDraft && !name.trim()) {
      onCancelDraft?.()
      return
    }
    if (name.trim() && name !== todo.name) {
      onUpdateTodo(todo.id, { name })
    }
  }, [todo, isDraft, onCancelDraft, onUpdateTodo])

  const handleDescriptionSave = useCallback((description: string) => {
    if (!todo) return
    if (description !== todo.description) {
      onUpdateTodo(todo.id, { description })
    }
  }, [todo, onUpdateTodo])

  const handlePrioritySave = useCallback((priority: string | null) => {
    if (!todo || !priority) return
    if (priority !== todo.priority) {
      onUpdateTodo(todo.id, { priority: priority as Priority })
    }
  }, [todo, onUpdateTodo])

  const handleDueDateSave = useCallback((dueDate: Date | null) => {
    if (!todo) return
    const currentDate = todo.dueDate ? new Date(todo.dueDate) : null
    const datesMatch = currentDate?.getTime() === dueDate?.getTime()
    if (!datesMatch) {
      onUpdateTodo(todo.id, { dueDate })
    }
  }, [todo, onUpdateTodo])

  const handleListSave = useCallback((listId: string | null) => {
    if (!todo) return
    const currentListId = todo.list?.id || null
    if (listId !== currentListId) {
      onUpdateTodo(todo.id, { listId })
    }
  }, [todo, onUpdateTodo])

  const handleSubtaskNameSave = useCallback((subtaskId: string, name: string) => {
    if (name.trim() && onUpdateSubtask) {
      onUpdateSubtask(subtaskId, name)
    }
  }, [onUpdateSubtask])

  // Handle creating a new subtask from ghost/draft
  const handleDraftSubtaskSave = useCallback((name: string) => {
    if (!todo) return
    
    // Only save if there's text, otherwise just remove from DOM (don't interact with DB)
    if (name.trim() && onCreateSubtaskInline) {
      onCreateSubtaskInline(todo.id, name.trim())
    }
    
    // Always clear the draft (removes from DOM)
    // If no text, this just removes it without any DB interaction
    setDraftSubtaskId(null)
  }, [todo, onCreateSubtaskInline])

  // Handle canceling draft subtask
  const handleDraftSubtaskCancel = useCallback(() => {
    setDraftSubtaskId(null)
  }, [])

  // Handle clicking ghost subtask to create draft
  const handleGhostSubtaskClick = useCallback(() => {
    if (!todo || isDraft) return
    const newDraftId = `draft-subtask-${Date.now()}`
    setDraftSubtaskId(newDraftId)
  }, [todo, isDraft])

  if (!todo) {
    return (
      <div className={cn('w-full lg:w-96 bg-muted/10 flex items-center justify-center', className)}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Select a todo to view details</p>
        </div>
      </div>
    )
  }

  const subtasks: Subtask[] = todo.subtasks || []
  const completedSubtasks = subtasks.filter((st: Subtask) => st.isComplete).length

  return (
    <div className={cn('w-full lg:w-96 bg-background pb-12', className)}>
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between gap-2 sticky top-0 bg-background z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Checkbox
              checked={todo.isComplete}
              onCheckedChange={() => !isDraft && onToggleComplete(todo.id)}
              disabled={isDraft}
            />
            <EditableInput
              value={todo.name}
              onSave={handleNameSave}
              placeholder="Enter task name..."
              autoFocus={autoFocusName}
              onCancel={onCancelDraft}
              required={!isDraft}
              className="flex-1"
              textClassName={cn(
                'text-lg font-semibold',
                todo.isComplete && 'line-through text-muted-foreground',
              )}
              inputClassName="text-lg font-semibold"
              aria-label="Task name"
            />
          </div>
          {/* Priority selector */}
          <EditableSelect
            value={todo.priority}
            onSave={handlePrioritySave}
            options={priorityOptions}
            placeholder="Set priority"
            disabled={isDraft}
            className={cn(
              todo.priority !== 'low' && getPriorityColor(todo.priority),
            )}
            aria-label="Priority"
          />
        </div>
        {!hideCloseButton && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-4 space-y-6 pb-18">
        {/* Description */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Description</h3>
          <EditableTextarea
            value={todo.description || ''}
            onSave={handleDescriptionSave}
            placeholder="Add a description..."
            disabled={isDraft}
            emptyText="No description"
            textClassName={cn(
              'text-sm',
              todo.isComplete && 'line-through text-muted-foreground',
            )}
            aria-label="Description"
          />
        </div>

        {/* Due Date */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Due Date</h3>
          <EditableDate
            value={todo.dueDate ? new Date(todo.dueDate) : null}
            onSave={handleDueDateSave}
            placeholder="Set due date"
            disabled={isDraft}
            clearable
            className={cn(
              isOverdue(todo.dueDate) && !todo.isComplete && 'text-destructive',
            )}
            aria-label="Due date"
          />
        </div>

        {/* List */}
        <div>
          <h3 className="text-sm font-semibold mb-2">List</h3>
          <EditableSelect
            value={todo.list?.id || null}
            onSave={handleListSave}
            options={listOptions}
            placeholder="No list"
            disabled={isDraft}
            clearable
            clearLabel="No list"
            aria-label="List"
          />
          {todo.list && onCategoryClick && (
            <Badge
              variant="outline"
              className="mt-2 cursor-pointer hover:bg-accent"
              style={{
                borderColor: todo.list.color || undefined,
                color: todo.list.color || undefined,
              }}
              onClick={() => onCategoryClick(todo.list!.id)}
            >
              View all in {todo.list.name}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Subtasks Section */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Subtasks</h3>

          <div className="space-y-2">
            {subtasks.map((subtask: Subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={subtask.isComplete}
                  onCheckedChange={() => 
                    onToggleSubtaskComplete
                      ? onToggleSubtaskComplete(subtask.id)
                      : onToggleComplete(subtask.id)
                  }
                />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <EditableInput
                    value={subtask.name}
                    onSave={(name) => handleSubtaskNameSave(subtask.id, name)}
                    placeholder="Subtask name"
                    required
                    className="flex-1"
                    textClassName={cn(
                      'text-sm',
                      subtask.isComplete && 'line-through text-muted-foreground',
                    )}
                    inputClassName="text-sm"
                    aria-label="Subtask name"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onRequestDeleteSubtask) {
                        onRequestDeleteSubtask(subtask.id)
                      } else if (onDeleteSubtask) {
                        onDeleteSubtask(subtask.id)
                      }
                    }}
                    aria-label="Delete subtask"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Ghost subtask for adding new ones */}
            {!isDraft && !draftSubtaskId && (
              <div
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={handleGhostSubtaskClick}
              >
                <Checkbox disabled />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-muted-foreground">
                    Add subtask
                  </span>
                </div>
              </div>
            )}

            {/* Draft subtask (becomes editable when clicked) */}
            {draftSubtaskId && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-accent/30">
                <Checkbox disabled />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <EditableInput
                    value=""
                    onSave={handleDraftSubtaskSave}
                    onCancel={handleDraftSubtaskCancel}
                    onEditEnd={() => {
                      // If user blurs without entering text, remove draft
                      // This is handled by onSave which checks for empty, but we also
                      // need to ensure draft is cleared even if onSave isn't called
                      // (EditableInput with required=true won't call onSave if empty)
                      setDraftSubtaskId(null)
                    }}
                    placeholder="Subtask name"
                    required
                    className="flex-1"
                    textClassName="text-sm"
                    inputClassName="text-sm"
                    autoFocus
                    aria-label="New subtask name"
                  />
                </div>
              </div>
            )}

            {/* Always show completed count, even when 0 */}
            <p className="text-xs text-muted-foreground pt-2">
              {completedSubtasks} of {subtasks.length} completed
            </p>
          </div>
        </div>

        <Separator />

        {/* Meta Details */}
        {!isDraft && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Meta</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              {todo.aiGenerated && (
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  <span className="font-medium text-purple-600 dark:text-purple-400">Created with AI</span>
                </div>
              )}
              {todo.createdAt && (
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  <span>{format(new Date(todo.createdAt), 'PPP p')}</span>
                  <span className="ml-2 text-xs">
                    ({formatRelativeTime(todo.createdAt)})
                  </span>
                </div>
              )}
              {todo.updatedAt && (
                <div>
                  <span className="font-medium">Last updated:</span>{' '}
                  <span>{format(new Date(todo.updatedAt), 'PPP p')}</span>
                  <span className="ml-2 text-xs">
                    ({formatRelativeTime(todo.updatedAt)})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* Delete Action - Only action left since editing is inline */}
        {!isDraft && (
          <div>
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={() => onDelete(todo.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Todo
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
