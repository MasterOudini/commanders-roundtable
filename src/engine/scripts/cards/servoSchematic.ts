// `Servo Schematic` — "When this artifact enters or is put into a
// graveyard from the battlefield, create a 1/1 colorless Servo artifact
// creature token." Ichor Wellspring's enters-or-dies pair, one line, two
// defs. D246.

import { SERVO_SCHEMATIC } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { PlayerId } from '../../types/ids';

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
  SERVO_SCHEMATIC,
  'When this artifact enters or is put into a graveyard from the battlefield, create a 1/1 colorless Servo artifact creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const SERVO = tokenRef('Servo|1/1||Artifact Creature|');

function servoToken(ctx: ScriptCtx, controller: PlayerId): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: SERVO.oracleId,
    printingId: SERVO.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

export const SERVO_SCHEMATIC_SCRIPT: CardScript = {
  oracleId: SERVO_SCHEMATIC.oracleId,
  name: SERVO_SCHEMATIC.name,
  triggers: [
    {
      abilityId: 'etb-servo',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Servo Schematic — create a 1/1 Servo',
      resolve: (ctx, _self, obj): readonly EventBody[] => [servoToken(ctx, obj.controller)],
    },
    {
      abilityId: 'dies-servo',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Servo Schematic — create a 1/1 Servo',
      resolve: (ctx, _self, obj): readonly EventBody[] => [servoToken(ctx, obj.controller)],
    },
  ],
};
