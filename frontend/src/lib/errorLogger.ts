interface ErrorLog {
  message: string;
  stack?: string | undefined;
  url: string;
  userAgent?: string | undefined;
  timestamp: string;
  extra?: Record<string, unknown> | undefined;
}

export async function logError(error: Error, extra?: Record<string, unknown>) {
  const errorLog: ErrorLog = {
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    extra,
  };

  // Also log to console for local debugging
  console.error('[Error Logger]', errorLog);

  try {
    await fetch('/api/logs/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorLog),
    });
  } catch (e) {
    // Don't throw if logging fails
    console.error('[Error Logger] Failed to send error log:', e);
  }
}

// Log debug info to server
export async function logDebug(event: string, data: Record<string, unknown>) {
  const debugLog = {
    event,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    ...data,
  };

  console.log('[Debug]', debugLog);

  try {
    await fetch('/api/logs/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(debugLog),
    });
  } catch (e) {
    // Don't throw if logging fails
    console.error('[Debug Logger] Failed to send debug log:', e);
  }
}

// Global error handler
export function setupGlobalErrorHandler() {
  // Catch unhandled errors
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = typeof message === 'string' ? message : 'Unknown error';
    void logError(error ?? new Error(errorMessage), {
      source,
      lineno,
      colno,
    });
  };

  // Catch unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));
    void logError(error, { type: 'unhandledrejection' });
  };
}
