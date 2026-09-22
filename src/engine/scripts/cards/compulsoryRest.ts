// `Compulsory Rest` - a static attachedCombat, a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COMPULSORY_REST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COMPULSORY_REST, "Enchant creature\nEnchanted creature can't attack or block.\nEnchanted creature has \"{2}, Sacrifice this creature: You gain 2 life.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G2 = vocabularyEffects("You gain 2 life.", COMPULSORY_REST.name);
const VOCAB_T_G2 = vocabularyTargets("You gain 2 life.");

const GRANT_2 = grantedActivated("{2}, Sacrifice this creature: You gain 2 life.", `${COMPULSORY_REST.oracleId}#g2`, COMPULSORY_REST.name);

export const COMPULSORY_REST_SCRIPT: CardScript = {
  oracleId: COMPULSORY_REST.oracleId,
  name: COMPULSORY_REST.name,
  activated: [
    {
      ref: GRANT_2.ref,
      text: LINES[2] as string,
      granted: GRANT_2.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G2, VOCAB_T_G2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_2.ref, ability: GRANT_2.ability });
      },
    },
  ],
  combat: [
    {
      abilityId: 'attached-combat-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttack: (ctx, self, candidate) => ctx.state.cards[self]?.attachedTo !== candidate,
      canBlock: (ctx, self, blocker) => ctx.state.cards[self]?.attachedTo !== blocker,
    },
  ],
};
