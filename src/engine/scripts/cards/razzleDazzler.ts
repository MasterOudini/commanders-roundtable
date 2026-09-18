// `Razzle-Dazzler` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAZZLE_DAZZLER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(RAZZLE_DAZZLER, "Whenever you cast your second spell each turn, put a +1/+1 counter on this creature. It can't be blocked this turn.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on this creature. It can't be blocked this turn.", RAZZLE_DAZZLER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on this creature. It can't be blocked this turn.");

export const RAZZLE_DAZZLER_SCRIPT: CardScript = {
  oracleId: RAZZLE_DAZZLER.oracleId,
  name: RAZZLE_DAZZLER.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Razzle-Dazzler - Put a +1/+1 counter on this creature. It can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
