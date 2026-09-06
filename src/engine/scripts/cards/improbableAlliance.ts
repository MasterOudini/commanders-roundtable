// `Improbable Alliance` - a secondCard trigger token, an activation loot
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IMPROBABLE_ALLIANCE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(IMPROBABLE_ALLIANCE, "Whenever you draw your second card each turn, create a 1/1 blue Faerie creature token with flying.\n{4}{U}{R}: Draw a card, then discard a card.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Faerie|1/1|U|Creature|flying");

export const IMPROBABLE_ALLIANCE_SCRIPT: CardScript = {
  oracleId: IMPROBABLE_ALLIANCE.oracleId,
  name: IMPROBABLE_ALLIANCE.name,
  activated: [
    {
      ref: `${IMPROBABLE_ALLIANCE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [
          ...drawEvents(ctx.state, obj.controller, 1),
          { t: 'AwaitingSet', awaiting: { kind: 'chooseFromZone', player: obj.controller, zone: 'hand', rest: null, count: 1, label: "Improbable Alliance - discard a card" } },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: LINES[0] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Improbable Alliance - token",
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
