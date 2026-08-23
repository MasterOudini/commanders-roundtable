// `Tukatongue Thallid` — the dies-token on the pinned Saproling. Looks back,
// so the Thallid's own death is visible to its own trigger (CR 603.10a,
// D147's `looksBack`). D262.

import { TUKATONGUE_THALLID } from '../../../data/fixtures/engineCards';
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
  TUKATONGUE_THALLID,
  'When this creature dies, create a 1/1 green Saproling creature token.',
);

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const TUKATONGUE_THALLID_SCRIPT: CardScript = {
  oracleId: TUKATONGUE_THALLID.oracleId,
  name: TUKATONGUE_THALLID.name,
  triggers: [
    {
      abilityId: 'dies-saproling',
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
      label: () => 'Tukatongue Thallid — create a 1/1 Saproling',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SAPROLING.oracleId,
          printingId: SAPROLING.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
