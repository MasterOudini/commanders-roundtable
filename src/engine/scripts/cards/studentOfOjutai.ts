// `Student of Ojutai` — the NONCREATURE cast watcher: the cast face's
// derived types decide, so a creature spell pays nothing. D254.

import { STUDENT_OF_OJUTAI } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  STUDENT_OF_OJUTAI,
  'Whenever you cast a noncreature spell, you gain 2 life.',
);

export const STUDENT_OF_OJUTAI_SCRIPT: CardScript = {
  oracleId: STUDENT_OF_OJUTAI.oracleId,
  name: STUDENT_OF_OJUTAI.name,
  triggers: [
    {
      abilityId: 'noncreature-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return !faceOf(oc, ev.obj.faceIndex).typeLine.types.includes('Creature');
      },
      label: () => 'Student of Ojutai — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
