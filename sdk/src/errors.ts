/** Thrown for any non-2xx response from the SafeSQL Pro API. */
export class SafeSQLError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SafeSQLError';
    this.status = status;
  }
}
