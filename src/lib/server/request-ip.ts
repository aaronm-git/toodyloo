import { createHash } from 'node:crypto'

const UNKNOWN_IP = 'unknown'

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null
  return value
    .split(',')
    .map((part) => part.trim())
    .find(Boolean) ?? null
}

export function getRequestIp(headers: Headers): string {
  return (
    firstForwardedIp(headers.get('x-forwarded-for')) ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-real-ip') ??
    UNKNOWN_IP
  )
}

export function getIpFingerprint(headers: Headers): string {
  return createHash('sha256').update(getRequestIp(headers)).digest('hex')
}
