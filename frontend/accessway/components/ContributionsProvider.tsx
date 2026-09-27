'use client'

import { createContext, useCallback, useMemo, useReducer } from 'react'

import { SAMPLE_CONTRIBUTIONS } from '@/data/SampleContributions'
import { useAuth } from '@/hooks/useAuth'
import { REWARD_CENTS } from '@/lib/constants'
import { applyVote } from '@/lib/contribute'
import type { Contribution, NewContribution, Vote } from '@/types/contribute'

type ContributionsContextValue = {
  contributions: Contribution[]
  /** Signed-in user's id, or null when signed out */
  userId: string | null
  /** Votes the signed-in user has cast, by contribution id */
  myVotes: Record<string, Vote>
  /** What the signed-in user has earned */
  balanceCents: number
  /** Needs a signed-in user; returns null otherwise */
  submit: (input: NewContribution) => Contribution | null
  vote: (id: string, vote: Vote) => void
  /** Demo only: pretend another user voted on one of your photos */
  simulateCommunityVote: (id: string, vote: Vote) => void
}

export const ContributionsContext = createContext<ContributionsContextValue | null>(null)

type State = {
  contributions: Contribution[]
  /** userId → (contributionId → vote) */
  votesByUser: Record<string, Record<string, Vote>>
  /** userId → cents earned */
  balances: Record<string, number>
}

type Action =
  | { type: 'submit'; contribution: Contribution }
  /** voterId is null for simulated community votes */
  | { type: 'vote'; id: string; vote: Vote; voterId: string | null }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'submit':
      return { ...state, contributions: [action.contribution, ...state.contributions] }

    case 'vote': {
      const { id, vote, voterId } = action
      const target = state.contributions.find((c) => c.id === id)
      if (!target || target.status !== 'pending') return state
      // You can't review your own photo, or vote twice
      if (voterId && (target.submittedBy === voterId || state.votesByUser[voterId]?.[id])) return state

      const next = applyVote(target, vote)
      // Pay the uploader the moment their photo flips to approved
      const justApproved = next.status === 'approved'
      const uploader = target.submittedBy

      return {
        contributions: state.contributions.map((c) => (c.id === id ? next : c)),
        votesByUser: voterId
          ? { ...state.votesByUser, [voterId]: { ...state.votesByUser[voterId], [id]: vote } }
          : state.votesByUser,
        balances: justApproved
          ? { ...state.balances, [uploader]: (state.balances[uploader] ?? 0) + REWARD_CENTS }
          : state.balances,
      }
    }
  }
}

const NO_VOTES: Record<string, Vote> = {}

/**
 * In-memory store for the demo. Everything resets on page reload.
 * To hook up a backend, send `submit` and `vote` to your API and load
 * contributions / balances from the server instead of SAMPLE_CONTRIBUTIONS.
 */
export function ContributionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [state, dispatch] = useReducer(reducer, {
    contributions: SAMPLE_CONTRIBUTIONS,
    votesByUser: {},
    balances: {},
  })

  const submit = useCallback(
    (input: NewContribution) => {
      if (!userId) return null
      const contribution: Contribution = {
        ...input,
        id: crypto.randomUUID(),
        submittedBy: userId,
        submittedAt: Date.now(),
        confirms: 0,
        rejects: 0,
        status: 'pending',
      }
      dispatch({ type: 'submit', contribution })
      return contribution
    },
    [userId],
  )

  const vote = useCallback(
    (id: string, v: Vote) => {
      if (userId) dispatch({ type: 'vote', id, vote: v, voterId: userId })
    },
    [userId],
  )

  const simulateCommunityVote = useCallback(
    (id: string, v: Vote) => dispatch({ type: 'vote', id, vote: v, voterId: null }),
    [],
  )

  const value = useMemo(
    () => ({
      contributions: state.contributions,
      userId,
      myVotes: (userId && state.votesByUser[userId]) || NO_VOTES,
      balanceCents: (userId && state.balances[userId]) || 0,
      submit,
      vote,
      simulateCommunityVote,
    }),
    [state, userId, submit, vote, simulateCommunityVote],
  )

  return <ContributionsContext.Provider value={value}>{children}</ContributionsContext.Provider>
}
