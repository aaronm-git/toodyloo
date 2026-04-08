import { toast } from 'sonner'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Plus, LogOut, Sun, Moon, Monitor, Menu, Sparkles, ClipboardList } from 'lucide-react'
import { useSession, signOut } from '../lib/auth-client'
import { useTheme } from '../components/theme-provider'
import { useIsMobile } from '../hooks/use-mobile'
import { Button, buttonVariants } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'

// Optimistic operations
import { mutationKeys, type MutationMeta, type DraftTodo, useActivityDrawer } from '../lib/optimistic-operations'

// Server functions
import {
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  toggleTodoComplete,
} from '../lib/server/todos'
import {
  getLists,
  createList,
  updateList,
  deleteList,
} from '../lib/server/categories'
import {
  createSubtask,
  updateSubtask,
  deleteSubtask,
  toggleSubtaskComplete,
} from '../lib/server/subtasks'
import { generateTodoWithAI } from '../lib/server/ai'

// Components
import { TodoList } from '../components/todos/todo-list'
import { Details } from '../components/details'
import { AITodoDialog } from '../components/todos/ai-todo-dialog'
import { TodoFilters, type TodoFilters as TodoFiltersType } from '../components/todos/todo-filters'
import { Sidebar } from '../components/sidebar'
import { ListDialog, type ListFormData } from '../components/lists/list-dialog'

import type {
  TodoWithRelations,
  ListWithCount,
  CreateTodoInput,
  UpdateTodoInput,
  CreateListInput,
  UpdateListInput,
  Subtask,
  CreateSubtaskInput,
  UpdateSubtaskInput,
  Priority,
} from '../lib/tasks'
import { todoWithRelationsSchema } from '../lib/tasks'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const isMobile = useIsMobile()
  const { openDrawer } = useActivityDrawer()

  // State for dialogs (only keeping AI dialog and List dialog)
  const [aiTodoDialogOpen, setAiTodoDialogOpen] = useState(false)
  const [listDialogOpen, setListDialogOpen] = useState(false)
  const [editingList, setEditingList] = useState<ListWithCount | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [todoToDelete, setTodoToDelete] = useState<string | null>(null)
  const [subtaskDeleteDialogOpen, setSubtaskDeleteDialogOpen] = useState(false)
  const [subtaskToDelete, setSubtaskToDelete] = useState<string | null>(null)
  const [selectedTodo, setSelectedTodo] = useState<TodoWithRelations | null>(null)
  
  // Draft todo state for inline creation
  const [draft, setDraft] = useState<DraftTodo | null>(null)
  
  // AI loading todos state - uses overlay/reveal pattern for seamless transition
  const [aiLoadingTodos, setAiLoadingTodos] = useState<Array<{
    tempId: string
    prompt: string
    resolvedTodo?: TodoWithRelations | null
    isLoading: boolean
  }>>([])
  
  // Mobile sheet state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Filters state
  const [filters, setFilters] = useState<TodoFiltersType>({
    search: '',
    priority: 'all',
    categoryId: null,
    status: 'all',
  })

  // Queries
  // Note: We use the cached todos directly instead of useOptimisticData hook
  // because EditableInput components manage their own local state for optimistic display.
  // Using useOptimisticData would cause re-renders when mutations become pending,
  // which loses input focus. The cache is only updated in onSettled (after mutation completes).
  const {
    data: todos = [],
    isLoading: todosLoading,
  } = useQuery({
    queryKey: ['todos'],
    queryFn: () => getTodos({}),
  })

  // Update selected todo when todos data changes
  useEffect(() => {
    if (selectedTodo && todos.length > 0) {
      const updatedTodo = todos.find((t) => t.id === selectedTodo.id)
      if (updatedTodo) {
        setSelectedTodo(updatedTodo)
      }
    }
  }, [todos, selectedTodo?.id])

  const {
    data: lists = [],
    isLoading: listsLoading,
  } = useQuery({
    queryKey: ['lists'],
    queryFn: () => getLists({}),
  })

  // Mutations with optimistic updates and tracking via mutation keys
  const createTodoMutation = useMutation({
    mutationKey: mutationKeys.todos.create(),
    mutationFn: (data: CreateTodoInput) => createTodo({ data }),
    meta: {
      operationType: 'create',
      entityType: 'todo',
      getEntityName: (vars: unknown) => (vars as CreateTodoInput).name || 'New task',
    },
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previousTodos = queryClient.getQueryData(['todos'])
      
      // Generate temp ID for tracking
      const tempId = `temp-${Date.now()}`
      
      // Optimistically update - create partial object for optimistic UI
      const optimisticTodo = {
        id: tempId,
        name: newTodo.name,
        description: newTodo.description ?? '',
        priority: newTodo.priority ?? 'low',
        isComplete: false,
        dueDate: newTodo.dueDate ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        list: newTodo.listId ? lists.find((c) => c.id === newTodo.listId) || null : null,
        subtasks: [],
      }
      
      queryClient.setQueryData(['todos'], (old: typeof todos = []) => [
        optimisticTodo,
        ...old,
      ])
      
      return { previousTodos, tempId }
    },
    onError: (_err, _newTodo, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos)
    },
    onSuccess: (serverTodo, _variables, context) => {
      // Replace temp todo with server todo (has real ID)
      if (serverTodo && context?.tempId) {
        queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
          old.map((todo) =>
            todo.id === context.tempId ? serverTodo : todo
          )
        )
      }
      // Invalidate lists to update counts
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })

  const updateTodoMutation = useMutation({
    mutationKey: mutationKeys.todos.update('batch'),
    mutationFn: (data: UpdateTodoInput) => updateTodo({ data }),
    meta: {
      operationType: 'update',
      entityType: 'todo',
      getEntityName: (vars: unknown) => (vars as UpdateTodoInput).name || 'Task',
    } as MutationMeta,
    onMutate: async () => {
      // "Via the UI" approach: ONLY cancel queries, do NOT update cache
      // This prevents re-renders and preserves input focus
      // Optimistic values are applied at render time via useOptimisticData hook
      await queryClient.cancelQueries({ queryKey: ['todos'] })
    },
    // No onError needed - cache was never updated, nothing to rollback
    onSettled: (serverTodo, error, variables) => {
      // Update cache AFTER mutation completes (success or failure)
      // This happens after the user has finished typing
      if (!error && serverTodo) {
        queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
          old.map((todo) =>
            todo.id === serverTodo.id ? { ...todo, ...serverTodo } : todo
          )
        )
        // selectedTodo is synced automatically via useEffect when todos changes
      } else if (error) {
        // On error, refetch to get true server state
        queryClient.invalidateQueries({ queryKey: ['todos'] })
      }
      // Update list counts if list assignment changed
      if (variables.listId !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['lists'] })
      }
    },
  })

  const toggleCompleteMutation = useMutation({
    mutationKey: mutationKeys.todos.toggle('batch'),
    mutationFn: (id: string) => toggleTodoComplete({ data: id }),
    meta: {
      operationType: 'update',
      entityType: 'todo',
      getEntityName: () => 'Task status',
    } as MutationMeta,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previousTodos = queryClient.getQueryData(['todos'])
      
      queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
        old.map((todo) =>
          todo.id === id ? { ...todo, isComplete: !todo.isComplete } : todo
        )
      )
      
      // Also update selectedTodo if it's the one being toggled
      if (selectedTodo && selectedTodo.id === id) {
        setSelectedTodo(prev => prev ? { ...prev, isComplete: !prev.isComplete } : null)
      }
      
      return { previousTodos }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos)
    },
    onSuccess: (serverTodo) => {
      // Merge server response without refetch
      // selectedTodo is synced automatically via useEffect when todos changes
      if (serverTodo) {
        queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
          old.map((todo) =>
            todo.id === serverTodo.id ? { ...todo, ...serverTodo } : todo
          )
        )
      }
    },
  })

  const deleteTodoMutation = useMutation({
    mutationKey: mutationKeys.todos.delete('batch'),
    mutationFn: (id: string) => deleteTodo({ data: id }),
    meta: {
      operationType: 'delete',
      entityType: 'todo',
      // Get the entity name from the cache before deletion
      getEntityName: (vars: unknown) => {
        const id = vars as string
        const cachedTodos = queryClient.getQueryData(['todos']) as typeof todos | undefined
        const todo = cachedTodos?.find(t => t.id === id)
        return todo?.name || 'Task'
      },
    } as MutationMeta,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previousTodos = queryClient.getQueryData(['todos'])
      
      // Get the todo name before removing for activity log
      const deletedTodo = (previousTodos as typeof todos)?.find(t => t.id === id)
      
      queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
        old.filter((todo) => todo.id !== id)
      )
      
      // Clear selected todo if it was deleted
      if (selectedTodo && selectedTodo.id === id) {
        setSelectedTodo(null)
      }
      
      return { previousTodos, deletedTodoName: deletedTodo?.name }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos)
    },
    onSuccess: () => {
      // Only invalidate lists to update counts
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })

  const createListMutation = useMutation({
    mutationKey: mutationKeys.lists.create(),
    mutationFn: (data: CreateListInput) => createList({ data }),
    meta: {
      operationType: 'create',
      entityType: 'list',
      getEntityName: (vars: unknown) => (vars as CreateListInput).name || 'New list',
    } as MutationMeta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      setListDialogOpen(false)
      setEditingList(null)
    },
  })

  const updateListMutation = useMutation({
    mutationKey: mutationKeys.lists.update('batch'),
    mutationFn: (data: UpdateListInput) => updateList({ data }),
    meta: {
      operationType: 'update',
      entityType: 'list',
      getEntityName: (vars: unknown) => (vars as UpdateListInput).name || 'List',
    } as MutationMeta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      setListDialogOpen(false)
      setEditingList(null)
    },
  })

  const deleteListMutation = useMutation({
    mutationKey: mutationKeys.lists.delete('batch'),
    mutationFn: (id: string) => deleteList({ data: id }),
    meta: {
      operationType: 'delete',
      entityType: 'list',
      getEntityName: () => 'List',
    } as MutationMeta,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      if (filters.categoryId) {
        setFilters((prev) => ({ ...prev, categoryId: null }))
      }
    },
  })

  // Subtask mutations with optimistic updates
  const createSubtaskMutation = useMutation({
    mutationKey: mutationKeys.subtasks.create(),
    mutationFn: (data: CreateSubtaskInput) => createSubtask({ data }),
    meta: {
      operationType: 'create',
      entityType: 'subtask',
      getEntityName: (vars: unknown) => (vars as CreateSubtaskInput).name || 'New subtask',
    } as MutationMeta,
    onMutate: async (newSubtask) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previousTodos = queryClient.getQueryData(['todos'])
      const tempId = `temp-subtask-${Date.now()}`
      
      // Optimistically add subtask to the todo
      queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
        old.map((todo) =>
          todo.id === newSubtask.todoId
            ? {
                ...todo,
                subtasks: [
                  ...(todo.subtasks || []),
                  {
                    id: tempId,
                    name: newSubtask.name,
                    isComplete: false,
                    todoId: newSubtask.todoId,
                    orderIndex: String((todo.subtasks?.length || 0)),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ],
              }
            : todo
        )
      )
      
      return { previousTodos, tempId, todoId: newSubtask.todoId }
    },
    onError: (_err, _newSubtask, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos)
    },
    onSuccess: (serverSubtask, _variables, context) => {
      // Replace temp subtask with server subtask
      if (serverSubtask && context?.tempId) {
        queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
          old.map((todo) =>
            todo.id === context.todoId
              ? {
                  ...todo,
                  subtasks: todo.subtasks?.map((st: Subtask) =>
                    st.id === context.tempId ? serverSubtask : st
                  ),
                }
              : todo
          )
        )
      }
    },
  })

  const updateSubtaskMutation = useMutation({
    mutationKey: mutationKeys.subtasks.update('batch'),
    mutationFn: (data: UpdateSubtaskInput) => updateSubtask({ data }),
    meta: {
      operationType: 'update',
      entityType: 'subtask',
      getEntityName: (vars: unknown) => (vars as UpdateSubtaskInput).name || 'Subtask',
    } as MutationMeta,
    onMutate: async () => {
      // "Via the UI" approach: ONLY cancel queries, do NOT update cache
      await queryClient.cancelQueries({ queryKey: ['todos'] })
    },
    // No onError needed - cache was never updated
    onSettled: (serverSubtask, error) => {
      if (!error && serverSubtask) {
        queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
          old.map((todo) => ({
            ...todo,
            subtasks: todo.subtasks?.map((st: Subtask) =>
              st.id === serverSubtask.id ? { ...st, ...serverSubtask } : st
            ),
          }))
        )
      } else if (error) {
        queryClient.invalidateQueries({ queryKey: ['todos'] })
      }
    },
  })

  const deleteSubtaskMutation = useMutation({
    mutationKey: mutationKeys.subtasks.delete('batch'),
    mutationFn: (id: string) => deleteSubtask({ data: id }),
    meta: {
      operationType: 'delete',
      entityType: 'subtask',
      // Get the subtask name from the cache before deletion
      getEntityName: (vars: unknown) => {
        const id = vars as string
        const cachedTodos = queryClient.getQueryData(['todos']) as typeof todos | undefined
        for (const todo of cachedTodos || []) {
          const subtask = todo.subtasks?.find((st: Subtask) => st.id === id)
          if (subtask) return subtask.name
        }
        return 'Subtask'
      },
    } as MutationMeta,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previousTodos = queryClient.getQueryData(['todos'])
      
      // Optimistically remove subtask
      queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
        old.map((todo) => ({
          ...todo,
          subtasks: todo.subtasks?.filter((st: Subtask) => st.id !== id),
        }))
      )
      
      return { previousTodos }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos)
    },
    onSuccess: () => {
      // No need to refetch - optimistic update is the truth
    },
  })

  const toggleSubtaskCompleteMutation = useMutation({
    mutationKey: mutationKeys.subtasks.toggle('batch'),
    mutationFn: (id: string) => toggleSubtaskComplete({ data: id }),
    meta: {
      operationType: 'update',
      entityType: 'subtask',
      getEntityName: () => 'Subtask status',
    } as MutationMeta,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previousTodos = queryClient.getQueryData(['todos'])
      
      // Optimistically update subtasks within todos
      queryClient.setQueryData(['todos'], (old: typeof todos = []) =>
        old.map((todo) => {
          if (todo.subtasks && todo.subtasks.length > 0) {
            const hasMatchingSubtask = todo.subtasks.some((st: Subtask) => st.id === id)
            if (hasMatchingSubtask) {
              const updatedSubtasks = todo.subtasks.map((subtask: Subtask) =>
                subtask.id === id
                  ? { ...subtask, isComplete: !subtask.isComplete }
                  : subtask
              )
              return { ...todo, subtasks: updatedSubtasks }
            }
          }
          return todo
        })
      )
      
      // Also update selectedTodo if it contains the subtask
      if (selectedTodo && selectedTodo.subtasks) {
        const hasMatchingSubtask = selectedTodo.subtasks.some((st: Subtask) => st.id === id)
        if (hasMatchingSubtask) {
          const updatedSubtasks = selectedTodo.subtasks.map((subtask: Subtask) =>
            subtask.id === id
              ? { ...subtask, isComplete: !subtask.isComplete }
              : subtask
          )
          setSelectedTodo({ ...selectedTodo, subtasks: updatedSubtasks })
        }
      }
      
      return { previousTodos }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos)
    },
    onSuccess: () => {
      // Don't invalidate to preserve order
    },
  })

  // AI generation mutation
  const generateAITodoMutation = useMutation({
    mutationKey: mutationKeys.ai.generateTodo(),
    mutationFn: async ({ prompt, tempId }: { prompt: string; tempId: string }) => {
      const result = await generateTodoWithAI({
        data: {
          prompt,
          lists: lists.map((c) => ({ id: c.id, name: c.name })),
        },
      })
      // Parse and validate the result
      const parsedTodo = todoWithRelationsSchema.parse(result)
      return { todo: parsedTodo, tempId }
    },
    retry: false,
    meta: {
      operationType: 'create',
      entityType: 'ai-todo',
      getEntityName: (vars: unknown) => {
        const { prompt } = vars as { prompt: string; tempId: string }
        return prompt.length > 50 ? prompt.slice(0, 47) + '...' : prompt
      },
    } as MutationMeta,
    onSuccess: ({ todo, tempId }) => {
      // Update the loading todo with resolved data and trigger fade out
      setAiLoadingTodos((prev) =>
        prev.map((t) =>
          t.tempId === tempId
            ? { ...t, resolvedTodo: todo, isLoading: false }
            : t
        )
      )
      // Invalidate to ensure the real todo is in the main list
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['lists'] })
      queryClient.invalidateQueries({ queryKey: ['ai-usage'] })
      
      // After fade animation completes (300ms), remove from AI loading list
      // The real todo will already be showing in the regular todos list
      setTimeout(() => {
        setAiLoadingTodos((prev) => prev.filter((t) => t.tempId !== tempId))
        // Select the new todo after it's fully transitioned
        if (todo) {
          setSelectedTodo(todo)
          if (isMobile) {
            setDetailsOpen(true)
          }
        }
      }, 350)
    },
    onError: (err, { tempId }) => {
      // Remove loading todo immediately on error
      setAiLoadingTodos((prev) => prev.filter((t) => t.tempId !== tempId))

      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('AI_DAILY_LIMIT_EXCEEDED')) {
        toast.error('Daily AI limit reached (15/day). Try again tomorrow!')
      } else if (message.includes('AI_QUOTA_EXCEEDED')) {
        toast.error('AI quota exceeded. Please check your OpenAI plan and billing details.')
      } else {
        toast.error('Failed to generate AI todo. Please try again.')
      }
    },
  })

  // Handlers
  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  // Create a new draft todo (inline creation)
  const handleCreateTodo = useCallback(() => {
    // Create a new draft with default values
    const newDraft: DraftTodo = {
      tempId: `draft-${Date.now()}`,
      name: '',
      description: '',
      priority: 'low',
      dueDate: null,
      listId: filters.categoryId, // Use current filter as default list
      isPersisting: false,
      createdAt: Date.now(),
    }
    setDraft(newDraft)
    // Select the draft
    setSelectedTodo({
      id: newDraft.tempId,
      name: '',
      description: '',
      priority: 'low',
      isComplete: false,
      dueDate: null,
      createdAt: new Date(newDraft.createdAt),
      updatedAt: new Date(newDraft.createdAt),
      list: newDraft.listId ? lists.find((c) => c.id === newDraft.listId) || null : null,
      subtasks: [],
      recurrenceType: null,
      recurrenceConfig: null,
      recurringTodoId: null,
      nextOccurrence: null,
      isRecurring: false,
      isArchived: false,
      isDeleted: false,
      isFavorite: false,
    })
    if (isMobile) {
      setDetailsOpen(true)
    }
  }, [filters.categoryId, lists, isMobile])

  // Handle draft name change - triggers create mutation on first non-empty name
  const handleDraftNameChange = useCallback((name: string) => {
    if (!draft) return
    
    if (name.trim() && !draft.isPersisting) {
      // Start persisting the draft
      setDraft((prev) => prev ? { ...prev, name, isPersisting: true } : null)
      
      // Create the todo
      createTodoMutation.mutate({
        name: name.trim(),
        description: draft.description,
        priority: draft.priority,
        dueDate: draft.dueDate,
        listId: draft.listId,
      }, {
        onSuccess: (newTodo) => {
          // Clear the draft and select the new todo
          setDraft(null)
          if (newTodo) {
            setSelectedTodo(newTodo)
          }
        },
        onError: () => {
          // Reset draft persisting state so user can try again
          setDraft((prev) => prev ? { ...prev, isPersisting: false } : null)
        },
      })
    } else {
      // Just update the local draft name
      setDraft((prev) => prev ? { ...prev, name } : null)
    }
  }, [draft, createTodoMutation])

  // Cancel draft creation
  const handleCancelDraft = useCallback(() => {
    setDraft(null)
    setSelectedTodo(null)
    if (isMobile) {
      setDetailsOpen(false)
    }
  }, [isMobile])

  const handleAICreateTodo = useCallback(() => {
    setAiTodoDialogOpen(true)
  }, [])

  const handleAIStartGeneration = useCallback((prompt: string) => {
    // Create optimistic loading todo with overlay
    const tempId = `ai-loading-${Date.now()}`
    setAiLoadingTodos((prev) => [...prev, { tempId, prompt, isLoading: true }])
    
    // Start AI generation
    generateAITodoMutation.mutate({ prompt, tempId })
  }, [generateAITodoMutation])

  const handleAITodoSuccess = () => {
    // This is not used anymore since mutation handles success
    // Keeping for backwards compatibility if needed
  }

  const handleSelectTodo = useCallback((todo: TodoWithRelations) => {
    // If selecting a different todo, clear any draft
    if (draft && todo.id !== draft.tempId) {
      if (!draft.isPersisting && !draft.name.trim()) {
        setDraft(null)
      }
    }
    setSelectedTodo(todo)
    if (isMobile) {
      setDetailsOpen(true)
    }
  }, [draft, isMobile])

  // Inline name update for todo list item
  const handleUpdateTodoName = useCallback((id: string, name: string) => {
    if (!name.trim()) return
    // Generate timestamp for consistency
    const timestamp = new Date()
    updateTodoMutation.mutate({ id, name, updatedAt: timestamp })
  }, [updateTodoMutation])

  // Full todo update from details panel
  const handleUpdateTodo = useCallback((id: string, updates: Partial<{
    name: string
    description: string
    priority: Priority
    dueDate: Date | null
    listId: string | null
  }>) => {
    // Generate timestamp for consistency between task update and activity log
    const timestamp = new Date()
    updateTodoMutation.mutate({ id, ...updates, updatedAt: timestamp })
  }, [updateTodoMutation])

  // Subtask "add" entry point used outside the details panel.
  // Details panel handles creation inline; elsewhere we currently no-op.
  const handleAddSubtask = useCallback((_todoId: string) => {
    // Intentionally no-op: subtask creation is inline in the Details panel.
  }, [])

  const handleUpdateSubtask = useCallback((id: string, name: string) => {
    if (!name.trim()) return
    updateSubtaskMutation.mutate({ id, name })
  }, [updateSubtaskMutation])

  const handleDeleteSubtask = useCallback((id: string) => {
    deleteSubtaskMutation.mutate(id)
  }, [deleteSubtaskMutation])

  const handleRequestDeleteSubtask = useCallback((id: string) => {
    setSubtaskToDelete(id)
    setSubtaskDeleteDialogOpen(true)
  }, [])

  const handleSubtaskDeleteConfirm = useCallback(() => {
    if (subtaskToDelete) {
      deleteSubtaskMutation.mutate(subtaskToDelete)
      setSubtaskDeleteDialogOpen(false)
      setSubtaskToDelete(null)
    }
  }, [subtaskToDelete, deleteSubtaskMutation])

  const handleCreateSubtaskInline = useCallback((todoId: string, name: string) => {
    if (!name.trim()) return
    createSubtaskMutation.mutate({ name, todoId })
  }, [createSubtaskMutation])

  const handleCloseDetails = useCallback(() => {
    // If there's an empty draft, cancel it
    if (draft && !draft.name.trim() && !draft.isPersisting) {
      setDraft(null)
    }
    setSelectedTodo(null)
    setDetailsOpen(false)
  }, [draft])

  const handleDeleteTodo = useCallback((id: string) => {
    setTodoToDelete(id)
    setDeleteDialogOpen(true)
  }, [])

  // Memoized toggle callback to prevent re-renders in TodoListItem
  const handleToggleComplete = useCallback((id: string) => {
    toggleCompleteMutation.mutate(id)
  }, [toggleCompleteMutation])

  const handleDeleteConfirm = useCallback(() => {
    if (todoToDelete) {
      deleteTodoMutation.mutate(todoToDelete)
      setDeleteDialogOpen(false)
      setTodoToDelete(null)
    }
  }, [todoToDelete, deleteTodoMutation])

  // Check if the todo being deleted has subtasks
  const todoToDeleteData = todos.find((t) => t.id === todoToDelete)
  const hasSubtasks = (todoToDeleteData?.subtasks?.length ?? 0) > 0

  const handleCreateList = () => {
    setEditingList(null)
    setListDialogOpen(true)
  }

  const handleEditList = (list: ListWithCount) => {
    setEditingList(list)
    setListDialogOpen(true)
  }

  const handleListSubmit = (data: ListFormData) => {
    if (editingList) {
      updateListMutation.mutate({ id: editingList.id, ...data })
    } else {
      createListMutation.mutate(data)
    }
  }

  const handleCategorySelect = (categoryId: string | null) => {
    setFilters((prev) => ({ ...prev, categoryId }))
  }

  const handleCategoryClick = (categoryId: string) => {
    setFilters((prev) => ({
      ...prev,
      categoryId: prev.categoryId === categoryId ? null : categoryId,
    }))
  }

  // Filter todos
  const filteredTodos = useMemo(() => {
    // Get IDs of todos currently in the AI loading transition (to avoid duplication)
    const aiTransitioningIds = new Set(
      aiLoadingTodos
        .filter((t) => t.resolvedTodo)
        .map((t) => t.resolvedTodo!.id)
    )

    return todos.filter((todo) => {
      // Skip todos that are currently transitioning from AI loading overlay
      if (aiTransitioningIds.has(todo.id)) {
        return false
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        if (
          !todo.name.toLowerCase().includes(searchLower) &&
          !todo.description.toLowerCase().includes(searchLower)
        ) {
          return false
        }
      }

      // Priority filter
      if (filters.priority !== 'all' && todo.priority !== filters.priority) {
        return false
      }

      // Category filter (now using list)
      if (filters.categoryId) {
        const hasList = todo.list?.id === filters.categoryId
        if (!hasList) return false
      }

      // Status filter
      if (filters.status === 'active' && todo.isComplete) return false
      if (filters.status === 'completed' && !todo.isComplete) return false

      return true
    })
  }, [todos, filters, aiLoadingTodos])

  // Auth check
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    navigate({ to: '/login' })
    return null
  }

  const initials = session.user.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : session.user.email?.[0]?.toUpperCase() || 'U'

  // Sidebar content component (reused in desktop and mobile)
  const sidebarContent = (
    <Sidebar
      categories={lists}
      selectedCategoryId={filters.categoryId}
      onCategorySelect={(id) => {
        handleCategorySelect(id)
        if (isMobile) setSidebarOpen(false)
      }}
      onCreateCategory={handleCreateList}
      onEditCategory={handleEditList}
      onDeleteCategory={(id) => deleteListMutation.mutate(id)}
      totalTodos={todos.length}
      isLoading={listsLoading}
    />
  )

  // Check if selected todo is the draft
  const isSelectedDraft = Boolean(draft && selectedTodo?.id === draft.tempId)

  // Details content component (reused in desktop and mobile)
  // Memoized subtask toggle callback
  const handleToggleSubtaskComplete = useCallback((id: string) => {
    toggleSubtaskCompleteMutation.mutate(id)
  }, [toggleSubtaskCompleteMutation])

  const detailsContent = (hideClose = false) => (
    <Details
      todo={selectedTodo}
      lists={lists}
      isDraft={isSelectedDraft}
      autoFocusName={isSelectedDraft}
      onClose={handleCloseDetails}
      onToggleComplete={handleToggleComplete}
      onUpdateTodo={handleUpdateTodo}
      onDelete={handleDeleteTodo}
      onCategoryClick={handleCategoryClick}
      onUpdateSubtask={handleUpdateSubtask}
      onDeleteSubtask={handleDeleteSubtask}
      onRequestDeleteSubtask={handleRequestDeleteSubtask}
      onToggleSubtaskComplete={handleToggleSubtaskComplete}
      onCreateSubtaskInline={handleCreateSubtaskInline}
      onCancelDraft={handleCancelDraft}
      hideCloseButton={hideClose}
    />
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r bg-muted/10 flex-col h-full overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Categories</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Column - Todo List */}
      <div className="flex-1 flex flex-col lg:border-r h-full overflow-hidden">
        {/* Header */}
        <header className="border-b px-4">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-semibold truncate">
                {filters.categoryId
                  ? lists.find((c) => c.id === filters.categoryId)?.name || 'Todos'
                  : 'My Todos'}
              </h1>
              <Badge variant="secondary" className="text-xs shrink-0">
                {filteredTodos.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAICreateTodo} size="sm" variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">AI Create</span>
              </Button>
              <Button onClick={handleCreateTodo} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Todo</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={session.user.image || undefined} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.user.name || 'User'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Theme
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun className="mr-2 h-4 w-4" />
                    <span>Light</span>
                    {theme === 'light' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon className="mr-2 h-4 w-4" />
                    <span>Dark</span>
                    {theme === 'dark' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <Monitor className="mr-2 h-4 w-4" />
                    <span>System</span>
                    {theme === 'system' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={openDrawer}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Activity Log
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Filters */}
          <div className="pb-3">
            <TodoFilters
              filters={filters}
              onFiltersChange={setFilters}
              totalCount={todos.length}
              filteredCount={filteredTodos.length}
            />
          </div>
        </header>

        {/* Todo List */}
        <main className="flex-1 overflow-y-auto pb-10">
          <TodoList
            todos={filteredTodos}
            selectedTodoId={selectedTodo?.id || null}
            isLoading={todosLoading}
            draft={draft}
            aiLoadingTodos={aiLoadingTodos}
            onToggleComplete={handleToggleComplete}
            onSelectTodo={handleSelectTodo}
            onUpdateName={handleUpdateTodoName}
            onDelete={handleDeleteTodo}
            onAddSubtask={handleAddSubtask}
            onCancelDraft={handleCancelDraft}
            onDraftNameChange={handleDraftNameChange}
          />
        </main>
      </div>

      {/* Desktop Details */}
      <div className="hidden lg:flex h-full overflow-y-auto">
        {detailsContent(false)}
      </div>

      {/* Mobile Details Sheet */}
      <Sheet open={detailsOpen && isMobile} onOpenChange={(open) => {
        setDetailsOpen(open)
        if (!open) setSelectedTodo(null)
      }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Todo Details</SheetTitle>
          </SheetHeader>
          {detailsContent(true)}
        </SheetContent>
      </Sheet>

      {/* Dialogs - Only AI dialog and List dialog remain (inline editing replaces TodoDialog/SubtaskDialog) */}
      <AITodoDialog
        open={aiTodoDialogOpen}
        onOpenChange={setAiTodoDialogOpen}
        onSuccess={handleAITodoSuccess}
        onStartGeneration={handleAIStartGeneration}
        categories={lists}
      />

      <ListDialog
        open={listDialogOpen}
        onOpenChange={setListDialogOpen}
        onSubmit={handleListSubmit}
        editList={editingList}
        isSubmitting={
          createListMutation.isPending || updateListMutation.isPending
        }
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Todo</AlertDialogTitle>
            <AlertDialogDescription>
              {hasSubtasks
                ? 'Are you sure you want to delete this todo? This will also delete all subtasks. This action cannot be undone.'
                : 'Are you sure you want to delete this todo? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={subtaskDeleteDialogOpen} onOpenChange={setSubtaskDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subtask</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subtask? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubtaskDeleteConfirm}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
