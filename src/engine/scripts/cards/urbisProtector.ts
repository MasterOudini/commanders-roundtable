// `Urbis Protector` — the ETB 4/4 flying Angel on the ALREADY PINNED token
// (D247's `sld 1340`). D264.

import { URBIS_PROTECTOR } from '../../../data/fixtures/engineCards';
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
  URBIS_PROTECTOR,
  'When this creature enters, create a 4/4 white Angel creature token with flying.',
);

const ANGEL = tokenRef('Angel|4/4|W|Creature|flying');

export const URBIS_PROTECTOR_SCRIPT: CardScript = {
  oracleId: URBIS_PROTECTOR.oracleId,
  name: URBIS_PROTECTOR.name,
  triggers: [
    {
      abilityId: 'etb-angel',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Urbis Protector — create a 4/4 Angel with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ANGEL.oracleId,
          printingId: ANGEL.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
