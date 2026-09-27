export type User = {
  id: string
  name: string
  email: string
}

/** Either nothing went wrong, or a message to show the user */
export type AuthResult = { error?: string }
