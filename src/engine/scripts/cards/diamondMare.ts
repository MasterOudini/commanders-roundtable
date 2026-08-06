// `Diamond Mare` — "As this creature enters, choose a color.\nWhenever you
// cast a spell of the chosen color, you gain 1 life." The FIRST trigger
// consumer of D147's `chosenColor` (D171): the entry prompt is the ENGINE's
// (line 0, the built-in recognition that completed Sol Grail), and the def
// owes only the watcher — whose filter reads the answer remembered on its
// own instance. Before the colour is chosen the filter matches nothing,
// which is the same "no answer, no offer" rule the mana scope follows.
// M6.4o, D171.

import { DIAMOND_MARE } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  DIAMOND_MARE,
  'As this creature enters, choose a color.\nWhenever you cast a spell of the chosen color, you gain 1 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DIAMOND_MARE_SCRIPT: CardScript = {
  oracleId: DIAMOND_MARE.oracleId,
  name: DIAMOND_MARE.name,
  triggers: [
    {
      abilityId: 'cast-chosen',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        const chosen = ctx.state.cards[self]?.chosenColor;
        if (!chosen) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).colors.includes(chosen);
      },
      label: () => 'Diamond Mare — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
