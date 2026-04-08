import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { anonymous } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import * as Sentry from '@sentry/tanstackstart-react'
import { db } from '../db'
// import { sendEmail } from './server/email'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 2,
    maxPasswordLength: 100,
    /**
     * Password reset delivery handler
     * In production, this should send an actual email.
     * Currently logs to Sentry for monitoring reset requests.
     */
    sendResetPassword: async ({ user, url }, _request) => {
      // Log password reset request to Sentry (without sensitive data)
      Sentry.logger.info('auth.password.reset.requested', {
        hasUserEmail: !!user.email,
        urlGenerated: !!url,
      })

      // Email sending disabled - uncomment below to re-enable
      // void Sentry.startSpan({ name: 'better-auth:sendResetPassword' }, async () => {
      //   try {
      //     await sendEmail({
      //       to: user.email,
      //       template: 'reset-password',
      //       data: {
      //         appName: 'Toodyloo',
      //         resetPasswordUrl: url,
      //       },
      //     })
      //     Sentry.logger.info('auth.password.reset.email.sent', {
      //       template: 'reset-password',
      //     })
      //   } catch (error) {
      //     Sentry.logger.error('auth.password.reset.email.failed', {
      //       errorType: error instanceof Error ? error.name : 'Unknown',
      //     })
      //     Sentry.captureException(error, {
      //       tags: { component: 'email', action: 'sendResetPassword' },
      //       extra: { userEmail: user.email },
      //     })
      //   }
      // }).catch((error) => {
      //   Sentry.captureException(error)
      // })
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET!,
  plugins: [
    tanstackStartCookies(),
    anonymous(),
  ],
  // Enable session caching for performance
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
})
