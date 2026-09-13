// `Prowess of the Fair` - a cardPutIntoGraveyard trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROWESS_OF_THE_FAIR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROWESS_OF_THE_FAIR, "Whenever another nontoken Elf is put into your graveyard from the battlefield, you may create a 1/1 green Elf Warrior creature token.");
const TOKEN_L0 = tokenRef("Elf Warrior|1/1|G|Creature|");

export const PROWESS_OF_THE_FAIR_SCRIPT: CardScript = {
  oracleId: PROWESS_OF_THE_FAIR.oracleId,
  name: PROWESS_OF_THE_FAIR.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && m.to.player === ctx.query.controllerOf(self) && m.card !== self && ctx.derive(m.card).typeLine.subtypes.includes('Elf') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Prowess of the Fair - token",
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
