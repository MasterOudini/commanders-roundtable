// `Deeproot Waters` — "Whenever you cast a Merfolk spell, create a 1/1 blue
// Merfolk creature token with hexproof." Briarknit Kami's subtype
// cast-watcher feeding the hexproof Merfolk. M6.4m, D170.

import { DEEPROOT_WATERS } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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
  DEEPROOT_WATERS,
  "Whenever you cast a Merfolk spell, create a 1/1 blue Merfolk creature token with hexproof. (A creature with hexproof can't be the target of spells or abilities your opponents control.)",
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const MERFOLK = tokenRef('Merfolk|1/1|U|Creature|hexproof');

export const DEEPROOT_WATERS_SCRIPT: CardScript = {
  oracleId: DEEPROOT_WATERS.oracleId,
  name: DEEPROOT_WATERS.name,
  triggers: [
    {
      abilityId: 'cast',
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
        return faceOf(oc, ev.obj.faceIndex).typeLine.subtypes.includes('Merfolk');
      },
      label: () => 'Deeproot Waters — create a 1/1 Merfolk with hexproof',
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
