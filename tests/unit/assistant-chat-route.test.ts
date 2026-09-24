import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockState {
  user: { id: string } | null;
  project: { id: string; title: string; genre: string | null } | null;
  usageCount: number;
  manuscript: { tiptapJson: unknown; storyBible: unknown } | null;
  conversation: { id: string; title: string | null } | null;
  newConversationId: string;
  historyRows: Array<{ role: string; content: unknown }>;
  messages: Array<Record<string, unknown>>;
  usageClaims: Array<Record<string, unknown>>;
  usageCompletions: Array<Record<string, unknown>>;
  titles: string[];
  aiKeyConfigured: boolean;
}

const state: MockState = {
  user: null,
  project: null,
  usageCount: 0,
  manuscript: null,
  conversation: null,
  newConversationId: "22222222-2222-4222-8222-222222222222",
  historyRows: [],
  messages: [],
  usageClaims: [],
  usageCompletions: [],
  titles: [],
  aiKeyConfigured: true,
};

const USAGE_EVENT_ID = "44444444-4444-4444-8444-444444444444";

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => state.user,
}));

// The route talks to the database only through these query functions; each
// mock reads or records against `state`. Ownership scoping itself is covered
// by the real-Postgres authz tests in tests/integration/db/.
vi.mock("@/lib/db/queries/projects", () => ({
  getOwnedProject: async () => state.project,
}));

vi.mock("@/lib/db/queries/manuscripts", () => ({
  getManuscript: async () => state.manuscript,
}));

vi.mock("@/lib/db/queries/ai-usage", () => ({
  claimUsageEvent: async (userId: string, projectId: string, kind: string) => {
    state.usageClaims.push({ userId, projectId, kind });
    return USAGE_EVENT_ID;
  },
  countRecentUsage: async () => state.usageCount,
  completeUsageEvent: async (
    _userId: string,
    eventId: string,
    usage: Record<string, unknown>
  ) => {
    state.usageCompletions.push({ eventId, ...usage });
  },
}));

vi.mock("@/lib/db/queries/assistant", () => ({
  getConversation: async () => state.conversation,
  createConversation: async () => state.newConversationId,
  listMessages: async () => [...state.historyRows].reverse(),
  insertMessage: async (
    _userId: string,
    conversationId: string,
    message: Record<string, unknown>
  ) => {
    state.messages.push({ conversationId, ...message });
    return true;
  },
  touchConversation: async () => {},
  setConversationTitleIfUnset: async (
    _userId: string,
    _conversationId: string,
    title: string
  ) => {
    state.titles.push(title);
  },
}));

// The route pre-flights the model so a missing key is a 409 rather than an
// error inside an open stream. `state.aiKeyConfigured` drives that here.
vi.mock("@/lib/ai/assistant/models", () => ({
  resolveModelForUser: vi.fn(async () => {
    if (!state.aiKeyConfigured) {
      const { NoAIKeyConfiguredError } = await import("@/lib/ai/errors");
      throw new NoAIKeyConfiguredError("anthropic");
    }
    return {
      model: {},
      spec: "anthropic:claude-sonnet-4-6",
      keySource: "user" as const,
    };
  }),
}));

vi.mock("@/lib/ai/assistant/chat", () => ({
  streamAssistantChat: vi.fn(async function* () {
    yield { type: "text_delta", text: "Her eyes " };
    yield {
      type: "tool_call",
      id: "t1",
      name: "read_chapter",
      input: { chapter_index: 1 },
    };
    yield {
      type: "tool_result",
      id: "t1",
      name: "read_chapter",
      meta: { chapter_index: 1, title: "One", word_count: 4 },
    };
    yield { type: "text_delta", text: "are green." };
    yield {
      type: "done",
      text: "Her eyes are green.",
      toolCalls: [
        {
          id: "t1",
          name: "read_chapter",
          input: { chapter_index: 1 },
          meta: { chapter_index: 1, title: "One", word_count: 4 },
        },
      ],
      usage: {
        inputTokens: 1200,
        outputTokens: 80,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      model: "anthropic:claude-sonnet-4-6",
      latencyMs: 42,
    };
  }),
}));

vi.mock("@/lib/ai/assistant/title", () => ({
  generateConversationTitle: vi.fn(async () => "Eye color check"),
}));

// Import AFTER mocks are registered.
import { POST } from "@/app/api/ai/assistant/chat/route";
import { generateConversationTitle } from "@/lib/ai/assistant/title";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/ai/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function parseFrames(raw: string): Array<{ event: string; data: unknown }> {
  return raw
    .split("\n\n")
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const lines = block.split("\n");
      const event = lines
        .find((l) => l.startsWith("event:"))!
        .slice(6)
        .trim();
      const data = JSON.parse(
        lines
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("\n")
      );
      return { event, data };
    });
}

const validDoc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "One" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Elena walked the pier at dawn." }],
    },
  ],
};

beforeEach(() => {
  vi.stubEnv("AI_RATELIMIT_DISABLED", "");
  state.user = { id: "user-1" };
  state.aiKeyConfigured = true;
  state.project = { id: PROJECT_ID, title: "Tides", genre: "fantasy" };
  state.usageCount = 0;
  state.manuscript = { tiptapJson: validDoc, storyBible: null };
  state.conversation = null;
  state.historyRows = [];
  state.messages = [];
  state.usageClaims = [];
  state.usageCompletions = [];
  state.titles = [];
  vi.mocked(generateConversationTitle).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/ai/assistant/chat", () => {
  it("401s without a session", async () => {
    state.user = null;
    const res = await POST(makeRequest({ projectId: PROJECT_ID, message: "hi" }));
    expect(res.status).toBe(401);
  });

  it("400s on an invalid body", async () => {
    const res = await POST(makeRequest({ projectId: "nope", message: "" }));
    expect(res.status).toBe(400);
  });

  it("409s with no_ai_key when no API key is configured", async () => {
    state.aiKeyConfigured = false;
    const res = await POST(makeRequest({ projectId: PROJECT_ID, message: "hi" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("no_ai_key");
  });

  it("does not spend throttle budget when there is no API key", async () => {
    state.aiKeyConfigured = false;
    await POST(makeRequest({ projectId: PROJECT_ID, message: "hi" }));
    expect(state.usageClaims).toHaveLength(0);
  });

  it("404s for a project the user does not own", async () => {
    state.project = null;
    const res = await POST(makeRequest({ projectId: PROJECT_ID, message: "hi" }));
    expect(res.status).toBe(404);
  });

  it("429s past the per-minute throttle", async () => {
    // The request claims its own usage row before counting, so the window
    // count includes it — 11 rows means 10 prior turns plus this one.
    state.usageCount = 11;
    const res = await POST(makeRequest({ projectId: PROJECT_ID, message: "hi" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("rate_limited");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("skips the throttle when AI_RATELIMIT_DISABLED is true", async () => {
    state.usageCount = 11;
    vi.stubEnv("AI_RATELIMIT_DISABLED", "true");
    const res = await POST(
      makeRequest({ projectId: PROJECT_ID, message: "hi" })
    );
    expect(res.status).toBe(200);
  });

  it("404s when there is no manuscript", async () => {
    state.manuscript = { tiptapJson: null, storyBible: null };
    const res = await POST(makeRequest({ projectId: PROJECT_ID, message: "hi" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("no_manuscript");
  });

  it("streams the conversation and persists both messages and usage", async () => {
    const res = await POST(
      makeRequest({
        projectId: PROJECT_ID,
        message: "What color are Elena's eyes?",
        locale: "en",
        context: { chapterIndex: 1 },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const frames = parseFrames(await res.text());
    const events = frames.map((f) => f.event);
    expect(events[0]).toBe("meta");
    expect(events).toContain("text_delta");
    expect(events).toContain("tool_call");
    expect(events).toContain("tool_result");
    expect(events[events.length - 1]).toBe("done");

    const meta = frames[0].data as { conversationId: string };
    expect(meta.conversationId).toBe(state.newConversationId);

    const done = frames[frames.length - 1].data as {
      conversationId: string;
      usage: { inputTokens: number; outputTokens: number };
    };
    expect(done.usage).toEqual({ inputTokens: 1200, outputTokens: 80 });

    const messageInserts = state.messages;
    expect(messageInserts).toHaveLength(2);
    expect(messageInserts[0]).toMatchObject({
      role: "user",
      content: { text: "What color are Elena's eyes?" },
    });
    expect(messageInserts[1]).toMatchObject({
      role: "assistant",
      content: { text: "Her eyes are green." },
      inputTokens: 1200,
      outputTokens: 80,
      model: "anthropic:claude-sonnet-4-6",
    });

    // The usage row is claimed up front at zero tokens, then filled in.
    const usageInserts = state.usageClaims;
    expect(usageInserts).toHaveLength(1);
    expect(usageInserts[0]).toEqual({
      userId: "user-1",
      projectId: PROJECT_ID,
      kind: "assistant_chat",
    });
    const usageUpdates = state.usageCompletions;
    expect(usageUpdates).toHaveLength(1);
    expect(usageUpdates[0]).toMatchObject({
      eventId: USAGE_EVENT_ID,
      inputTokens: 1200,
      outputTokens: 80,
      model: "anthropic:claude-sonnet-4-6",
    });
    expect(JSON.stringify(usageInserts[0])).not.toContain("Elena");
    expect(JSON.stringify(usageUpdates[0])).not.toContain("Elena");

    // New conversation → auto-titled, after the stream has already closed.
    await vi.waitFor(() => {
      expect(generateConversationTitle).toHaveBeenCalledOnce();
      expect(state.titles).toEqual(["Eye color check"]);
    });
  });

  it("404s when the manuscript has no readable chapters", async () => {
    state.manuscript = {
      tiptapJson: { type: "doc", content: [{ type: "paragraph" }] },
      storyBible: null,
    };
    const res = await POST(makeRequest({ projectId: PROJECT_ID, message: "hi" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("no_manuscript");
    // Nothing was persisted for a book the assistant cannot read.
    expect(state.messages).toHaveLength(0);
  });

  it("reuses an existing conversation without re-titling it", async () => {
    state.conversation = {
      id: "33333333-3333-4333-8333-333333333333",
      title: "Existing",
    };
    state.historyRows = [
      { role: "assistant", content: { text: "Earlier reply" } },
      { role: "user", content: { text: "Earlier question" } },
    ];
    const res = await POST(
      makeRequest({
        projectId: PROJECT_ID,
        conversationId: state.conversation.id,
        message: "Follow-up",
      })
    );
    expect(res.status).toBe(200);
    const frames = parseFrames(await res.text());
    const meta = frames[0].data as { conversationId: string };
    expect(meta.conversationId).toBe(state.conversation.id);
    expect(generateConversationTitle).not.toHaveBeenCalled();
  });

  it("404s for a conversation that is not the user's", async () => {
    state.conversation = null;
    const res = await POST(
      makeRequest({
        projectId: PROJECT_ID,
        conversationId: "33333333-3333-4333-8333-333333333333",
        message: "hi",
      })
    );
    expect(res.status).toBe(404);
  });
});
