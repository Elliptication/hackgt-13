'use client'

import { createContext, useCallback, useMemo, useReducer, useState } from 'react'

import { SAMPLE_CONTRIBUTIONS } from '@/data/SampleContributions'
import { useAuth } from '@/hooks/useAuth'
import { accessway, contributePhoto, isBackendDown } from '@/lib/api/accessway'
import { REWARD_CENTS } from '@/lib/constants'
import { applyVote } from '@/lib/contribute'
import type { Contribution, NewContribution, Vote } from '@/types/contribute'

/** A photo that reached the API, or the reason it did not. */
export type SubmitResult = {
  contribution: Contribution
  /** Null when the API accepted it. Set when it only exists on this device. */
  error: string | null
}

type ContributionsContextValue = {
  contributions: Contribution[]
  /** Signed-in user's id, or null when signed out */
  userId: string | null
  /** Votes the signed-in user has cast, by contribution id */
  myVotes: Record<string, Vote>
  /** What the signed-in user has earned */
  balanceCents: number
  /** Needs a signed-in user; resolves to null otherwise */
  submit: (input: NewContribution) => Promise<SubmitResult | null>
  /** Send a photo the API never received. Returns the reason if it fails again. */
  retryUpload: (id: string) => Promise<string | null>
  /** Which photo is being sent right now, if any */
  sending: string | null
  vote: (id: string, vote: Vote) => void
  /** Bring a report from the map into review, so it can be voted on here. */
  adopt: (contribution: Contribution) => void
  /** Demo only: pretend another user voted on one of your photos */
  simulateCommunityVote: (id: string, vote: Vote) => void
  /** Set when a vote was counted here but the API refused it */
  syncError: string | null
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
  /** A report opened from the map; ignored if it is already here */
  | { type: 'adopt'; contribution: Contribution }
  /** voterId is null for simulated community votes */
  | { type: 'vote'; id: string; vote: Vote; voterId: string | null }
  /** The API accepted an upload, so remember the rows it created */
  | { type: 'synced'; id: string; contributionId: string | null; featureId: string | null }
  /** The upload failed: keep the photo, but say it never left this device */
  | { type: 'unsent'; id: string; file: File | null }
  /** The API refused a vote, so take it back off the tally */
  | { type: 'rollback'; contribution: Contribution; voterId: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'submit':
      return { ...state, contributions: [action.contribution, ...state.contributions] }

    case 'adopt':
      if (state.contributions.some((c) => c.id === action.contribution.id)) return state
      return { ...state, contributions: [...state.contributions, action.contribution] }

    case 'synced':
      return {
        ...state,
        contributions: state.contributions.map((c) =>
          c.id === action.id
            ? {
                ...c,
                contributionId: action.contributionId ?? undefined,
                featureId: action.featureId ?? undefined,
                unsent: false,
                file: null,
              }
            : c,
        ),
      }

    case 'unsent':
      return {
        ...state,
        contributions: state.contributions.map((c) =>
          c.id === action.id ? { ...c, unsent: true, file: action.file } : c,
        ),
      }

    case 'rollback': {
      // Targeted, not a whole-state snapshot: someone can vote on the next photo
      // while this one is still in flight, and that vote must survive.
      const prior = action.contribution
      const current = state.contributions.find((c) => c.id === prior.id)
      const wasPaid = current?.status === 'approved' && prior.status !== 'approved'
      const votes = { ...state.votesByUser[action.voterId] }
      delete votes[prior.id]

      return {
        contributions: state.contributions.map((c) => (c.id === prior.id ? prior : c)),
        votesByUser: { ...state.votesByUser, [action.voterId]: votes },
        balances: wasPaid
          ? {
              ...state.balances,
              [prior.submittedBy]: Math.max(0, (state.balances[prior.submittedBy] ?? 0) - REWARD_CENTS),
            }
          : state.balances,
      }
    }

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
 * Photos people have added, and what the community makes of them.
 *
 * Two stores, not one, and on purpose:
 *
 *  - The API owns the truth. An upload goes through `/contributions` and a vote
 *    through `/vote`, so what counts is counted server-side, by its own rules
 *    (more than five votes, and better than a 0.6 ratio).
 *  - The reducer here is the *view*. It answers immediately, keeps the photo the
 *    uploader just picked — which only exists in this tab, as an object URL —
 *    and keeps the review queue working when the API is not up.
 *
 * So a failed upload is not swallowed and it does not lose the photo either:
 * it stays visible, marked as local-only, and `submit` returns the reason.
 */
export function ContributionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [syncError, setSyncError] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  const [state, dispatch] = useReducer(reducer, {
    contributions: SAMPLE_CONTRIBUTIONS,
    votesByUser: {},
    balances: {},
  })

  const submit = useCallback(
    async (input: NewContribution): Promise<SubmitResult | null> => {
      if (!userId) return null

      const contribution: Contribution = {
        type: input.type,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        photoUrl: input.photoUrl,
        id: crypto.randomUUID(),
        submittedBy: userId,
        submittedAt: Date.now(),
        confirms: 0,
        rejects: 0,
        status: 'pending',
      }
      // Shown before the upload finishes: the photo is already on the device,
      // and a spinner in place of it would be a step backwards.
      dispatch({ type: 'submit', contribution })
      setSending(contribution.id)

      if (!input.file) {
        dispatch({ type: 'unsent', id: contribution.id, file: null })
        setSending(null)
        return { contribution, error: 'This photo stayed on your device — there was no file to upload.' }
      }

      try {
        const created = await contributePhoto({
          file: input.file,
          lat: input.lat,
          lng: input.lng,
          type: input.type,
          name: input.name,
        })
        dispatch({
          type: 'synced',
          id: contribution.id,
          contributionId: created.contributionId,
          featureId: created.featureId,
        })
        return {
          contribution: {
            ...contribution,
            contributionId: created.contributionId ?? undefined,
            featureId: created.featureId ?? undefined,
          },
          error: null,
        }
      } catch (err) {
        // The photo is kept, and so is the file, so this is recoverable rather
        // than lost — see `retryUpload`.
        dispatch({ type: 'unsent', id: contribution.id, file: input.file })
        return { contribution, error: reasonFor(err) }
      } finally {
        setSending(null)
      }
    },
    [userId],
  )

  const retryUpload = useCallback(
    async (id: string) => {
      const target = state.contributions.find((c) => c.id === id)
      if (!target?.file) return 'The photo is no longer on this device, so it cannot be sent again.'

      setSending(id)
      try {
        const created = await contributePhoto({
          file: target.file,
          lat: target.lat,
          lng: target.lng,
          type: target.type,
          name: target.name,
        })
        dispatch({
          type: 'synced',
          id,
          contributionId: created.contributionId,
          featureId: created.featureId,
        })
        return null
      } catch (err) {
        return reasonFor(err)
      } finally {
        setSending(null)
      }
    },
    [state.contributions],
  )

  const vote = useCallback(
    (id: string, v: Vote) => {
      if (!userId) return
      const target = state.contributions.find((c) => c.id === id)
      dispatch({ type: 'vote', id, vote: v, voterId: userId })

      // Only photos the API knows about can be voted on there. The rest are
      // this session's own, and their tally stays local.
      if (!target?.contributionId) return
      accessway
        .vote({ contributionId: target.contributionId, userId, upvote: v === 'confirm' })
        .then(() => setSyncError(null))
        .catch((err: unknown) => {
          // A vote the API refused is not a vote. Leaving it on screen would
          // show a tally that does not exist anywhere but this tab.
          dispatch({ type: 'rollback', contribution: target, voterId: userId })
          setSyncError(`${reasonFor(err)} Your vote wasn’t counted — try again.`)
        })
    },
    [userId, state.contributions],
  )

  const adopt = useCallback((contribution: Contribution) => dispatch({ type: 'adopt', contribution }), [])

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
      retryUpload,
      sending,
      vote,
      adopt,
      simulateCommunityVote,
      syncError,
    }),
    [state, userId, submit, retryUpload, sending, vote, adopt, simulateCommunityVote, syncError],
  )

  return <ContributionsContext.Provider value={value}>{children}</ContributionsContext.Provider>
}

/** Said in the second person, because it is shown to whoever just tapped. */
function reasonFor(error: unknown) {
  if (isBackendDown(error)) return 'The AccessWay API isn’t answering, so this is saved on your device only.'
  return error instanceof Error ? error.message : 'Something went wrong sending this.'
}
