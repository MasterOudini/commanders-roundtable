// `Owlin Historian` - a etb trigger scry, a cardLeavesYourGraveyard trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OWLIN_HISTORIAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OWLIN_HISTORIAN, "Flying\nWhen this creature enters, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)\nWhenever one or more cards leave your graveyard, this creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const OWLIN_HISTORIAN_SCRIPT: CardScript = {
  oracleId: OWLIN_HISTORIAN.oracleId,
  name: OWLIN_HISTORIAN.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Owlin Historian - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "Owlin Historian - surveil 1" } },
        ];
      },
    },
    {
      abilityId: 'cardLeavesYourGraveyard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.from.kind === 'graveyard' && m.from.player === ctx.query.controllerOf(self)),
      label: () => "Owlin Historian - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
