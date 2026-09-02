// `Implement of Examination` — "{U}, Sacrifice this artifact: Draw a
// card.\nWhen this artifact is put into a graveyard from the battlefield,
// draw a card." The Cluestone sacrifice-draw (D163) and a looks-back dies
// watcher on the artifact itself — which the sacrifice cost fires too, so
// one activation is TWO cards, exactly as the card plays. D276.

import { IMPLEMENT_OF_EXAMINATION } from '../../../data/fixtures/engineCards';
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
  IMPLEMENT_OF_EXAMINATION,
  '{U}, Sacrifice this artifact: Draw a card.\nWhen this artifact is put into a graveyard from the battlefield, draw a card.',
);
const SACRIFICE = PRINTED.split('\n')[0] as string;
const DIES = PRINTED.split('\n')[1] as string;

export const IMPLEMENT_OF_EXAMINATION_SCRIPT: CardScript = {
  oracleId: IMPLEMENT_OF_EXAMINATION.oracleId,
  name: IMPLEMENT_OF_EXAMINATION.name,
  activated: [
    {
      ref: `${IMPLEMENT_OF_EXAMINATION.oracleId}#a0`,
      text: SACRIFICE,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
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
      label: () => 'Implement of Examination — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
