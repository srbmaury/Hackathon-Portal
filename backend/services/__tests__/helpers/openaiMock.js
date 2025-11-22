import { vi } from "vitest";

/**
 * Reusable OpenAI mocking utility for testing AI services
 * Provides configurable mock responses for different scenarios
 */

/**
 * Create a mock OpenAI completion response
 */
export function createMockCompletion(content, options = {}) {
  return {
    choices: [
      {
        message: {
          content: typeof content === "string" ? content : JSON.stringify(content),
          role: "assistant",
        },
        finish_reason: "stop",
        index: 0,
      },
    ],
    created: Date.now(),
    id: `chatcmpl-${Math.random().toString(36).substring(7)}`,
    model: options.model || "gpt-4o-mini",
    object: "chat.completion",
    usage: {
      completion_tokens: 50,
      prompt_tokens: 100,
      total_tokens: 150,
    },
  };
}

/**
 * Create a mock OpenAI instance with configurable responses
 */
export function createMockOpenAI(config = {}) {
  const {
    shouldSucceed = true,
    response = null,
    error = null,
    delay = 0,
  } = config;

  return {
    chat: {
      completions: {
        create: vi.fn(async (params) => {
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          if (!shouldSucceed) {
            throw error || new Error("OpenAI API error");
          }

          // If response is provided, use it
          if (response) {
            return createMockCompletion(response, { model: params.model });
          }

          // Default responses based on common patterns
          if (params.response_format?.type === "json_object") {
            return createMockCompletion({ result: "success" }, { model: params.model });
          }

          return createMockCompletion("Mock AI response", { model: params.model });
        }),
      },
    },
  };
}

/**
 * Mock the entire OpenAI module
 */
export function mockOpenAIModule(mockInstance = null) {
  vi.mock("openai", () => {
    return {
      default: vi.fn(() => mockInstance || createMockOpenAI()),
    };
  });
}

/**
 * Create specific mock responses for common AI service patterns
 */
export const mockResponses = {
  // Formatting response
  formatting: (title, description) => ({
    title: title || "Formatted Title",
    description: description || "Formatted Description",
  }),

  // Round suggestion response
  roundSuggestion: (roundNumber = 1) => ({
    name: `Round ${roundNumber}`,
    description: `Description for Round ${roundNumber}`,
    startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    endDate: new Date(Date.now() + 7 * 86400000).toISOString(), // Next week
    isActive: true,
    hideScores: false,
  }),

  // Multiple rounds suggestion
  multipleRounds: (count = 3) => {
    return Array.from({ length: count }, (_, i) =>
      mockResponses.roundSuggestion(i + 1)
    );
  },

  // Announcement formatting
  announcementFormat: {
    title: "Enhanced Announcement Title",
    message: "Enhanced announcement message with better formatting and clarity.",
  },

  // Idea evaluation
  ideaEvaluation: (score = 85) => ({
    score,
    strengths: ["Well-defined problem", "Clear solution approach"],
    weaknesses: ["Needs more technical details", "Timeline could be more specific"],
    suggestions: ["Add implementation roadmap", "Include success metrics"],
    marketPotential: "High potential for adoption",
    technicalFeasibility: "Technically feasible with current technology",
  }),

  // Similar ideas
  similarIdeas: (count = 3) => {
    return Array.from({ length: count }, (_, i) => ({
      ideaTitle: `Similar Idea ${i + 1}`,
      similarity: 0.8 - i * 0.1,
      reason: `This idea shares similar concepts in approach ${i + 1}`,
    }));
  },

  // Submission evaluation
  submissionEvaluation: {
    score: 85,
    strengths: ["Well-implemented solution", "Good code quality"],
    weaknesses: ["Could improve documentation", "Limited error handling"],
    suggestions: ["Add more unit tests", "Improve error messages"],
    category_scores: {
      innovation: 90,
      technical: 85,
      presentation: 80,
      impact: 88,
    },
  },

  // Feedback generation
  feedback: "Great work on this submission! The implementation is solid and shows good understanding of the problem.",

  // Comparison
  comparison: {
    winner: "submission1",
    reasoning: "Submission 1 demonstrates better technical implementation and innovation.",
    scores: {
      submission1: 90,
      submission2: 75,
    },
  },
};

/**
 * Helper to create a mock that returns different responses for sequential calls
 */
export function createSequentialMock(responses) {
  let callCount = 0;
  return vi.fn(async () => {
    const response = responses[callCount % responses.length];
    callCount++;
    return createMockCompletion(response);
  });
}

/**
 * Helper to track OpenAI API calls
 */
export function createTrackingMock() {
  const calls = [];
  const mockFn = vi.fn(async (params) => {
    calls.push({
      params,
      timestamp: Date.now(),
    });
    return createMockCompletion({ result: "tracked" });
  });

  return {
    mock: mockFn,
    calls,
    getCallCount: () => calls.length,
    getLastCall: () => calls[calls.length - 1],
    reset: () => {
      calls.length = 0;
      mockFn.mockClear();
    },
  };
}

export default {
  createMockCompletion,
  createMockOpenAI,
  mockOpenAIModule,
  mockResponses,
  createSequentialMock,
  createTrackingMock,
};

