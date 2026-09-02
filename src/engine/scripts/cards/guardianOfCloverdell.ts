// `Guardian of Cloverdell` — "When this creature enters, create three 1/1
// white Kithkin Soldier creature tokens.\n{G}, Sacrifice a Kithkin: You gain
// 1 life." Three tokens on entry (three TokenCreated events) and a
// creature-SUBTYPE sacrifice chooser (Arms Dealer's Goblin, D168's chooser
// one noun over) paying for a life. The token is the WHITE Kithkin Soldier
// (tshm 1), pinned this batch — not D273's green-white Kithkin. D275.

import { GUARDIAN_OF_CLOVERDELL } from '../../../data/fixtures/engineCards';
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
  GUARDIAN_OF_CLOVERDELL,
  'When this creature enters, create three 1/1 white Kithkin Soldier creature tokens.\n{G}, Sacrifice a Kithkin: You gain 1 life.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const GAIN = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const KITHKIN_SOLDIER = tokenRef('Kithkin Soldier|1/1|W|Creature|');

function soldier(ctx: ScriptCtx, controller: string): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: KITHKIN_SOLDIER.oracleId,
    printingId: KITHKIN_SOLDIER.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

export const GUARDIAN_OF_CLOVERDELL_SCRIPT: CardScript = {
  oracleId: GUARDIAN_OF_CLOVERDELL.oracleId,
  name: GUARDIAN_OF_CLOVERDELL.name,
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
      label: () => 'Guardian of Cloverdell — create three 1/1 Kithkin Soldiers',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        soldier(ctx, obj.controller),
        soldier(ctx, obj.controller),
        soldier(ctx, obj.controller),
      ],
    },
  ],
  activated: [
    {
      ref: `${GUARDIAN_OF_CLOVERDELL.oracleId}#a0`,
      text: GAIN,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
