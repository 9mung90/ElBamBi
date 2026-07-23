export type AuthView = 'login' | 'signup' | null;

export type AuthRole = 'USER' | 'ADMIN';

export function normalizeAuthRole(role: unknown): AuthRole {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

export class LoginRequiredError extends Error {}

export class AuthRequestError extends Error {
  code: string;
  status: number;
  payload: unknown;

  constructor(status: number, message: string, code: string, payload: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}
