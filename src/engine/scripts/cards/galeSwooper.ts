// `Gale Swooper` — flying (Tier 2) plus "When this creature enters, target
// creature gains flying until end of turn." Dinotomaton's targeted ETB
// grant with the flying rider. D215.

import { GALE_SWOOPER } from '../../../data/fixtures/engineCards';
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
  GALE_SWOOPER,
  'Flying\nWhen this creature enters, target creature gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const GALE_SWOOPER_SCRIPT: CardScript = {
  oracleId: GALE_SWOOPER.oracleId,
  name: GALE_SWOOPER.name,
  triggers: [
    {
      abilityId: 'etb-grant',
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
      label: () => 'Gale Swooper — grant flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['flying'],
          },
        ];
      },
    },
  ],
};
