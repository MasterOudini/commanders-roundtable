// `Auriok Transfixer` — "{W}, {T}: Tap target artifact." The whole card is
// one targeted ActivatedDef (Deserted Temple's shape, pointed the other way):
// the engine parses, offers and charges the cost; the def owes the tap, with
// the mirror of the untap's guard — a target already turned gets no event.
// M6.4e, D162.

import { AURIOK_TRANSFIXER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AURIOK_TRANSFIXER, '{W}, {T}: Tap target artifact.');

export const AURIOK_TRANSFIXER_SCRIPT: CardScript = {
  oracleId: AURIOK_TRANSFIXER.oracleId,
  name: AURIOK_TRANSFIXER.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${AURIOK_TRANSFIXER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
