// `Beamsaw Prospector` — "When this creature dies, create a Lander token."
// Beskir's dies-token shape with a predefined artifact token whose ability is
// its OWN (D132's rule — the card never states it). M6.4g, D164.

import { BEAMSAW_PROSPECTOR } from '../../../data/fixtures/engineCards';
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
  BEAMSAW_PROSPECTOR,
  'When this creature dies, create a Lander token. ' +
    '(It\'s an artifact with "{2}, {T}, Sacrifice this token: Search your library for a basic land card, ' +
    'put it onto the battlefield tapped, then shuffle.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const LANDER = tokenRef('Lander|/||Artifact|');

export const BEAMSAW_PROSPECTOR_SCRIPT: CardScript = {
  oracleId: BEAMSAW_PROSPECTOR.oracleId,
  name: BEAMSAW_PROSPECTOR.name,
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
      label: () => 'Beamsaw Prospector — create a Lander token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: LANDER.oracleId,
          printingId: LANDER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
