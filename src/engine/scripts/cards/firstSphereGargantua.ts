// `First-Sphere Gargantua` - a etb trigger drawLose
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRST_SPHERE_GARGANTUA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRST_SPHERE_GARGANTUA, "When this creature enters, you draw a card and you lose 1 life.\nUnearth {2}{B} ({2}{B}: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step or if it would leave the battlefield. Unearth only as a sorcery.)");
const LINES = PRINTED.split('\n');

export const FIRST_SPHERE_GARGANTUA_SCRIPT: CardScript = {
  oracleId: FIRST_SPHERE_GARGANTUA.oracleId,
  name: FIRST_SPHERE_GARGANTUA.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "First-Sphere Gargantua - drawLose",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
