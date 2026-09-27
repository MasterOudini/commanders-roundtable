// `Wren's Run Packmaster` - an activation token, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WREN_S_RUN_PACKMASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WREN_S_RUN_PACKMASTER, "Champion an Elf (When this creature enters, sacrifice it unless you exile another Elf you control. When this creature leaves the battlefield, that card returns to the battlefield.)\n{2}{G}: Create a 2/2 green Wolf creature token.\nWolves you control have deathtouch.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Wolf|2/2|G|Creature|");

export const WRENS_RUN_PACKMASTER_SCRIPT: CardScript = {
  oracleId: WREN_S_RUN_PACKMASTER.oracleId,
  name: WREN_S_RUN_PACKMASTER.name,
  activated: [
    {
      ref: `${WREN_S_RUN_PACKMASTER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Wolf") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("deathtouch");
      },
    },
  ],
};
