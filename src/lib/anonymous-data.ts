import { todoWithRelationsSchema, type AIGeneratedTodo, type CreateListInput, type CreateSubtaskInput, type CreateTodoInput, type ListWithCount, type Subtask, type TodoWithRelations, type UpdateListInput, type UpdateSubtaskInput, type UpdateTodoInput } from './tasks'

function now() {
  return new Date()
}

function makeSubtaskId() {
  return crypto.randomUUID()
}

function getCachedTodos(queryClient: { getQueryData: (key: Array<string>) => unknown }) {
  return (queryClient.getQueryData(['todos']) as Array<TodoWithRelations> | undefined) ?? []
}

function getCachedLists(queryClient: { getQueryData: (key: Array<string>) => unknown }) {
  return (queryClient.getQueryData(['lists']) as Array<ListWithCount> | undefined) ?? []
}

export function recomputeAnonymousListCounts(
  lists: Array<ListWithCount>,
  todos: Array<TodoWithRelations>,
): Array<ListWithCount> {
  return lists.map((list) => ({
    ...list,
    todoCount: todos.filter((todo) => todo.listId === list.id).length,
  }))
}

export function createAnonymousTodo(
  queryClient: { getQueryData: (key: Array<string>) => unknown },
  userId: string,
  data: CreateTodoInput,
): TodoWithRelations {
  const lists = getCachedLists(queryClient)
  const createdAt = now()
  const todo = {
    id: crypto.randomUUID(),
    userId,
    name: data.name,
    description: data.description ?? '',
    priority: data.priority ?? 'low',
    isComplete: false,
    dueDate: data.dueDate ?? null,
    recurrenceType: null,
    recurrenceConfig: null,
    recurringTodoId: null,
    nextOccurrence: null,
    recurrenceEndDate: null,
    aiGenerated: false,
    createdAt,
    updatedAt: createdAt,
    listId: data.listId ?? null,
    list: data.listId ? lists.find((list) => list.id === data.listId) ?? null : null,
    subtasks: [],
  }

  return todoWithRelationsSchema.parse(todo)
}

export function updateAnonymousTodo(
  queryClient: { getQueryData: (key: Array<string>) => unknown },
  data: UpdateTodoInput,
): TodoWithRelations {
  const todo = getCachedTodos(queryClient).find((item) => item.id === data.id)

  if (!todo) {
    throw new Error('Todo not found')
  }

  const lists = getCachedLists(queryClient)
  const listId = data.listId !== undefined ? data.listId : todo.listId
  const updated = {
    ...todo,
    ...data,
    listId: listId ?? null,
    list: listId ? lists.find((list) => list.id === listId) ?? null : null,
    updatedAt: data.updatedAt ?? now(),
  }

  return todoWithRelationsSchema.parse(updated)
}

export function toggleAnonymousTodo(queryClient: { getQueryData: (key: Array<string>) => unknown }, id: string) {
  const todo = getCachedTodos(queryClient).find((item) => item.id === id)

  if (!todo) {
    throw new Error('Todo not found')
  }

  return todoWithRelationsSchema.parse({
    ...todo,
    isComplete: !todo.isComplete,
    updatedAt: now(),
  })
}

export function createAnonymousList(userId: string, data: CreateListInput): ListWithCount {
  const createdAt = now()
  return {
    id: crypto.randomUUID(),
    userId,
    name: data.name,
    color: data.color ?? null,
    createdAt,
    updatedAt: createdAt,
    todoCount: 0,
  }
}

export function updateAnonymousList(
  queryClient: { getQueryData: (key: Array<string>) => unknown },
  data: UpdateListInput,
): ListWithCount {
  const list = getCachedLists(queryClient).find((item) => item.id === data.id)

  if (!list) {
    throw new Error('List not found')
  }

  return {
    ...list,
    ...data,
    updatedAt: now(),
  }
}

export function createAnonymousSubtask(
  queryClient: { getQueryData: (key: Array<string>) => unknown },
  data: CreateSubtaskInput,
): Subtask {
  const todo = getCachedTodos(queryClient).find((item) => item.id === data.todoId)
  const createdAt = now()

  if (!todo) {
    throw new Error('Todo not found')
  }

  return {
    id: makeSubtaskId(),
    todoId: data.todoId,
    name: data.name,
    isComplete: false,
    orderIndex: data.orderIndex ?? String(todo.subtasks?.length ?? 0),
    createdAt,
    updatedAt: createdAt,
  }
}

export function updateAnonymousSubtask(
  queryClient: { getQueryData: (key: Array<string>) => unknown },
  data: UpdateSubtaskInput,
): Subtask {
  const subtask = getCachedTodos(queryClient)
    .flatMap((todo) => todo.subtasks ?? [])
    .find((item) => item.id === data.id)

  if (!subtask) {
    throw new Error('Subtask not found')
  }

  return {
    ...subtask,
    ...data,
    updatedAt: now(),
  }
}

export function toggleAnonymousSubtask(
  queryClient: { getQueryData: (key: Array<string>) => unknown },
  id: string,
): Subtask {
  const subtask = getCachedTodos(queryClient)
    .flatMap((todo) => todo.subtasks ?? [])
    .find((item) => item.id === id)

  if (!subtask) {
    throw new Error('Subtask not found')
  }

  return {
    ...subtask,
    isComplete: !subtask.isComplete,
    updatedAt: now(),
  }
}

export function createAnonymousTodoFromAi(
  queryClient: { getQueryData: (key: Array<string>) => unknown },
  userId: string,
  generated: AIGeneratedTodo,
): TodoWithRelations {
  const lists = getCachedLists(queryClient)
  const todoId = crypto.randomUUID()
  const matchedList =
    generated.suggestedLists.length > 0
      ? lists.find((list) =>
          generated.suggestedLists.some(
            (suggested) => suggested.toLowerCase() === list.name.toLowerCase(),
          ),
        ) ?? null
      : null
  const createdAt = now()

  return todoWithRelationsSchema.parse({
    id: todoId,
    userId,
    name: generated.name,
    description: generated.description ?? '',
    priority: generated.priority,
    isComplete: false,
    dueDate: generated.dueDate ? new Date(generated.dueDate) : null,
    recurrenceType: null,
    recurrenceConfig: null,
    recurringTodoId: null,
    nextOccurrence: null,
    recurrenceEndDate: null,
    aiGenerated: true,
    createdAt,
    updatedAt: createdAt,
    listId: matchedList?.id ?? null,
    list: matchedList,
    subtasks: (generated.subtasks ?? []).map((subtask, index) => ({
      id: makeSubtaskId(),
      todoId,
      name: subtask.name,
      isComplete: false,
      orderIndex: String(index),
      createdAt,
      updatedAt: createdAt,
    })),
  })
}
