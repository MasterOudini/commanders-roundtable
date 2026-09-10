// `Attuned Hunter` - a cardLeavesYourGraveyard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ATTUNED_HUNTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ATTUNED_HUNTER, "Trample\nWhenever one or more cards leave your graveyard during your turn, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const ATTUNED_HUNTER_SCRIPT: CardScript = {
  oracleId: ATTUNED_HUNTER.oracleId,
  name: ATTUNED_HUNTER.name,
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.from.kind === 'graveyard' && m.from.player === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Attuned Hunter - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
