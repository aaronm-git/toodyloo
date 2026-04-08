import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth'

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

export async function requireAuthSession(): Promise<AuthSession> {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    throw new Response('Unauthorized', { status: 401 })
  }

  return session
}

export function throwNotFound(message = 'Not Found'): never {
  throw new Response(message, { status: 404 })
}

export function isHttpErrorResponse(error: unknown): error is Response {
  return error instanceof Response
}
