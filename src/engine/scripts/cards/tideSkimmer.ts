// `Tide Skimmer` — the attacker COUNT filtered by a DERIVED keyword.
//
// ⚠️ This is D246's Shadewing Laureate idiom on a combat event: a MATCHER
// reads what the aim layer's parse never can. "Two or more creatures with
// flying" is not a target clause at all — it is a census over the
// declaration, and `flying` is asked of the derived characteristics, so a
// GRANTED flyer counts exactly as a printed one does.
//
// The per-declaration batch is the card's own "you attack with" wording
// (Deeproot Pilgrimage's argument, D170), so one firing per declaration is
// right. D260.

import { TIDE_SKIMMER } from '../../../data/fixtures/engineCards';
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
  TIDE_SKIMMER,
  'Flying\nWhenever you attack with two or more creatures with flying, draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TIDE_SKIMMER_SCRIPT: CardScript = {
  oracleId: TIDE_SKIMMER.oracleId,
  name: TIDE_SKIMMER.name,
  triggers: [
    {
      abilityId: 'two-flyers-attack',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return false;
        const mine = ctx.query.controllerOf(self);
        let flyers = 0;
        for (const a of ev.attackers) {
          const inst = ctx.state.cards[a.card];
          if (!inst || inst.controller !== mine) continue;
          if (ctx.derive(a.card).keywords.has('flying')) flyers += 1;
        }
        return flyers >= 2;
      },
      label: () => 'Tide Skimmer — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
