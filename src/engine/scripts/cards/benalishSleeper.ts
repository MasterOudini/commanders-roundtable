// `Benalish Sleeper` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BENALISH_SLEEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BENALISH_SLEEPER, "Kicker {B} (You may pay an additional {B} as you cast this spell.)\nWhen this creature enters, if it was kicked, each player sacrifices a creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each player sacrifices a creature of their choice.", BENALISH_SLEEPER.name);
const VOCAB_T_L1 = vocabularyTargets("Each player sacrifices a creature of their choice.");

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const BENALISH_SLEEPER_SCRIPT: CardScript = {
  oracleId: BENALISH_SLEEPER.oracleId,
  name: BENALISH_SLEEPER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Benalish Sleeper - Each player sacrifices a creature of their choice.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
