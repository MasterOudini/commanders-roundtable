// `Jedit Ojanen of Efrava` — "Whenever Jedit Ojanen attacks or blocks,
// create a 2/2 green Cat Warrior creature token with forestwalk." The first
// ATTACKS-OR-BLOCKS pair — one printed line, two defs: Grave Titan's attack
// arm, and the FIRST `BlockersDeclared` consumer this engine has (the
// printed self-reference by NAME rides the printed() guard; the filter is
// the instance, as always). M6.4z, D182.

import { JEDIT_OJANEN_OF_EFRAVA } from '../../../data/fixtures/engineCards';
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
  JEDIT_OJANEN_OF_EFRAVA,
  "Forestwalk (This creature can't be blocked as long as defending player controls a Forest.)\n" +
    'Whenever Jedit Ojanen attacks or blocks, create a 2/2 green Cat Warrior creature token with forestwalk.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CAT_WARRIOR = tokenRef('Cat Warrior|2/2|G|Creature|forestwalk');

export const JEDIT_OJANEN_OF_EFRAVA_SCRIPT: CardScript = {
  oracleId: JEDIT_OJANEN_OF_EFRAVA.oracleId,
  name: JEDIT_OJANEN_OF_EFRAVA.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Jedit Ojanen — create a 2/2 Cat Warrior',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CAT_WARRIOR.oracleId,
          printingId: CAT_WARRIOR.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
    {
      abilityId: 'blocks',
      text: TEXT,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => 'Jedit Ojanen — create a 2/2 Cat Warrior',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CAT_WARRIOR.oracleId,
          printingId: CAT_WARRIOR.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
