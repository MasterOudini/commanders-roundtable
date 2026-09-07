// `Essence Anchor` - a upkeep trigger scry, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ESSENCE_ANCHOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ESSENCE_ANCHOR, "At the beginning of your upkeep, surveil 1. (Look at the top card of your library. You may put it into your graveyard.)\n{T}: Create a 2/2 black Zombie Druid creature token. Activate only during your turn and only if a card left your graveyard this turn.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Zombie Druid|2/2|B|Creature|");

export const ESSENCE_ANCHOR_SCRIPT: CardScript = {
  oracleId: ESSENCE_ANCHOR.oracleId,
  name: ESSENCE_ANCHOR.name,
  activated: [
    {
      ref: `${ESSENCE_ANCHOR.oracleId}#a0`,
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
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Essence Anchor - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "Essence Anchor - surveil 1" } },
        ];
      },
    },
  ],
};
