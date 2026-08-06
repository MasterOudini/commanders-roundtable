// `Dwarven Mine` — Land, "({T}: Add {R}.)\nThis land enters tapped unless
// you control three or more other Mountains.\nWhen this land enters
// UNTAPPED, create a 1/1 red Dwarf creature token." The FIRST enters-UNTAPPED
// filter (D172): line 1 is D135's `otherLandsOfType` board query and the mana
// line is the engine's; the def owes line 2, whose condition it reads off the
// AFTER state — the entry has already applied (or not applied) D134's tap by
// the time triggers collect, so `tapped` IS the answer. M6.4p, D172.

import { DWARVEN_MINE } from '../../../data/fixtures/engineCards';
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
  DWARVEN_MINE,
  '({T}: Add {R}.)\nThis land enters tapped unless you control three or more other Mountains.\n' +
    'When this land enters untapped, create a 1/1 red Dwarf creature token.',
);
const TEXT = PRINTED.split('\n')[2] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const DWARF = tokenRef('Dwarf|1/1|R|Creature|');

export const DWARVEN_MINE_SCRIPT: CardScript = {
  oracleId: DWARVEN_MINE.oracleId,
  name: DWARVEN_MINE.name,
  triggers: [
    {
      abilityId: 'etb-untapped',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ctx.state.cards[self]?.tapped === false &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Dwarven Mine — create a 1/1 Dwarf',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: DWARF.oracleId,
          printingId: DWARF.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
