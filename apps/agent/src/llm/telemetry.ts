import {
  SpanStatusCode,
  trace,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { estimateCostUsd, type TokenUsage } from "./pricing.js";

export type LlmOperation = "generate" | "judge";

export type LlmCallTelemetry = {
  operation: LlmOperation;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: TokenUsage;
  costUsd?: number;
  success: boolean;
  error?: string;
};

const TRACER_NAME = "maple.llm";
let initialized = false;

/** OTEL span exporter that writes to stderr (keeps stdout free for CLI JSON). */
class StderrSpanExporter implements SpanExporter {
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    for (const span of spans) {
      console.error(
        "[otel.span]",
        JSON.stringify({
          name: span.name,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          durationMs: span.duration[0] * 1000 + span.duration[1] / 1e6,
          attributes: span.attributes,
          status: span.status,
          events: span.events.map((e) => ({
            name: e.name,
            attributes: e.attributes,
          })),
        }),
      );
    }
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/** Register a basic tracer provider once per process. */
export function initLlmTelemetry(serviceName = "maple-agent"): void {
  if (initialized) return;
  initialized = true;

  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    spanProcessors: [new SimpleSpanProcessor(new StderrSpanExporter())],
  });
  trace.setGlobalTracerProvider(provider);
}

function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME, "1.0.0");
}

/**
 * Time an LLM call, emit an OTEL span (GenAI-ish attributes), and console.log
 * a structured event with cost + latency.
 */
export async function withLlmTelemetry<T>(
  options: {
    operation: LlmOperation;
    provider: string;
    model: string;
    takeUsage?: () => TokenUsage | undefined;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  const started = performance.now();

  return tracer.startActiveSpan(
    `llm.${options.operation}`,
    {
      attributes: {
        "gen_ai.operation.name": options.operation,
        "gen_ai.system": options.provider,
        "gen_ai.request.model": options.model,
        "maple.llm.provider": options.provider,
      },
    },
    async (span: Span) => {
      let success = true;
      let errorMessage: string | undefined;
      try {
        return await fn();
      } catch (error) {
        success = false;
        errorMessage =
          error instanceof Error ? error.message : String(error);
        span.recordException(
          error instanceof Error ? error : new Error(errorMessage),
        );
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
        throw error;
      } finally {
        const latencyMs = Math.round(performance.now() - started);
        const usage = options.takeUsage?.();
        const costUsd =
          options.provider === "stub"
            ? 0
            : estimateCostUsd(options.model, usage);

        if (usage) {
          span.setAttribute("gen_ai.usage.input_tokens", usage.inputTokens);
          span.setAttribute("gen_ai.usage.output_tokens", usage.outputTokens);
          span.setAttribute("gen_ai.usage.total_tokens", usage.totalTokens);
        }
        if (costUsd !== undefined) {
          span.setAttribute("maple.llm.cost_usd", costUsd);
        }
        span.setAttribute("maple.llm.latency_ms", latencyMs);
        span.setAttribute("maple.llm.success", success);

        span.addEvent("maple.llm.call", {
          "maple.llm.latency_ms": latencyMs,
          ...(costUsd !== undefined ? { "maple.llm.cost_usd": costUsd } : {}),
          ...(usage
            ? {
                "gen_ai.usage.input_tokens": usage.inputTokens,
                "gen_ai.usage.output_tokens": usage.outputTokens,
              }
            : {}),
        });

        const event: LlmCallTelemetry = {
          operation: options.operation,
          provider: options.provider,
          model: options.model,
          latencyMs,
          usage,
          costUsd,
          success,
          error: errorMessage,
        };
        console.log("[maple.llm]", JSON.stringify(event));
        span.end();
      }
    },
  );
}
