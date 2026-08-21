// `Rotlung Reanimator` — "Whenever this creature or another Cleric dies,
// create a 2/2 black Zombie creature token." The FIFTH perItem consumer
// and the first on DEATHS: a wipe killing three Clerics pays three
// Zombies. Any controller's Cleric counts; the subtype is read on the
// BEFORE state (looksBack). D241.

import { ROTLUNG_REANIMATOR } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(
  ROTLUNG_REANIMATOR,
  'Whenever this creature or another Cleric dies, create a 2/2 black Zombie creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const ZOMBIE = tokenRef('Zombie|2/2|B|Creature|');

function qualifies(ctx: ScriptCtx, self: InstanceId, dead: InstanceId): boolean {
  if (dead === self) return true;
  return ctx.derive(dead).typeLine.subtypes.includes('Cleric');
}

export const ROTLUNG_REANIMATOR_SCRIPT: CardScript = {
  oracleId: ROTLUNG_REANIMATOR.oracleId,
  name: ROTLUNG_REANIMATOR.name,
  triggers: [
    {
      abilityId: 'cleric-dies-zombie',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.from.kind === 'battlefield' &&
            m.to.kind === 'graveyard' &&
            qualifies(ctx, self, m.card),
        ),
      // One firing PER dying Cleric (itself included).
      perItem: (ctx, self, ev) =>
        ev.t === 'CardsMoved'
          ? ev.moves
              .filter(
                (m) =>
                  m.from.kind === 'battlefield' &&
                  m.to.kind === 'graveyard' &&
                  qualifies(ctx, self, m.card),
              )
              .map((m) => m.card)
          : [],
      label: () => 'Rotlung Reanimator — create a 2/2 Zombie',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: ZOMBIE.oracleId,
          printingId: ZOMBIE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
