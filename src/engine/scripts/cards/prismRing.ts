// `Prism Ring` — Diamond Mare's two lines with "artifact" for
// "creature": the built-in As-enters color choice (D147) feeding the
// chosen-color cast watcher. Line 0 is the engine's prompt; the def
// claims only the trigger. D235.

import { PRISM_RING } from '../../../data/fixtures/engineCards';
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
  PRISM_RING,
  'As this artifact enters, choose a color.\nWhenever you cast a spell of the chosen color, you gain 1 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const PRISM_RING_SCRIPT: CardScript = {
  oracleId: PRISM_RING.oracleId,
  name: PRISM_RING.name,
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
      label: () => 'Prism Ring — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
