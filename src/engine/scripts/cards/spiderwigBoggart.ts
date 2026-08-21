// `Spiderwig Boggart` — "When this creature enters, target creature gains
// fear until end of turn." Kami of the Waning Moon's grant on a Goblin —
// the fear rides the carrier, reminder included in the claim. D250.

import { SPIDERWIG_BOGGART } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  SPIDERWIG_BOGGART,
  'When this creature enters, target creature gains fear until end of turn. ' +
    "(It can't be blocked except by artifact creatures and/or black creatures.)",
);

export const SPIDERWIG_BOGGART_SCRIPT: CardScript = {
  oracleId: SPIDERWIG_BOGGART.oracleId,
  name: SPIDERWIG_BOGGART.name,
  triggers: [
    {
      abilityId: 'etb-fear',
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
      label: () => 'Spiderwig Boggart — target creature gains fear',
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
            keywords: ['fear'],
          },
        ];
      },
    },
  ],
};
