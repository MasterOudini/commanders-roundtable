// `Battlefield Scavenger` - a youExertCreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BATTLEFIELD_SCAVENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BATTLEFIELD_SCAVENGER, "You may exert this creature as it attacks. (It won't untap during your next untap step.)\nWhenever you exert a creature, you may discard a card. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may discard a card. If you do, draw a card.", BATTLEFIELD_SCAVENGER.name);
const VOCAB_T_L1 = vocabularyTargets("You may discard a card. If you do, draw a card.");

export const BATTLEFIELD_SCAVENGER_SCRIPT: CardScript = {
  oracleId: BATTLEFIELD_SCAVENGER.oracleId,
  name: BATTLEFIELD_SCAVENGER.name,
  triggers: [
    {
      abilityId: 'youExertCreature-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'Exerted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Battlefield Scavenger - You may discard a card. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
