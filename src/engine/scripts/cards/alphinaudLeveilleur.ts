// `Alphinaud Leveilleur` - a secondSpell trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ALPHINAUD_LEVEILLEUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ALPHINAUD_LEVEILLEUR, "Partner with Alisaie Leveilleur (When this creature enters, target player may put Alisaie Leveilleur into their hand from their library, then shuffle.)\nVigilance\nEukrasia — Whenever you cast your second spell each turn, draw a card.");
const LINES = PRINTED.split('\n');

export const ALPHINAUD_LEVEILLEUR_SCRIPT: CardScript = {
  oracleId: ALPHINAUD_LEVEILLEUR.oracleId,
  name: ALPHINAUD_LEVEILLEUR.name,
  triggers: [
    {
      abilityId: 'secondSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Alphinaud Leveilleur - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
