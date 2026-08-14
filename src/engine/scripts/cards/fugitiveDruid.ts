// `Fugitive Druid` — "Whenever this creature becomes the target of an Aura
// spell, you draw a card." Druid of Horns' cast-targets reader (D172) with the
// CASTER filter dropped: ANY player's Aura spell aimed at the Druid pays its
// CONTROLLER a card. M6.4t, D176.

import { FUGITIVE_DRUID } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  FUGITIVE_DRUID,
  'Whenever this creature becomes the target of an Aura spell, you draw a card.',
);

export const FUGITIVE_DRUID_SCRIPT: CardScript = {
  oracleId: FUGITIVE_DRUID.oracleId,
  name: FUGITIVE_DRUID.name,
  triggers: [
    {
      abilityId: 'aura-targeted',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (!ev.obj.targets.some((t) => t.kind === 'card' && t.id === self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).typeLine.subtypes.includes('Aura');
      },
      label: () => 'Fugitive Druid — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
