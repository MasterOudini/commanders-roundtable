// `Dreadful Apathy` - a static attachedCombat, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREADFUL_APATHY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREADFUL_APATHY, "Enchant creature\nEnchanted creature can't attack or block.\n{2}{W}: Exile enchanted creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Exile enchanted creature.", DREADFUL_APATHY.name);
const VOCAB_T_A0 = vocabularyTargets("Exile enchanted creature.");

export const DREADFUL_APATHY_SCRIPT: CardScript = {
  oracleId: DREADFUL_APATHY.oracleId,
  name: DREADFUL_APATHY.name,
  activated: [
    {
      ref: `${DREADFUL_APATHY.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
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
