import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  srem: vi.fn(),
};

vi.mock("@/lib/db/redis", () => ({
  redis: mockRedis,
  parseRedisJson: <T>(val: unknown): T | null => {
    if (val == null) return null;
    if (typeof val === "string") {
      try {
        return JSON.parse(val) as T;
      } catch {
        return null;
      }
    }
    return val as T;
  },
}));

const mockBackendRefund = vi.fn();
const mockIsRoundRefunded = vi.fn();
const mockRoundHasOnChainStakes = vi.fn();

vi.mock("@/lib/sc/refund", () => ({
  backendRefund: mockBackendRefund,
  isRoundRefunded: mockIsRoundRefunded,
  roundHasOnChainStakes: mockRoundHasOnChainStakes,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/matchmaking/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/matchmaking/cancel (leave queue)", () => {
  const WALLET = "0xPlayer1";
  const ROUND_ID = "0x" + "cd".repeat(32);
  const MODE = 1; // duel

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Input validation ────────────────────────────────────────────────────

  it("returns 400 when walletAddress is missing", async () => {
    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    const res = await POST(makeRequest({ mode: MODE }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when mode is missing", async () => {
    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    const res = await POST(makeRequest({ walletAddress: WALLET }));
    expect(res.status).toBe(400);
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  it("removes player from queue and returns playerState=left_queue", async () => {
    mockRedis.set.mockResolvedValueOnce("OK"); // lock acquired
    mockRedis.srem.mockResolvedValueOnce(1); // removed from queue
    mockRedis.del.mockResolvedValue(1);
    mockRedis.get.mockResolvedValueOnce(null); // no match data

    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    const res = await POST(makeRequest({ walletAddress: WALLET, mode: MODE }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.playerState).toBe("left_queue");
    expect(json.queueState.removed).toBe(true);
    expect(json.refundTx).toBeNull();

    // Queue set and heartbeat key must have been cleaned up
    expect(mockRedis.srem).toHaveBeenCalledWith(`queue:mode:${MODE}`, WALLET);
  });

  it("returns success even when player was not in the queue (idempotent)", async () => {
    mockRedis.set.mockResolvedValueOnce("OK");
    mockRedis.srem.mockResolvedValueOnce(0); // not in queue
    mockRedis.del.mockResolvedValue(1);
    mockRedis.get.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    const res = await POST(makeRequest({ walletAddress: WALLET, mode: MODE }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.queueState.removed).toBe(false);
    expect(json.message).toMatch(/already cleaned up/i);
  });

  // ── Double-leave (race-condition) ───────────────────────────────────────

  it("returns early when lock is held — prevents concurrent cancel (race condition)", async () => {
    mockRedis.set.mockResolvedValueOnce(null); // lock NOT acquired

    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    const res = await POST(makeRequest({ walletAddress: WALLET, mode: MODE }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.playerState).toBe("left_queue");
    expect(json.message).toMatch(/already in progress/i);
    // No actual queue mutation should occur
    expect(mockRedis.srem).not.toHaveBeenCalled();
  });

  // ── Concurrent join + leave race condition ──────────────────────────────

  it("handles concurrent join+leave: second cancel gets lock, first already released", async () => {
    // Simulate Player A calling cancel twice rapidly:
    // First call acquires lock, second call sees lock held → both succeed idempotently.
    mockRedis.set
      .mockResolvedValueOnce("OK")    // first call: lock acquired
      .mockResolvedValueOnce(null);   // second concurrent call: lock held

    mockRedis.srem.mockResolvedValueOnce(1);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.get.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    const [res1, res2] = await Promise.all([
      POST(makeRequest({ walletAddress: WALLET, mode: MODE })),
      POST(makeRequest({ walletAddress: WALLET, mode: MODE })),
    ]);

    const [j1, j2] = await Promise.all([res1.json(), res2.json()]);
    // Both must succeed — one actually removes, one is a no-op
    expect(j1.success).toBe(true);
    expect(j2.success).toBe(true);
  });

  // ── Refund path ─────────────────────────────────────────────────────────

  it("issues refund when player already matched and has on-chain stake", async () => {
    mockRedis.set.mockResolvedValueOnce("OK");
    mockRedis.srem.mockResolvedValueOnce(0); // not in queue (already matched)
    mockRedis.del.mockResolvedValue(1);
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify({ roundId: ROUND_ID, players: [WALLET, "0xOpp"] }),
    );
    mockRoundHasOnChainStakes.mockResolvedValueOnce(true);
    mockIsRoundRefunded.mockResolvedValueOnce(false);
    mockBackendRefund.mockResolvedValueOnce({ txHash: "0xREFUND", refunded: true });

    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    const res = await POST(makeRequest({ walletAddress: WALLET, mode: MODE }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.refundTx).toBe("0xREFUND");
    expect(mockBackendRefund).toHaveBeenCalledWith(ROUND_ID);
  });

  it("skips refund when round already refunded on-chain", async () => {
    mockRedis.set.mockResolvedValueOnce("OK");
    mockRedis.srem.mockResolvedValueOnce(0);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify({ roundId: ROUND_ID, players: [WALLET] }),
    );
    mockRoundHasOnChainStakes.mockResolvedValueOnce(true);
    mockIsRoundRefunded.mockResolvedValueOnce(true); // already done

    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    const res = await POST(makeRequest({ walletAddress: WALLET, mode: MODE }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.refundTx).toBeNull();
    expect(mockBackendRefund).not.toHaveBeenCalled();
  });

  // ── Private room queue ──────────────────────────────────────────────────

  it("removes from room queue when roomCode is provided", async () => {
    const ROOM_CODE = "ABCD12";
    mockRedis.set.mockResolvedValueOnce("OK");
    mockRedis.srem.mockResolvedValueOnce(1);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.get.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/matchmaking/cancel/route");
    await POST(makeRequest({ walletAddress: WALLET, mode: MODE, roomCode: ROOM_CODE }));

    expect(mockRedis.srem).toHaveBeenCalledWith(
      `queue:room:${ROOM_CODE}`,
      WALLET,
    );
  });
});
