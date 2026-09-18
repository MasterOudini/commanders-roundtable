// `Fearless Fledgling` - a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FEARLESS_FLEDGLING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FEARLESS_FLEDGLING, "Landfall — Whenever a land you control enters, put a +1/+1 counter on this creature. It gains flying until end of turn.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on this creature. It gains flying until end of turn.", FEARLESS_FLEDGLING.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on this creature. It gains flying until end of turn.");

export const FEARLESS_FLEDGLING_SCRIPT: CardScript = {
  oracleId: FEARLESS_FLEDGLING.oracleId,
  name: FEARLESS_FLEDGLING.name,
  triggers: [
    {
      abilityId: 'landfall-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Fearless Fledgling - Put a +1/+1 counter on this creature. It gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
