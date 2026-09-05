// `Metalspinner's Puzzleknot` - a etb trigger drawLose, an activation drawLose
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { METALSPINNER_S_PUZZLEKNOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(METALSPINNER_S_PUZZLEKNOT, "When this artifact enters, you draw a card and you lose 1 life.\n{2}{B}, Sacrifice this artifact: You draw a card and you lose 1 life.");
const LINES = PRINTED.split('\n');

export const METALSPINNERS_PUZZLEKNOT_SCRIPT: CardScript = {
  oracleId: METALSPINNER_S_PUZZLEKNOT.oracleId,
  name: METALSPINNER_S_PUZZLEKNOT.name,
  activated: [
    {
      ref: `${METALSPINNER_S_PUZZLEKNOT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
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
      label: () => "Metalspinner's Puzzleknot - drawLose",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
