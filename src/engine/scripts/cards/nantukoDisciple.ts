// `Nantuko Disciple` — "{G}, {T}: Target creature gets +2/+2 until end of
// turn." The activated pump. D227.

import { NANTUKO_DISCIPLE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(NANTUKO_DISCIPLE, '{G}, {T}: Target creature gets +2/+2 until end of turn.');

export const NANTUKO_DISCIPLE_SCRIPT: CardScript = {
  oracleId: NANTUKO_DISCIPLE.oracleId,
  name: NANTUKO_DISCIPLE.name,
  activated: [
    {
      ref: `${NANTUKO_DISCIPLE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 }];
      },
    },
  ],
};
