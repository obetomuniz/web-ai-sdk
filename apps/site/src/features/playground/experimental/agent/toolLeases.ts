import type { AgentToolLease, AgentToolLeaseScope } from "./types.js";

// SDK caches never evict leased sessions, so the agent bounds them itself.
const MAX_PREPARED_SESSIONS = 4;

/**
 * Keeps prepared SDK sessions for one agent so matching calls reuse them.
 * Releasing the final lease destroys the SDK session, so the agent releases
 * only on destroy (mode or conversation change, unmount) or eviction.
 */
export function createToolLeaseScope(): AgentToolLeaseScope & {
  releaseAll(): void;
} {
  const leases = new Map<string, AgentToolLease>();
  const drop = (key: string, lease: AgentToolLease) => {
    if (leases.get(key) !== lease) return;
    leases.delete(key);
    lease.release();
  };
  return {
    acquire(key, prepare) {
      const existing = leases.get(key);
      if (existing) {
        leases.delete(key);
        leases.set(key, existing);
        return existing;
      }
      const lease = prepare();
      leases.set(key, lease);
      // Failed creation leaves the SDK cache; drop it so a later call retries.
      lease.ready.catch(() => drop(key, lease));
      if (leases.size > MAX_PREPARED_SESSIONS) {
        const [oldestKey, oldest] = leases.entries().next().value ?? [];
        if (oldestKey !== undefined && oldest) drop(oldestKey, oldest);
      }
      return lease;
    },
    releaseAll() {
      for (const lease of leases.values()) lease.release();
      leases.clear();
    },
  };
}
