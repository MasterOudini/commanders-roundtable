// `Thorn Lieutenant` - a becomesTargetedByOpponent trigger token, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THORN_LIEUTENANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORN_LIEUTENANT, "Whenever this creature becomes the target of a spell or ability an opponent controls, create a 1/1 green Elf Warrior creature token.\n{5}{G}: This creature gets +4/+4 until end of turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Elf Warrior|1/1|G|Creature|");

export const THORN_LIEUTENANT_SCRIPT: CardScript = {
  oracleId: THORN_LIEUTENANT.oracleId,
  name: THORN_LIEUTENANT.name,
  activated: [
    {
      ref: `${THORN_LIEUTENANT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 4, toughness: 4 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'becomesTargetedByOpponent-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Thorn Lieutenant - token",
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
    {
      abilityId: 'becomesTargetedByOpponentAbility-0',
      text: LINES[0] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.controller !== ctx.query.controllerOf(self) && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Thorn Lieutenant - token",
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
