import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (must be declared before the dynamic import) ──────────────────────

const mockPipeline = {
  del: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/matchmaking/leave-matched", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/matchmaking/leave-matched", () => {
  const WALLET = "0xPlayer1";
  const OPPONENT = "0xOpponent";
  const ROUND_ID = "0x" + "ab".repeat(32);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPipeline.del.mockReturnThis();
    mockPipeline.exec.mockResolvedValue([]);
    mockRedis.pipeline.mockReturnValue(mockPipeline);
  });

  // ── Input validation ────────────────────────────────────────────────────

  it("returns 400 when walletAddress is missing", async () => {
    const { POST } = await import(
      "@/app/api/matchmaking/leave-matched/route"
    );
    const res = await POST(makeRequest({ roundId: ROUND_ID }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing/i);
  });

  it("returns 400 when roundId is missing", async () => {
    const { POST } = await import(
      "@/app/api/matchmaking/leave-matched/route"
    );
    const res = await POST(makeRequest({ walletAddress: WALLET }));
    expect(res.status).toBe(400);
  });

  // ── Idempotency lock ────────────────────────────────────────────────────

  it("returns early with success when lock is already held (double-leave)", async () => {
    mockRedis.set.mockResolvedValueOnce(null); // lock NOT acquired
    const { POST } = await import(
      "@/app/api/matchmaking/leave-matched/route"
    );
    const res = await POST(makeRequest({ walletAddress: WALLET, roundId: ROUND_ID }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.playerState).toBe("left_after_stake");
    expect(json.message).toMatch(/already in progress/i);
    expect(mockRoundHasOnChainStakes).not.toHaveBeenCalled();
  });

  // ── Refund path ─────────────────────────────────────────────────────────

  it("refunds stake and marks round cancelled when player leaves after staking", async () => {
    mockRedis.set
      .mockResolvedValueOnce("OK") // lock acquired
      .mockResolvedValueOnce("OK"); // cancelled key stored
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify({ roundId: ROUND_ID, players: [WALLET, OPPONENT] }),
    );
    mockRoundHasOnChainStakes.mockResolvedValueOnce(true);
    mockIsRoundRefunded.mockResolvedValueOnce(false);
    mockBackendRefund.mockResolvedValueOnce({ txHash: "0xTXHASH", refunded: true });
    mockRedis.del.mockResolvedValue(1);

    const { POST } = await import(
      "@/app/api/matchmaking/leave-matched/route"
    );
    const res = await POST(makeRequest({ walletAddress: WALLET, roundId: ROUND_ID }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.playerState).toBe("left_after_stake");
    expect(json.refundTx).toBe("0xTXHASH");

    // Cancellation key must be written to Redis
    const cancelSetCall = mockRedis.set.mock.calls.find((c) =>
      String(c[0]).includes("cancelled"),
    );
    expect(cancelSetCall).toBeDefined();
    const payload = JSON.parse(cancelSetCall![1] as string);
    expect(payload.reason).toBe("player_left_after_stake");
    expect(payload.leftBy).toBe(WALLET);

    // Both players' match keys deleted
    expect(mockPipeline.del).toHaveBeenCalledWith(`match:${WALLET}`);
    expect(mockPipeline.del).toHaveBeenCalledWith(`match:${OPPONENT}`);
  });

  // ── No-stake path ───────────────────────────────────────────────────────

  it("skips refund when no on-chain stakes exist", async () => {
    mockRedis.set
      .mockResolvedValueOnce("OK") // lock
      .mockResolvedValueOnce("OK"); // cancelled key
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify({ roundId: ROUND_ID, players: [WALLET, OPPONENT] }),
    );
    mockRoundHasOnChainStakes.mockResolvedValueOnce(false);
    mockRedis.del.mockResolvedValue(1);

    const { POST } = await import(
      "@/app/api/matchmaking/leave-matched/route"
    );
    const res = await POST(makeRequest({ walletAddress: WALLET, roundId: ROUND_ID }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.refundTx).toBeNull();
    expect(mockBackendRefund).not.toHaveBeenCalled();
  });

  // ── Already refunded ────────────────────────────────────────────────────

  it("skips duplicate refund when round is already refunded on-chain", async () => {
    mockRedis.set
      .mockResolvedValueOnce("OK")
      .mockResolvedValueOnce("OK");
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify({ roundId: ROUND_ID, players: [WALLET, OPPONENT] }),
    );
    mockRoundHasOnChainStakes.mockResolvedValueOnce(true);
    mockIsRoundRefunded.mockResolvedValueOnce(true); // already refunded
    mockRedis.del.mockResolvedValue(1);

    const { POST } = await import(
      "@/app/api/matchmaking/leave-matched/route"
    );
    const res = await POST(makeRequest({ walletAddress: WALLET, roundId: ROUND_ID }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.refundTx).toBeNull();
    expect(mockBackendRefund).not.toHaveBeenCalled();
  });

  // ── Match data already cleaned up ───────────────────────────────────────

  it("returns success gracefully when match data is already gone", async () => {
    mockRedis.set.mockResolvedValueOnce("OK"); // lock
    mockRedis.get
      .mockResolvedValueOnce(null) // match key missing
      .mockResolvedValueOnce(null); // cancelled key not set
    mockRedis.del.mockResolvedValue(1);

    const { POST } = await import(
      "@/app/api/matchmaking/leave-matched/route"
    );
    const res = await POST(makeRequest({ walletAddress: WALLET, roundId: ROUND_ID }));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(mockBackendRefund).not.toHaveBeenCalled();
  });

  // ── Partial refund failure ──────────────────────────────────────────────

  it("still marks round cancelled when on-chain refund throws (partial failure)", async () => {
    mockRedis.set
      .mockResolvedValueOnce("OK")
      .mockResolvedValueOnce("OK");
    mockRedis.get.mockResolvedValueOnce(
      JSON.stringify({ roundId: ROUND_ID, players: [WALLET, OPPONENT] }),
    );
    mockRoundHasOnChainStakes.mockResolvedValueOnce(true);
    mockIsRoundRefunded.mockResolvedValueOnce(false);
    mockBackendRefund.mockRejectedValueOnce(new Error("RPC timeout"));
    mockRedis.del.mockResolvedValue(1);

    const { POST } = await import(
      "@/app/api/matchmaking/leave-matched/route"
    );
    const res = await POST(makeRequest({ walletAddress: WALLET, roundId: ROUND_ID }));
    const json = await res.json();

    // State must still be cleaned up even though refund failed
    expect(json.success).toBe(true);
    expect(json.refundTx).toBeNull();
    const cancelSetCall = mockRedis.set.mock.calls.find((c) =>
      String(c[0]).includes("cancelled"),
    );
    expect(cancelSetCall).toBeDefined();
  });
});
