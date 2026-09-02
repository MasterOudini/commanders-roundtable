// `Cogworker's Puzzleknot` — "When this artifact enters, create a 1/1
// colorless Servo artifact creature token.\n{1}{W}, Sacrifice this artifact:
// Create a 1/1 colorless Servo artifact creature token." A Servo on entry
// and a Servo for the Puzzleknot itself; the self-sacrifice is charged at
// activation (D159), so the second Servo is made by a def whose source is
// already in the graveyard and reads `obj.controller`. The token is the
// pool's Servo (Servo Exhibition's, already pinned). D273.

import { COGWORKER_S_PUZZLEKNOT } from '../../../data/fixtures/engineCards';
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
  COGWORKER_S_PUZZLEKNOT,
  'When this artifact enters, create a 1/1 colorless Servo artifact creature token.\n{1}{W}, Sacrifice this artifact: Create a 1/1 colorless Servo artifact creature token.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const SACRIFICE = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SERVO = tokenRef('Servo|1/1||Artifact Creature|');

function servo(ctx: ScriptCtx, controller: string): readonly EventBody[] {
  return [
    {
      t: 'TokenCreated',
      card: ctx.ids.nextInstance(),
      oracleId: SERVO.oracleId,
      printingId: SERVO.printingId,
      controller,
      owner: controller,
      turnNumber: ctx.state.turn.turnNumber,
    },
  ];
}

export const COGWORKERS_PUZZLEKNOT_SCRIPT: CardScript = {
  oracleId: COGWORKER_S_PUZZLEKNOT.oracleId,
  name: COGWORKER_S_PUZZLEKNOT.name,
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
      label: () => "Cogworker's Puzzleknot — create a 1/1 Servo",
      resolve: (ctx, _self, obj): readonly EventBody[] => servo(ctx, obj.controller),
    },
  ],
  activated: [
    {
      ref: `${COGWORKER_S_PUZZLEKNOT.oracleId}#a0`,
      text: SACRIFICE,
      resolve: (ctx, _self, obj): readonly EventBody[] => servo(ctx, obj.controller),
    },
  ],
};
