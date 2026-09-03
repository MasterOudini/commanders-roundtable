// `Crookclaw Elder` — Flying is the engine's; tapping two untapped Birds I
// control buys a card, tapping two untapped Wizards gives a creature flying
// until cleanup (the D286 tap chooser twice; the Elder is both).

import { CROOKCLAW_ELDER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  CROOKCLAW_ELDER,
  'Flying\nTap two untapped Birds you control: Draw a card.\nTap two untapped Wizards you control: Target creature gains flying until end of turn.',
);
const DRAW = PRINTED.split('\n')[1] as string;
const FLYING = PRINTED.split('\n')[2] as string;

export const CROOKCLAW_ELDER_SCRIPT: CardScript = {
  oracleId: CROOKCLAW_ELDER.oracleId,
  name: CROOKCLAW_ELDER.name,
  activated: [
    {
      ref: `${CROOKCLAW_ELDER.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
    {
      ref: `${CROOKCLAW_ELDER.oracleId}#a1`,
      text: FLYING,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['flying'] }];
      },
    },
  ],
};
