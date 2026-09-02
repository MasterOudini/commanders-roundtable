// `Implement of Improvement` — "{W}, Sacrifice this artifact: You gain 2
// life.\nWhen this artifact is put into a graveyard from the battlefield,
// draw a card." Implement of Examination's shape with a life gain in the
// activation: one activation is 2 life AND a card, the dies watcher firing
// on the sacrifice. D276.

import { IMPLEMENT_OF_IMPROVEMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  IMPLEMENT_OF_IMPROVEMENT,
  '{W}, Sacrifice this artifact: You gain 2 life.\nWhen this artifact is put into a graveyard from the battlefield, draw a card.',
);
const SACRIFICE = PRINTED.split('\n')[0] as string;
const DIES = PRINTED.split('\n')[1] as string;

export const IMPLEMENT_OF_IMPROVEMENT_SCRIPT: CardScript = {
  oracleId: IMPLEMENT_OF_IMPROVEMENT.oracleId,
  name: IMPLEMENT_OF_IMPROVEMENT.name,
  activated: [
    {
      ref: `${IMPLEMENT_OF_IMPROVEMENT.oracleId}#a0`,
      text: SACRIFICE,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'dies',
      text: DIES,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Implement of Improvement — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
