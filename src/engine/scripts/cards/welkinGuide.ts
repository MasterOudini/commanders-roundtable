// `Welkin Guide` — flying plus an ETB that pumps AND grants flying in ONE
// `PtModifiedUntilEndOfTurn` (Arborea Pegasus and Battleflight Eagle are the
// shipped precedents). The keyword line never counts, so the def's text is
// `split[1]`. D268.

import { WELKIN_GUIDE } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(
  WELKIN_GUIDE,
  'Flying\nWhen this creature enters, target creature gets +2/+2 and gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const WELKIN_GUIDE_SCRIPT: CardScript = {
  oracleId: WELKIN_GUIDE.oracleId,
  name: WELKIN_GUIDE.name,
  triggers: [
    {
      abilityId: 'etb-pump-fly',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Welkin Guide — target creature gets +2/+2 and gains flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 2,
            toughness: 2,
            keywords: ['flying'],
          },
        ];
      },
    },
  ],
};
