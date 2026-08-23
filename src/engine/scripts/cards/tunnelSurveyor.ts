// `Tunnel Surveyor` — the ETB Glimmer, which is an ENCHANTMENT CREATURE
// token: the one new pin this batch needed, and there is exactly one Glimmer
// printing in the database so the resolution is unambiguous. D262.

import { TUNNEL_SURVEYOR } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TEXT = printed(
  TUNNEL_SURVEYOR,
  'When this creature enters, create a 1/1 white Glimmer enchantment creature token.',
);

const GLIMMER = tokenRef('Glimmer|1/1|W|Creature Enchantment|');

export const TUNNEL_SURVEYOR_SCRIPT: CardScript = {
  oracleId: TUNNEL_SURVEYOR.oracleId,
  name: TUNNEL_SURVEYOR.name,
  triggers: [
    {
      abilityId: 'etb-glimmer',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Tunnel Surveyor — create a 1/1 Glimmer',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GLIMMER.oracleId,
          printingId: GLIMMER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
