import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'mcp-calls.jsonl');
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR))
        fs.mkdirSync(LOG_DIR, { recursive: true });
}
export function log(entry) {
    const full = { ts: new Date().toISOString(), ...entry };
    // Always write to stderr so it doesn't pollute MCP stdio transport
    process.stderr.write(`[${full.ts}] [${full.level.toUpperCase()}] [${full.type}]${full.tool ? ` ${full.tool}` : ''}${full.durationMs !== undefined ? ` (${full.durationMs}ms)` : ''}${full.error ? ` ERROR: ${full.error}` : ''}\n`);
    // Append JSON line to log file
    try {
        ensureLogDir();
        fs.appendFileSync(LOG_FILE, JSON.stringify(full) + '\n');
    }
    catch {
        // Non-fatal — log file write failure shouldn't crash the server
    }
}
/** Wraps an async function, logs its input/output/duration/errors */
export async function loggedCall(type, tool, input, fn) {
    const start = Date.now();
    log({ level: 'info', type, tool, input });
    try {
        const output = await fn();
        log({ level: 'info', type, tool, input, output, durationMs: Date.now() - start });
        return output;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log({ level: 'error', type, tool, input, error: msg, durationMs: Date.now() - start });
        throw err;
    }
}
//# sourceMappingURL=logger.js.map