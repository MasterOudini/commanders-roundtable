// `Hotfoot Gnome` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOTFOOT_GNOME } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOTFOOT_GNOME, "Haste\n{T}: Another target creature gains haste until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Another target creature gains haste until end of turn.", HOTFOOT_GNOME.name);
const VOCAB_T_A0 = vocabularyTargets("Another target creature gains haste until end of turn.");

export const HOTFOOT_GNOME_SCRIPT: CardScript = {
  oracleId: HOTFOOT_GNOME.oracleId,
  name: HOTFOOT_GNOME.name,
  activated: [
    {
      ref: `${HOTFOOT_GNOME.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
