import { MODEL_PRICING } from "../logUsage.ts";

const DEEPSEEK_FLASH_INPUT = 0.10;
const DEEPSEEK_FLASH_OUTPUT = 0.40;

interface BudgetOpts {
  maxAiCalls: number;
  maxFetches: number;
  maxUsd: number;
  wallClockMs: number;
}

const DEFAULTS: BudgetOpts = {
  maxAiCalls: 40,
  maxFetches: 30,
  maxUsd: 0.50,
  wallClockMs: 180_000,
};

export type UsageSink = (u: { model: string; inputTokens: number; outputTokens: number; costUsd: number }) => void | Promise<void>;

export function providerFor(model: string): string {
  if (model.startsWith("gpt-")) return "openai";
  if (model.startsWith("deepseek-")) return "deepseek";
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "google";
  return "unknown";
}

export class CostBudget {
  private opts: BudgetOpts;
  private startTime: number;
  private _aiCallsMade = 0;
  private _fetchesMade = 0;
  private _spent = 0;
  private _inputTokens = 0;
  private _outputTokens = 0;
  private _stopReason: string | null = null;
  private _sink: UsageSink | null = null;

  constructor(opts?: Partial<BudgetOpts>) {
    this.opts = { ...DEFAULTS, ...opts };
    this.startTime = Date.now();
  }

  get aiCallsMade(): number { return this._aiCallsMade; }
  get fetchesMade(): number { return this._fetchesMade; }
  get spent(): number { return this._spent; }
  get inputTokens(): number { return this._inputTokens; }
  get outputTokens(): number { return this._outputTokens; }
  get stopReason(): string | null { return this._stopReason; }

  attachUsageSink(sink: UsageSink): void {
    this._sink = sink;
  }

  isExhausted(): boolean {
    if (this._stopReason) return true;
    if (this._aiCallsMade >= this.opts.maxAiCalls) { this._stopReason = "budget_calls"; return true; }
    if (this._fetchesMade >= this.opts.maxFetches) { this._stopReason = "budget_fetches"; return true; }
    if (this._spent >= this.opts.maxUsd) { this._stopReason = "budget_cost"; return true; }
    if (Date.now() - this.startTime >= this.opts.wallClockMs) { this._stopReason = "budget_time"; return true; }
    return false;
  }

  canAffordAiCall(): boolean {
    return !this.isExhausted() && this._aiCallsMade < this.opts.maxAiCalls;
  }

  canAffordFetch(): boolean {
    return !this.isExhausted() && this._fetchesMade < this.opts.maxFetches;
  }

  recordAiCall(inputTokens: number, outputTokens: number, model = "deepseek-v4-flash"): void {
    this._aiCallsMade++;
    const pricing = MODEL_PRICING[model] ?? { input: DEEPSEEK_FLASH_INPUT, output: DEEPSEEK_FLASH_OUTPUT };
    const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
    this._spent += cost;
    this._inputTokens += inputTokens;
    this._outputTokens += outputTokens;

    if (this._sink) {
      try {
        void Promise.resolve(this._sink({ model, inputTokens, outputTokens, costUsd: cost })).catch(() => {});
      } catch {
        // sink must never fail the crawl
      }
    }
  }

  recordFetch(): void {
    this._fetchesMade++;
  }

  setStopReason(reason: string): void {
    if (!this._stopReason) this._stopReason = reason;
  }

  toJSON(): { fetches: number; aiCalls: number; usd: number; wallMs: number; inputTokens: number; outputTokens: number } {
    return {
      fetches: this._fetchesMade,
      aiCalls: this._aiCallsMade,
      usd: this._spent,
      wallMs: Date.now() - this.startTime,
      inputTokens: this._inputTokens,
      outputTokens: this._outputTokens,
    };
  }

  static fromResumable(
    totals: BudgetOpts,
    used: { fetches: number; aiCalls: number; usd: number },
  ): CostBudget {
    const remaining: BudgetOpts = {
      maxFetches: Math.min(CLASS_INVOCATION_CAPS.maxFetches, totals.maxFetches - used.fetches),
      maxAiCalls: Math.min(CLASS_INVOCATION_CAPS.maxAiCalls, totals.maxAiCalls - used.aiCalls),
      maxUsd: totals.maxUsd - used.usd,
      wallClockMs: CLASS_INVOCATION_CAPS.wallClockMs,
    };
    return new CostBudget(remaining);
  }
}

export const CLASS_CRAWL_TOTALS: BudgetOpts = {
  maxFetches: 90,
  maxAiCalls: 60,
  maxUsd: 0.60,
  wallClockMs: 480_000,
};

export const CLASS_INVOCATION_CAPS: BudgetOpts = {
  maxFetches: 22,
  maxAiCalls: 18,
  maxUsd: 0.20,
  wallClockMs: 150_000,
};
