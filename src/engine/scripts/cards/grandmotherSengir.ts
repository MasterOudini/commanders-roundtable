// `Grandmother Sengir` — "{1}{B}, {T}: Target creature gets -1/-1 until end
// of turn." The tap-and-mana UEOT debuff on a LEGEND. M6.4u, D177.

import { GRANDMOTHER_SENGIR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GRANDMOTHER_SENGIR, '{1}{B}, {T}: Target creature gets -1/-1 until end of turn.');

export const GRANDMOTHER_SENGIR_SCRIPT: CardScript = {
  oracleId: GRANDMOTHER_SENGIR.oracleId,
  name: GRANDMOTHER_SENGIR.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GRANDMOTHER_SENGIR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
  ],
};
