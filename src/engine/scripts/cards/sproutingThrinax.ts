// `Sprouting Thrinax` — its death pays THREE distinct Saprolings on the
// shipped pin. D251.

import { SPROUTING_THRINAX } from '../../../data/fixtures/engineCards';
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
  SPROUTING_THRINAX,
  'When this creature dies, create three 1/1 green Saproling creature tokens.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const SPROUTING_THRINAX_SCRIPT: CardScript = {
  oracleId: SPROUTING_THRINAX.oracleId,
  name: SPROUTING_THRINAX.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Sprouting Thrinax — create three 1/1 Saprolings',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const events: EventBody[] = [];
        for (let i = 0; i < 3; i++) {
          events.push({
            t: 'TokenCreated',
            card: ctx.ids.nextInstance(),
            oracleId: SAPROLING.oracleId,
            printingId: SAPROLING.printingId,
            controller: obj.controller,
            owner: obj.controller,
            turnNumber: ctx.state.turn.turnNumber,
          });
        }
        return events;
      },
    },
  ],
};
