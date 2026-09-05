// `Agent 13, Sharon Carter` - a aCreatureAttacksAlone trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AGENT_13_SHARON_CARTER } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(AGENT_13_SHARON_CARTER, "Whenever a creature you control attacks alone, investigate. (Create a Clue token. It's an artifact with \"{2}, Sacrifice this token: Draw a card.\")");
const TOKEN_L0 = tokenRef("Clue|/||Artifact|");

export const AGENT13_SHARON_CARTER_SCRIPT: CardScript = {
  oracleId: AGENT_13_SHARON_CARTER.oracleId,
  name: AGENT_13_SHARON_CARTER.name,
  triggers: [
    {
      abilityId: 'aCreatureAttacksAlone-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.length === 1 && ev.attackers.every((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Agent 13, Sharon Carter - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
