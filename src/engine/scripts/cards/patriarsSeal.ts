// `Patriar's Seal` - untap on "Untap target legendary creature you control": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { PATRIAR_S_SEAL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(PATRIAR_S_SEAL, "{T}: Add one mana of any color.\n{1}, {T}: Untap target legendary creature you control.");
const TEXT = PRINTED.split('\n')[1] as string;

export const PATRIARS_SEAL_SCRIPT: CardScript = {
  oracleId: PATRIAR_S_SEAL.oracleId,
  name: PATRIAR_S_SEAL.name,
  activated: [
    {
      ref: `${PATRIAR_S_SEAL.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (!card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
