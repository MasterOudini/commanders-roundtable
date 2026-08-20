// `Murmuring Mystic` — "Whenever you cast an instant or sorcery spell,
// create a 1/1 blue Bird Illusion creature token with flying." Talrand's
// filter paying a Bird Illusion. D227.

import { MURMURING_MYSTIC } from '../../../data/fixtures/engineCards';
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
  MURMURING_MYSTIC,
  'Whenever you cast an instant or sorcery spell, create a 1/1 blue Bird Illusion creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const BIRD = tokenRef('Bird Illusion|1/1|U|Creature|flying');

export const MURMURING_MYSTIC_SCRIPT: CardScript = {
  oracleId: MURMURING_MYSTIC.oracleId,
  name: MURMURING_MYSTIC.name,
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
        const types = faceOf(oc, ev.obj.faceIndex).typeLine.types;
        return types.includes('Instant') || types.includes('Sorcery');
      },
      label: () => 'Murmuring Mystic — create a 1/1 Bird Illusion with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: BIRD.oracleId,
          printingId: BIRD.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
