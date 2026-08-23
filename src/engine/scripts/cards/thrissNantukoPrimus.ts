// `Thriss, Nantuko Primus` — the {G}, {T} activated pump at +5/+5, the
// largest single grant the arc has shipped. D260.

import { THRISS_NANTUKO_PRIMUS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  THRISS_NANTUKO_PRIMUS,
  '{G}, {T}: Target creature gets +5/+5 until end of turn.',
);

export const THRISS_NANTUKO_PRIMUS_SCRIPT: CardScript = {
  oracleId: THRISS_NANTUKO_PRIMUS.oracleId,
  name: THRISS_NANTUKO_PRIMUS.name,
  activated: [
    {
      ref: `${THRISS_NANTUKO_PRIMUS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 5, toughness: 5 }];
      },
    },
  ],
};
