// `Greenwheel Liberator` - a static entersWithCounters
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GREENWHEEL_LIBERATOR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(GREENWHEEL_LIBERATOR, "Revolt — This creature enters with two +1/+1 counters on it if a permanent left the battlefield under your control this turn.");

// "as long as a permanent left the battlefield under your control this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const e of ctx.state.turn.memory.left) {
    if (e.controller !== me) continue;
    return true;
  }
  return false;
}


export const GREENWHEEL_LIBERATOR_SCRIPT: CardScript = {
  oracleId: GREENWHEEL_LIBERATOR.oracleId,
  name: GREENWHEEL_LIBERATOR.name,
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (ctx, self, ev) =>
        ifCond0Of(ctx, self) && ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: 2 }] }],
    },
  ],
};
