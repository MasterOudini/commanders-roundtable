// `Haunt of the Dead Marshes` - a etb trigger scry, an activation returnSelfFromGraveyard
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAUNT_OF_THE_DEAD_MARSHES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAUNT_OF_THE_DEAD_MARSHES, "When this creature enters, scry 1.\n{2}{B}: Return this card from your graveyard to the battlefield tapped. Activate only if you control a legendary creature.");
const LINES = PRINTED.split('\n');

export const HAUNT_OF_THE_DEAD_MARSHES_SCRIPT: CardScript = {
  oracleId: HAUNT_OF_THE_DEAD_MARSHES.oracleId,
  name: HAUNT_OF_THE_DEAD_MARSHES.name,
  activated: [
    {
      ref: `${HAUNT_OF_THE_DEAD_MARSHES.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'battlefield', player: obj.controller } }] }, { t: 'PermanentsTapped', cards: [self] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Haunt of the Dead Marshes - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Haunt of the Dead Marshes - scry 1" } },
        ];
      },
    },
  ],
};
