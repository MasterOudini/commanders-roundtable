// `Keldon Overseer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KELDON_OVERSEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KELDON_OVERSEER, "Kicker {3}{R} (You may pay an additional {3}{R} as you cast this spell.)\nHaste\nWhen this creature enters, if it was kicked, gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.", KELDON_OVERSEER.name);
const VOCAB_T_L2 = vocabularyTargets("Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.");

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const KELDON_OVERSEER_SCRIPT: CardScript = {
  oracleId: KELDON_OVERSEER.oracleId,
  name: KELDON_OVERSEER.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Keldon Overseer - Gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
