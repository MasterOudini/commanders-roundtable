// `Dross Harvester` - two triggers: at the beginning of ITS CONTROLLER'S end step,
// lose 4 life; whenever a creature dies, gain 2 life - once PER creature (per-item,
// D185; a look-back trigger). Protection from white is the engine's (Tier-2).
// Whole after D295's "you lose N life" sentence reading.

import { DROSS_HARVESTER } from '../../../data/fixtures/engineCards';
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
  DROSS_HARVESTER,
  'Protection from white\nAt the beginning of your end step, you lose 4 life.\nWhenever a creature dies, you gain 2 life.',
);
const END_TEXT = PRINTED.split('\n')[1] as string;
const DIES_TEXT = PRINTED.split('\n')[2] as string;

export const DROSS_HARVESTER_SCRIPT: CardScript = {
  oracleId: DROSS_HARVESTER.oracleId,
  name: DROSS_HARVESTER.name,
  triggers: [
    {
      abilityId: 'end-step',
      text: END_TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: [],
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Dross Harvester - lose 4 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: -4, to: me.life - 4 }];
      },
    },
    {
      abilityId: 'creature-dies',
      text: DIES_TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: [],
      matches: (_ctx, _self, ev) => ev.t === 'CardsMoved',
      perItem: (ctx, _self, ev) =>
        ev.t !== 'CardsMoved'
          ? []
          : ev.moves.filter((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card),
      label: () => 'Dross Harvester - gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 }];
      },
    },
  ],
};
