// `Dinotomaton` — menace (Tier 2, keywords) plus "When this creature
// enters, target creature you control gains menace until end of turn."
// Angelheart Protector's targeted ETB grant carrying a MENACE rider. D208.

import { DINOTOMATON } from '../../../data/fixtures/engineCards';
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
  DINOTOMATON,
  "Menace (This creature can't be blocked except by two or more creatures.)\nWhen this creature enters, target creature you control gains menace until end of turn.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DINOTOMATON_SCRIPT: CardScript = {
  oracleId: DINOTOMATON.oracleId,
  name: DINOTOMATON.name,
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
      label: () => 'Dinotomaton — grant menace',
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
            keywords: ['menace'],
          },
        ];
      },
    },
  ],
};
