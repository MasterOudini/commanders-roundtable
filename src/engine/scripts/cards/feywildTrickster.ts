// `Feywild Trickster` — "Whenever you roll one or more dice, create a 1/1
// blue Faerie Dragon creature token with flying." The FIRST `DiceRolled`
// consumer (D175): the Tier-3 dice tool has emitted the event since M3, and
// one manual roll is one die is one event — so per-event firing IS the
// card's "one or more" batching. The wrench rolls; the trigger automates
// what follows. M6.4s, D175.

import { FEYWILD_TRICKSTER } from '../../../data/fixtures/engineCards';
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
  FEYWILD_TRICKSTER,
  'Whenever you roll one or more dice, create a 1/1 blue Faerie Dragon creature token with flying.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const FAERIE_DRAGON = tokenRef('Faerie Dragon|1/1|U|Creature|flying');

export const FEYWILD_TRICKSTER_SCRIPT: CardScript = {
  oracleId: FEYWILD_TRICKSTER.oracleId,
  name: FEYWILD_TRICKSTER.name,
  triggers: [
    {
      abilityId: 'dice',
      text: TEXT,
      event: 'DiceRolled',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DiceRolled' && ev.player === ctx.query.controllerOf(self),
      label: () => 'Feywild Trickster — create a 1/1 Faerie Dragon with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: FAERIE_DRAGON.oracleId,
          printingId: FAERIE_DRAGON.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
