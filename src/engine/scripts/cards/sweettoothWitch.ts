// `Sweettooth Witch` — a Food on entry; two mana and a Food sold for 2 life
// off a player.

import { SWEETTOOTH_WITCH } from '../../../data/fixtures/engineCards';
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
  SWEETTOOTH_WITCH,
  'When this creature enters, create a Food token. (It\'s an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")\n{2}, Sacrifice a Food: Target player loses 2 life.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const DRAIN = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const FOOD = tokenRef('Food|/||Artifact|');

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

export const SWEETTOOTH_WITCH_SCRIPT: CardScript = {
  oracleId: SWEETTOOTH_WITCH.oracleId,
  name: SWEETTOOTH_WITCH.name,
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
      label: () => 'Sweettooth Witch — create a Food',
      resolve: (ctx, _self, obj): readonly EventBody[] => [token(ctx, obj.controller, FOOD)],
    },
  ],
  activated: [
    {
      ref: `${SWEETTOOTH_WITCH.oracleId}#a0`,
      text: DRAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const them = ctx.state.players[target.id];
        if (!them || them.hasLost) return [];
        return [{ t: 'LifeChanged', player: target.id, delta: -2, to: them.life - 2 }];
      },
    },
  ],
};
