// `Rix Maadi, Dungeon Palace` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIX_MAADI_DUNGEON_PALACE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIX_MAADI_DUNGEON_PALACE, "{T}: Add {C}.\n{1}{B}{R}, {T}: Each player discards a card. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Each player discards a card.", RIX_MAADI_DUNGEON_PALACE.name);
const VOCAB_T_A1 = vocabularyTargets("Each player discards a card.");

export const RIX_MAADI_DUNGEON_PALACE_SCRIPT: CardScript = {
  oracleId: RIX_MAADI_DUNGEON_PALACE.oracleId,
  name: RIX_MAADI_DUNGEON_PALACE.name,
  activated: [
    {
      ref: `${RIX_MAADI_DUNGEON_PALACE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
