// `Snapdax, Apex of the Hunt` - a mutates trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SNAPDAX_APEX_OF_THE_HUNT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SNAPDAX_APEX_OF_THE_HUNT, "Mutate {2}{B/R}{W}{W} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nDouble strike\nWhenever this creature mutates, it deals 4 damage to target creature or planeswalker an opponent controls and you gain 4 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("~ deals 4 damage to target creature or planeswalker an opponent controls and you gain 4 life.", SNAPDAX_APEX_OF_THE_HUNT.name);
const VOCAB_T_L2 = vocabularyTargets("~ deals 4 damage to target creature or planeswalker an opponent controls and you gain 4 life.");

export const SNAPDAX_APEX_OF_THE_HUNT_SCRIPT: CardScript = {
  oracleId: SNAPDAX_APEX_OF_THE_HUNT.oracleId,
  name: SNAPDAX_APEX_OF_THE_HUNT.name,
  triggers: [
    {
      abilityId: 'mutates-2',
      text: LINES[2] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Snapdax, Apex of the Hunt - ~ deals 4 damage to target creature or planeswalker an opponent controls and you gain 4 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
