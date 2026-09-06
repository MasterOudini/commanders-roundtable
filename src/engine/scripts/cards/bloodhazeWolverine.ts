// `Bloodhaze Wolverine` - a secondCard trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOODHAZE_WOLVERINE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOODHAZE_WOLVERINE, "Whenever you draw your second card each turn, this creature gets +1/+1 and gains first strike until end of turn.");

export const BLOODHAZE_WOLVERINE_SCRIPT: CardScript = {
  oracleId: BLOODHAZE_WOLVERINE.oracleId,
  name: BLOODHAZE_WOLVERINE.name,
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Bloodhaze Wolverine - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1, keywords: ["firstStrike"] }];
      },
    },
  ],
};
