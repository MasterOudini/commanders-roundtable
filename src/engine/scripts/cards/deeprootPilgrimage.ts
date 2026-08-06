// `Deeproot Pilgrimage` — "Whenever one or more nontoken Merfolk you control
// become tapped, create a 1/1 blue Merfolk creature token with hexproof."
// The FIRST tap-watcher (D170) — and the batched `PermanentsTapped` event is
// EXACTLY the card's own granularity: "one or more … become tapped" fires
// once per event however many tapped together, so per-event dispatch is the
// rule rather than a compromise (the shape D163 refused for Aya, correct
// here by the card's own wording). M6.4m, D170.

import { DEEPROOT_PILGRIMAGE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  DEEPROOT_PILGRIMAGE,
  'Whenever one or more nontoken Merfolk you control become tapped, create a 1/1 blue Merfolk creature token with hexproof.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MERFOLK = tokenRef('Merfolk|1/1|U|Creature|hexproof');

export const DEEPROOT_PILGRIMAGE_SCRIPT: CardScript = {
  oracleId: DEEPROOT_PILGRIMAGE.oracleId,
  name: DEEPROOT_PILGRIMAGE.name,
  triggers: [
    {
      abilityId: 'tapped',
      text: TEXT,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'PermanentsTapped' &&
        ev.cards.some((id) => {
          const inst = ctx.state.cards[id];
          if (!inst || inst.isToken) return false;
          if (inst.controller !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(id).typeLine.subtypes.includes('Merfolk');
        }),
      label: () => 'Deeproot Pilgrimage — create a 1/1 Merfolk with hexproof',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: MERFOLK.oracleId,
          printingId: MERFOLK.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
