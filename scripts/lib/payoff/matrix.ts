/**
 * matrix.ts — build an action × context payoff matrix from an incentive-state (cycle-006, FR/Sprint 1).
 *
 * Reuses the cycle-005 restricted interpreter (`../parametric/expr.ts`) for the `reward`/`cost`
 * formulas — never `eval`. The agent is modeled as choosing the action that maximizes
 * `net = reward − cost` at each context. Metric-agnostic: no action/reward name is hard-coded.
 */
import { compile } from "../parametric/expr.ts";

export interface ActionPayoff {
  id: string;
  tunability?: "engine-default" | "structural";
  reward: string; // expr formula over the context variable
  cost: string; // expr formula over the context variable
}

export interface IncentiveState {
  context: string; // the matrix column axis (an environment-state variable)
  domain: { min: number; max: number };
  actions: ActionPayoff[];
  intendedAction?: string; // from reward.intent.intended_action (declared intent)
  nonNegotiable?: boolean;
  rewardId?: string;
}

export interface PayoffMatrix {
  context: string;
  domain: { min: number; max: number };
  contexts: number[]; // integer steps
  actions: string[]; // action ids, in declared order
  /** net[actionId] = net payoff per context step (aligned with `contexts`). */
  net: Map<string, number[]>;
  tunability: Map<string, ActionPayoff["tunability"]>;
}

export class IncentiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncentiveError";
  }
}

function steps(domain: { min: number; max: number }): number[] {
  if (!Number.isFinite(domain.min) || !Number.isFinite(domain.max)) {
    throw new IncentiveError(`context domain must be finite (got ${domain.min}..${domain.max})`);
  }
  if (domain.max <= domain.min) {
    throw new IncentiveError(`context domain max (${domain.max}) must exceed min (${domain.min})`);
  }
  const xs: number[] = [];
  for (let x = Math.ceil(domain.min); x <= Math.floor(domain.max); x++) xs.push(x);
  if (xs.length === 0) throw new IncentiveError("context domain has no integer steps");
  return xs;
}

export function buildMatrix(state: IncentiveState): PayoffMatrix {
  if (state.actions.length === 0) throw new IncentiveError("incentive-state has no actions");
  const contexts = steps(state.domain);
  const net = new Map<string, number[]>();
  const tunability = new Map<string, ActionPayoff["tunability"]>();

  for (const a of state.actions) {
    const rewardFn = compile(a.reward, [state.context]);
    const costFn = compile(a.cost, [state.context]);
    const series = contexts.map((x) => {
      const env = { [state.context]: x };
      return rewardFn(env) - costFn(env);
    });
    net.set(a.id, series);
    tunability.set(a.id, a.tunability);
  }

  return {
    context: state.context,
    domain: state.domain,
    contexts,
    actions: state.actions.map((a) => a.id),
    net,
    tunability,
  };
}
