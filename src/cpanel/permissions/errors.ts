export class PermissionsError extends Error {
  constructor(readonly code: 'forbidden'|'protected'|'selfEdit'|'notFound'|'invalidRequest'|'failure', readonly status = 400) { super(code); }
}
