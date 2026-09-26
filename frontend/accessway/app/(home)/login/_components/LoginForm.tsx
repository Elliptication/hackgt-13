'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useAuth } from '@/hooks/useAuth'
import { REWARD_CENTS } from '@/lib/constants'

/**
 * One page for logging in and signing up:
 *   1. Enter your email.
 *   2. Known email → enter your password. New email → pick a name and password.
 */
type Step = 'email' | 'password' | 'create'
type Errors = Partial<Record<'email' | 'name' | 'password' | 'form', string>>

const COPY: Record<Step, { title: string; subtitle: string }> = {
  email: {
    title: 'Log in',
    subtitle: `Add photos, check others’ photos, and earn ${REWARD_CENTS}¢ for every one that’s approved.`,
  },
  password: { title: 'Welcome back', subtitle: 'Enter your password to log in.' },
  create: { title: 'Create your account', subtitle: 'Looks like you’re new here. It only takes a second.' },
}

const submitClass =
  'h-11 w-full rounded-full bg-primary text-[15px] font-medium text-primary-foreground shadow-[0_2px_8px_-2px_rgb(11_107_203/0.35)] transition hover:bg-primary-hover'

export function LoginForm({ next }: { next: string }) {
  const { hasAccount, logIn, signUp } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  function continueWithEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErrors({ email: 'Enter a valid email address.' })
    setErrors({})
    setPassword('')
    setStep(hasAccount(email) ? 'password' : 'create')
  }

  function logInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return setErrors({ password: 'Enter your password.' })
    const { error } = logIn({ email, password })
    if (error) return setErrors({ form: error })
    router.push(next)
  }

  function createAccount(e: React.FormEvent) {
    e.preventDefault()
    const found: Errors = {}
    if (!name.trim()) found.name = 'What should we call you?'
    if (password.length < 8) found.password = 'Use at least 8 characters.'
    if (Object.keys(found).length) return setErrors(found)
    const { error } = signUp({ name, email, password })
    if (error) return setErrors({ form: error })
    router.push(next)
  }

  function changeEmail() {
    setStep('email')
    setErrors({})
    setPassword('')
  }

  const { title, subtitle } = COPY[step]

  return (
    <AuthCard
      title={title}
      subtitle={subtitle}
      footer={step === 'email' ? 'New here? Just enter your email and we’ll set you up.' : null}
    >
      {errors.form && (
        <p role="alert" className="mb-4 rounded-xl bg-[var(--tag-red-bg)] px-3.5 py-2.5 text-sm">
          {errors.form}
        </p>
      )}

      {step === 'email' ? (
        <form onSubmit={continueWithEmail} noValidate className="space-y-4">
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <button type="submit" className={submitClass}>
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={step === 'password' ? logInWithPassword : createAccount} noValidate className="space-y-4">
          {/* The email they entered, with a way back to fix it */}
          <div className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3.5 py-2.5 ring-1 ring-border">
            <span className="min-w-0 truncate text-[15px]">{email.trim()}</span>
            <button
              type="button"
              onClick={changeEmail}
              className="shrink-0 rounded-full px-2 py-0.5 text-sm font-medium text-primary hover:bg-primary-soft"
            >
              Change
            </button>
          </div>

          {step === 'create' && (
            <Field
              label="Name"
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />
          )}

          <Field
            label={step === 'create' ? 'Choose a password' : 'Password'}
            type="password"
            autoComplete={step === 'create' ? 'new-password' : 'current-password'}
            autoFocus={step === 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={step === 'create' ? 'At least 8 characters.' : undefined}
            error={errors.password}
          />

          <button type="submit" className={submitClass}>
            {step === 'create' ? 'Create account' : 'Log in'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}
