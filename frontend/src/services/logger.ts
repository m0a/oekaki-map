import { client, callRpc } from './rpc';

/**
 * Logger service for sending client-side logs to backend
 */
export const logger = {
  /**
   * Log an error to the backend
   */
  async error(message: string, stack?: string, context?: Record<string, unknown>): Promise<void> {
    try {
      await callRpc(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        client.api.logs.error.$post({
          json: {
            message,
            stack: stack || '',
            context: context || {},
          },
        })
      );
    } catch (err) {
      // Fail silently to avoid infinite error loops
      console.error('Failed to send error log:', err);
    }
  },

  /**
   * Log debug information to the backend
   */
  async debug(message: string, context?: Record<string, unknown>): Promise<void> {
    try {
      await callRpc(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        client.api.logs.debug.$post({
          json: {
            message,
            context: context || {},
          },
        })
      );
    } catch (err) {
      // Fail silently
      console.error('Failed to send debug log:', err);
    }
  },
};
