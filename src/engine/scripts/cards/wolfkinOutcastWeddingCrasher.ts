// `Wolfkin Outcast // Wedding Crasher` - a dies trigger draw, a anotherCreatureDies trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WOLFKIN_OUTCAST_WEDDING_CRASHER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(WOLFKIN_OUTCAST_WEDDING_CRASHER, "This spell costs {2} less to cast if you control a Wolf or Werewolf.\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\nWhenever this creature or another Wolf or Werewolf you control dies, draw a card.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

export const WOLFKIN_OUTCAST_WEDDING_CRASHER_SCRIPT: CardScript = {
  oracleId: WOLFKIN_OUTCAST_WEDDING_CRASHER.oracleId,
  name: WOLFKIN_OUTCAST_WEDDING_CRASHER.name,
  triggers: [
    {
      abilityId: 'dies-2', face: 1,
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Wolfkin Outcast // Wedding Crasher - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
    {
      abilityId: 'anotherCreatureDies-2', face: 1,
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.subtypes.includes('Wolf') || ctx.derive(m.card).typeLine.subtypes.includes('Werewolf')),
        ),
      label: () => "Wolfkin Outcast // Wedding Crasher - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
