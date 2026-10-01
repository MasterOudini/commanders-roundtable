// `Hypervolt Grasp` - a static attachedStatic, an activation vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HYPERVOLT_GRASP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HYPERVOLT_GRASP, "Enchant creature\nEnchanted creature has \"{T}: This creature deals 1 damage to any target.\"\n{1}{U}: Return this Aura to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return this Aura to its owner's hand.", HYPERVOLT_GRASP.name);
const VOCAB_T_A0 = vocabularyTargets("Return this Aura to its owner's hand.");
const VOCAB_G1 = vocabularyEffects("~ deals 1 damage to any target.", HYPERVOLT_GRASP.name);
const VOCAB_T_G1 = vocabularyTargets("~ deals 1 damage to any target.");

const GRANT_1 = grantedActivated("{T}: This creature deals 1 damage to any target.", `${HYPERVOLT_GRASP.oracleId}#g1`, HYPERVOLT_GRASP.name);

export const HYPERVOLT_GRASP_SCRIPT: CardScript = {
  oracleId: HYPERVOLT_GRASP.oracleId,
  name: HYPERVOLT_GRASP.name,
  activated: [
    {
      ref: `${HYPERVOLT_GRASP.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
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
