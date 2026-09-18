// `Bloodsky Berserker` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODSKY_BERSERKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODSKY_BERSERKER, "Whenever you cast your second spell each turn, put two +1/+1 counters on this creature. It gains menace until end of turn. (It can't be blocked except by two or more creatures.)");

const VOCAB_L0 = vocabularyEffects("Put two +1/+1 counters on this creature. It gains menace until end of turn.", BLOODSKY_BERSERKER.name);
const VOCAB_T_L0 = vocabularyTargets("Put two +1/+1 counters on this creature. It gains menace until end of turn.");

export const BLOODSKY_BERSERKER_SCRIPT: CardScript = {
  oracleId: BLOODSKY_BERSERKER.oracleId,
  name: BLOODSKY_BERSERKER.name,
  triggers: [
    {
      abilityId: 'secondSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Bloodsky Berserker - Put two +1/+1 counters on this creature. It gains menace until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
