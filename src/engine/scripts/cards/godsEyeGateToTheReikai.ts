// `Gods' Eye, Gate to the Reikai` — Legendary Land, "When Gods' Eye is put
// into a graveyard from the battlefield, create a 1/1 colorless Spirit
// creature token." The dies-token on a LAND; the mana line is ability 0 and
// the engine's own. ⚠️ LAND-TIME CHECK: the fixture const for a trailing
// apostrophe ("Gods'") — verify against the generated engineCards.ts.
// M6.4u, D177.

import { GODS_EYE_GATE_TO_THE_REIKAI } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  GODS_EYE_GATE_TO_THE_REIKAI,
  "{T}: Add {C}.\nWhen Gods' Eye is put into a graveyard from the battlefield, create a 1/1 colorless Spirit creature token.",
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|1/1||Creature|');

export const GODS_EYE_GATE_TO_THE_REIKAI_SCRIPT: CardScript = {
  oracleId: GODS_EYE_GATE_TO_THE_REIKAI.oracleId,
  name: GODS_EYE_GATE_TO_THE_REIKAI.name,
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
      label: () => "Gods' Eye — create a 1/1 Spirit",
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SPIRIT.oracleId,
          printingId: SPIRIT.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
