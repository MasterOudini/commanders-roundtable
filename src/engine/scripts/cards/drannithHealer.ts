// `Drannith Healer` - a youCycle trigger gainLife
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRANNITH_HEALER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRANNITH_HEALER, "Whenever you cycle another card, you gain 1 life.\nCycling {1} ({1}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

export const DRANNITH_HEALER_SCRIPT: CardScript = {
  oracleId: DRANNITH_HEALER.oracleId,
  name: DRANNITH_HEALER.name,
  triggers: [
    {
      abilityId: 'youCycle-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand' && m.card !== self && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Drannith Healer - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
