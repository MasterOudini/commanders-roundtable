// `Tinker's Tote` — two Gnomes on entry; white mana and the Tote for 3 life.

import { TINKER_S_TOTE } from '../../../data/fixtures/engineCards';
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
  TINKER_S_TOTE,
  'When this artifact enters, create two 1/1 colorless Gnome artifact creature tokens.\n{W}, Sacrifice this artifact: You gain 3 life.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const GAIN = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const GNOME = tokenRef('Gnome|1/1||Artifact Creature|');

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

export const TINKERS_TOTE_SCRIPT: CardScript = {
  oracleId: TINKER_S_TOTE.oracleId,
  name: TINKER_S_TOTE.name,
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
      label: () => "Tinker's Tote — create two Gnomes",
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        token(ctx, obj.controller, GNOME),
        token(ctx, obj.controller, GNOME),
      ],
    },
  ],
  activated: [
    {
      ref: `${TINKER_S_TOTE.oracleId}#a0`,
      text: GAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
};
