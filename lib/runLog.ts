import AsyncStorage from '@react-native-async-storage/async-storage';

export type RunLogLevel = 'info' | 'success' | 'warning' | 'error' | 'route';

export type RunLogEntry = {
  id: string;
  timestamp: string;
  level: RunLogLevel;
  title: string;
  message: string;
  route?: string;
  context?: string;
  details?: string;
};

type RunLogInput = Omit<RunLogEntry, 'id' | 'timestamp'>;
type RunLogListener = (entries: RunLogEntry[]) => void;

const RUN_LOG_STORAGE_KEY = 'victory_fitness_run_log_v1';
const RUN_LOG_LIMIT = 60;
const listeners = new Set<RunLogListener>();

function createRunLogId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeStringify(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return [value.name, value.message, value.stack].filter(Boolean).join(' | ');
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function notify(entries: RunLogEntry[]) {
  listeners.forEach((listener) => {
    try {
      listener(entries);
    } catch {
      // Ignore subscriber errors so logging remains non-blocking.
    }
  });
}

async function readStoredRunLogs(): Promise<RunLogEntry[]> {
  const raw = await AsyncStorage.getItem(RUN_LOG_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getRunLogs(): Promise<RunLogEntry[]> {
  return readStoredRunLogs();
}

export async function appendRunLog(input: RunLogInput): Promise<RunLogEntry> {
  const entry: RunLogEntry = {
    id: createRunLogId(),
    timestamp: new Date().toISOString(),
    ...input,
  };

  const entries = [entry, ...(await readStoredRunLogs())].slice(0, RUN_LOG_LIMIT);
  await AsyncStorage.setItem(RUN_LOG_STORAGE_KEY, JSON.stringify(entries));
  notify(entries);
  console.log(
    `[run-log] ${entry.level.toUpperCase()} | ${entry.title} | ${entry.message}`
      + `${entry.route ? ` | route=${entry.route}` : ''}`
      + `${entry.context ? ` | context=${entry.context}` : ''}`,
  );
  return entry;
}

export async function clearRunLogs(): Promise<void> {
  await AsyncStorage.removeItem(RUN_LOG_STORAGE_KEY);
  notify([]);
}

export function subscribeRunLog(listener: RunLogListener): () => void {
  listeners.add(listener);
  void readStoredRunLogs()
    .then((entries) => listener(entries))
    .catch(() => listener([]));
  return () => {
    listeners.delete(listener);
  };
}

export function formatRunLogMessage(args: unknown[]): string {
  return args.map(safeStringify).join(' | ');
}
