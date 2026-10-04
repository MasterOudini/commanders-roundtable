// `Skemfar Avenger` - a anotherCreatureDies trigger drawLose
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKEMFAR_AVENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKEMFAR_AVENGER, "Whenever another nontoken Elf or Berserker you control dies, you draw a card and you lose 1 life.");

export const SKEMFAR_AVENGER_SCRIPT: CardScript = {
  oracleId: SKEMFAR_AVENGER.oracleId,
  name: SKEMFAR_AVENGER.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.subtypes.includes('Elf') || ctx.derive(m.card).typeLine.subtypes.includes('Berserker')) && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Skemfar Avenger - drawLose",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
};
