// `Deadeye Harpooner` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEADEYE_HARPOONER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(DEADEYE_HARPOONER, "Revolt — When this creature enters, if a permanent left the battlefield under your control this turn, destroy target tapped creature an opponent controls.");

const VOCAB_L0 = vocabularyEffects("Destroy target tapped creature an opponent controls.", DEADEYE_HARPOONER.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target tapped creature an opponent controls.");

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


export const DEADEYE_HARPOONER_SCRIPT: CardScript = {
  oracleId: DEADEYE_HARPOONER.oracleId,
  name: DEADEYE_HARPOONER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Deadeye Harpooner - Destroy target tapped creature an opponent controls.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
