// `Liberated Dwarf` - pump on "Target green creature gets +1/+0 and gains first strike until end of turn": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { LIBERATED_DWARF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIBERATED_DWARF, "{R}, Sacrifice this creature: Target green creature gets +1/+0 and gains first strike until end of turn.");
const TEXT = PRINTED;

export const LIBERATED_DWARF_SCRIPT: CardScript = {
  oracleId: LIBERATED_DWARF.oracleId,
  name: LIBERATED_DWARF.name,
  activated: [
    {
      ref: `${LIBERATED_DWARF.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
