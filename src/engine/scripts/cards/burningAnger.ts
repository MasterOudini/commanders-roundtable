// `Burning Anger` - a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURNING_ANGER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
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

const PRINTED = printed(BURNING_ANGER, "Enchant creature\nEnchanted creature has \"{T}: This creature deals damage equal to its power to any target.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G1 = vocabularyEffects("~ deals damage equal to its power to any target.", BURNING_ANGER.name);
const VOCAB_T_G1 = vocabularyTargets("~ deals damage equal to its power to any target.");

const GRANT_1 = grantedActivated("{T}: This creature deals damage equal to its power to any target.", `${BURNING_ANGER.oracleId}#g1`, BURNING_ANGER.name);

export const BURNING_ANGER_SCRIPT: CardScript = {
  oracleId: BURNING_ANGER.oracleId,
  name: BURNING_ANGER.name,
  activated: [
    {
      ref: GRANT_1.ref,
      text: LINES[1] as string,
      granted: GRANT_1.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G1, VOCAB_T_G1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_1.ref, ability: GRANT_1.ability });
      },
    },
  ],
};
