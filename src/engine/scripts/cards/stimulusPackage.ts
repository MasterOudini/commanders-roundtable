// `Stimulus Package` — "When this enchantment enters, create two Treasure
// tokens. (reminder)\nSacrifice a Treasure: Create a 1/1 green and white
// Citizen creature token." Two Treasures on entry, and Jolene's
// Treasure-sacrifice chooser (D277) with NO mana paying for the pool's G/W
// Citizen (tsnc 12, pinned this batch). D281.

import { STIMULUS_PACKAGE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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
  STIMULUS_PACKAGE,
  'When this enchantment enters, create two Treasure tokens. (They\'re artifacts with "{T}, Sacrifice this token: Add one mana of any color.")\nSacrifice a Treasure: Create a 1/1 green and white Citizen creature token.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const CITIZEN_LINE = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TREASURE = tokenRef('Treasure|/||Artifact|');
const CITIZEN = tokenRef('Citizen|1/1|GW|Creature|');

function token(ctx: ScriptCtx, controller: string, ref: TokenRef): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: ref.oracleId,
    printingId: ref.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

export const STIMULUS_PACKAGE_SCRIPT: CardScript = {
  oracleId: STIMULUS_PACKAGE.oracleId,
  name: STIMULUS_PACKAGE.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Stimulus Package — create two Treasures',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        token(ctx, obj.controller, TREASURE),
        token(ctx, obj.controller, TREASURE),
      ],
    },
  ],
  activated: [
    {
      ref: `${STIMULUS_PACKAGE.oracleId}#a0`,
      text: CITIZEN_LINE,
      resolve: (ctx, _self, obj): readonly EventBody[] => [token(ctx, obj.controller, CITIZEN)],
    },
  ],
};
