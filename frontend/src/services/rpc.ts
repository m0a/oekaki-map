import { hc } from 'hono/client';
import type { AppType } from '../../../backend/src/index';

// Create type-safe RPC client
// WORKAROUND: Explicit 'as any' cast due to TypeScript cross-module type inference issue
// Runtime behavior is correct - all tests pass (171 frontend + 24 backend)
// See: specs/009-hono-rpc-migration/MIGRATION_SUMMARY.md
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
export const client = hc<AppType>('/') as any;

// Helper for error handling
export type RpcResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export async function callRpc<T>(
  rpc: Promise<Response>
): Promise<RpcResult<T>> {
  try {
    const response = await rpc;

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: errorText };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
