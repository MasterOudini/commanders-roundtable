// `Wanderwine Distracter` — the becomes-tapped watcher again, this time
// TARGETED and restricted to an opponent's creature. A negative pump on
// D194's carrier: power only, so a 1/1 goes to -3/1 and does not die.
// D267.

import { WANDERWINE_DISTRACTER } from '../../../data/fixtures/engineCards';
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
  WANDERWINE_DISTRACTER,
  'Whenever this creature becomes tapped, target creature an opponent controls gets -3/-0 until end of turn.',
);

export const WANDERWINE_DISTRACTER_SCRIPT: CardScript = {
  oracleId: WANDERWINE_DISTRACTER.oracleId,
  name: WANDERWINE_DISTRACTER.name,
  triggers: [
    {
      abilityId: 'tapped-shrink',
      text: TEXT,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => 'Wanderwine Distracter — target creature an opponent controls gets -3/-0',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: -3,
            toughness: 0,
            keywords: [],
          },
        ];
      },
    },
  ],
};
