// `Garrison Excavator` — "Whenever one or more cards leave your graveyard,
// create a 2/2 red and white Spirit creature token." Desecrated Tomb's
// graveyard-exit watcher (D171) with the type filter dropped: ANY card
// leaving pays. Line 1 is Menace (Tier 2). M6.4t, D176.

import { GARRISON_EXCAVATOR } from '../../../data/fixtures/engineCards';
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
  GARRISON_EXCAVATOR,
  "Menace (This creature can't be blocked except by two or more creatures.)\nWhenever one or more cards leave your graveyard, create a 2/2 red and white Spirit creature token.",
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SPIRIT = tokenRef('Spirit|2/2|RW|Creature|');

export const GARRISON_EXCAVATOR_SCRIPT: CardScript = {
  oracleId: GARRISON_EXCAVATOR.oracleId,
  name: GARRISON_EXCAVATOR.name,
  triggers: [
    {
      abilityId: 'gy-exit',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'graveyard' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => 'Garrison Excavator — create a 2/2 Spirit',
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
