// `Sparring Collar` - a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPARRING_COLLAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPARRING_COLLAR, "Equipped creature has first strike.\n{R}{R}: Attach this Equipment to target creature you control.\nEquip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Attach this Equipment to target creature you control.", SPARRING_COLLAR.name);
const VOCAB_T_A0 = vocabularyTargets("Attach this Equipment to target creature you control.");

export const SPARRING_COLLAR_SCRIPT: CardScript = {
  oracleId: SPARRING_COLLAR.oracleId,
  name: SPARRING_COLLAR.name,
  activated: [
    {
      ref: `${SPARRING_COLLAR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
