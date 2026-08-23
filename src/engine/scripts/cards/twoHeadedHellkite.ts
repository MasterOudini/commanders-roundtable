// `Two-Headed Hellkite` — the SELF-filtered attack trigger (Burrenton
// Shield-Bearers' shape, D166): the declaration is one event, and the filter
// is "is one of these attackers me", which is granularity-safe by
// construction. Three keyword lines above it never count, so the def's text
// is `split[1]`. D263.

import { TWO_HEADED_HELLKITE } from '../../../data/fixtures/engineCards';
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
  TWO_HEADED_HELLKITE,
  'Flying, menace, haste\nWhenever this creature attacks, draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TWO_HEADED_HELLKITE_SCRIPT: CardScript = {
  oracleId: TWO_HEADED_HELLKITE.oracleId,
  name: TWO_HEADED_HELLKITE.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Two-Headed Hellkite — draw two cards',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 2)];
      },
    },
  ],
};
