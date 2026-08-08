import { AppError } from './app-error.js';

/**
 * A failure calling something outside this process.
 *
 * `permanent` is the important field: it tells the outbox worker whether
 * retrying could ever help. A 401 from the revalidation endpoint means the
 * secret is wrong — five retries produce five identical 401s and hide the real
 * problem behind a dead-letter row twenty minutes later.
 */
export class DependencyError extends AppError {
  readonly permanent: boolean;

  constructor(message: string, options: { permanent?: boolean; cause?: unknown } = {}) {
    super('DEPENDENCY_UNAVAILABLE', message, {
      isOperational: false,
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.permanent = options.permanent ?? false;
  }

  static isPermanent(error: unknown): boolean {
    return error instanceof DependencyError && error.permanent;
  }
}
