// `Eusocial Engineering` - a landfall trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EUSOCIAL_ENGINEERING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EUSOCIAL_ENGINEERING, "Landfall — Whenever a land you control enters, create a 2/2 colorless Robot artifact creature token.\nWarp {1}{G} (You may cast this card from your hand for its warp cost. Exile this enchantment at the beginning of the next end step, then you may cast it from exile on a later turn.)");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Robot|2/2||Artifact Creature|");

export const EUSOCIAL_ENGINEERING_SCRIPT: CardScript = {
  oracleId: EUSOCIAL_ENGINEERING.oracleId,
  name: EUSOCIAL_ENGINEERING.name,
  triggers: [
    {
      abilityId: 'landfall-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Eusocial Engineering - token",
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
