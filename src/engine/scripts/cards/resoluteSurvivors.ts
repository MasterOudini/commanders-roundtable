// `Resolute Survivors` - a youExertCreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RESOLUTE_SURVIVORS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RESOLUTE_SURVIVORS, "You may exert this creature as it attacks. (It won't untap during your next untap step.)\nWhenever you exert a creature, this creature deals 1 damage to each opponent and you gain 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 1 damage to each opponent and you gain 1 life.", RESOLUTE_SURVIVORS.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 1 damage to each opponent and you gain 1 life.");

export const RESOLUTE_SURVIVORS_SCRIPT: CardScript = {
  oracleId: RESOLUTE_SURVIVORS.oracleId,
  name: RESOLUTE_SURVIVORS.name,
  triggers: [
    {
      abilityId: 'youExertCreature-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'Exerted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Resolute Survivors - ~ deals 1 damage to each opponent and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
