export type UsersCode = 'forbidden' | 'invalidRequest' | 'invalidName' | 'invalidPhone' | 'invalidJob' | 'invalidEmail' | 'policy' | 'mismatch' | 'duplicateEmail' | 'notFound' | 'protected' | 'selfDeactivate' | 'avatarFailed' | 'failure';
export class UsersError extends Error {
  constructor(readonly code: UsersCode, readonly status = 400) { super(code); }
}
export class UsersCommitError extends Error {}
