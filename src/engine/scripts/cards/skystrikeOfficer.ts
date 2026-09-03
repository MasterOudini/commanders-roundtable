// `Skystrike Officer` — Flying is the engine's; attacking makes a colorless
// Soldier artifact token; tapping three untapped Soldiers I control (the
// D286 tap chooser; the Officer is a Soldier) buys a card.

import { SKYSTRIKE_OFFICER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(
  SKYSTRIKE_OFFICER,
  'Flying\nWhenever this creature attacks, create a 1/1 colorless Soldier artifact creature token.\nTap three untapped Soldiers you control: Draw a card.',
);
const ATTACKS = PRINTED.split('\n')[1] as string;
const DRAW = PRINTED.split('\n')[2] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const SOLDIER = tokenRef('Soldier|1/1||Artifact Creature|');

export const SKYSTRIKE_OFFICER_SCRIPT: CardScript = {
  oracleId: SKYSTRIKE_OFFICER.oracleId,
  name: SKYSTRIKE_OFFICER.name,
  triggers: [
    {
      abilityId: 'attacks-soldier',
      text: ATTACKS,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Skystrike Officer — create a 1/1 Soldier',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SOLDIER.oracleId,
          printingId: SOLDIER.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
  activated: [
    {
      ref: `${SKYSTRIKE_OFFICER.oracleId}#a0`,
      text: DRAW,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
