export type LogLevel = 'info' | 'warn' | 'error';
export interface LogEntry {
    ts: string;
    level: LogLevel;
    type: 'mcp-tool-call' | 'mcp-tool-result' | 'llm-request' | 'llm-response' | 'system';
    tool?: string;
    input?: unknown;
    output?: unknown;
    durationMs?: number;
    error?: string;
}
export declare function log(entry: Omit<LogEntry, 'ts'>): void;
/** Wraps an async function, logs its input/output/duration/errors */
export declare function loggedCall<T>(type: LogEntry['type'], tool: string, input: unknown, fn: () => Promise<T>): Promise<T>;
