// `Brigone, Soldier of Meletis` - a heroic trigger selfCounter, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRIGONE_SOLDIER_OF_MELETIS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRIGONE_SOLDIER_OF_MELETIS, "Vigilance\nHeroic — Whenever you cast a spell that targets Brigone, put a +1/+1 counter on Brigone.\n{T}, Remove a +1/+1 counter from Brigone: Draw a card.");
const LINES = PRINTED.split('\n');

export const BRIGONE_SOLDIER_OF_MELETIS_SCRIPT: CardScript = {
  oracleId: BRIGONE_SOLDIER_OF_MELETIS.oracleId,
  name: BRIGONE_SOLDIER_OF_MELETIS.name,
  activated: [
    {
      ref: `${BRIGONE_SOLDIER_OF_MELETIS.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'heroic-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Brigone, Soldier of Meletis - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
