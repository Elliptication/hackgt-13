import { useId } from 'react'

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export function Field({ label, error, hint, ...input }: FieldProps) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`mt-1.5 w-full rounded-xl bg-surface px-3.5 py-2.5 text-[15px] ring-1 outline-none placeholder:text-subtle focus:bg-background focus:ring-2 focus:ring-ring ${error ? 'ring-[var(--tag-red)]' : 'ring-border'}`}
        {...input}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-[var(--tag-red)]">
          {error}
        </p>
      )}
    </div>
  )
}
