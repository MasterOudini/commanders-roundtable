// `Earth Kingdom Protectors` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EARTH_KINGDOM_PROTECTORS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EARTH_KINGDOM_PROTECTORS, "Vigilance\nSacrifice this creature: Another target Ally you control gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Another target Ally you control gains indestructible until end of turn.", EARTH_KINGDOM_PROTECTORS.name);
const VOCAB_T_A0 = vocabularyTargets("Another target Ally you control gains indestructible until end of turn.");

export const EARTH_KINGDOM_PROTECTORS_SCRIPT: CardScript = {
  oracleId: EARTH_KINGDOM_PROTECTORS.oracleId,
  name: EARTH_KINGDOM_PROTECTORS.name,
  activated: [
    {
      ref: `${EARTH_KINGDOM_PROTECTORS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
