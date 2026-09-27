'use client'

import { useContext } from 'react'

import { ContributionsContext } from '@/components/ContributionsProvider'

export function useContributions() {
  const ctx = useContext(ContributionsContext)
  if (!ctx) throw new Error('useContributions must be used inside <ContributionsProvider>')
  return ctx
}
