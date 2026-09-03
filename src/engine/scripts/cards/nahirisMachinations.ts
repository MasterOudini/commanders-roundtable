// `Nahiri's Machinations` — at the beginning of combat on my turn a creature
// I control gains indestructible until end of turn (Blood Mist's step
// trigger, the temporary keyword carrier); {1}{R} pings a BLOCKING creature
// (D291's role).

import { NAHIRI_S_MACHINATIONS } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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
  NAHIRI_S_MACHINATIONS,
  'At the beginning of combat on your turn, target creature you control gains indestructible until end of turn.\n{1}{R}: This enchantment deals 1 damage to target blocking creature.',
);
const TRIGGER = PRINTED.split('\n')[0] as string;
const PING = PRINTED.split('\n')[1] as string;

export const NAHIRIS_MACHINATIONS_SCRIPT: CardScript = {
  oracleId: NAHIRI_S_MACHINATIONS.oracleId,
  name: NAHIRI_S_MACHINATIONS.name,
  triggers: [
    {
      abilityId: 'combat',
      text: TRIGGER,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TRIGGER),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Nahiri's Machinations — target creature you control gains indestructible until end of turn",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['indestructible'] }];
      },
    },
  ],
  activated: [
    {
      ref: `${NAHIRI_S_MACHINATIONS.oracleId}#a0`,
      text: PING,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'DamageDealt',
            damages: [{ source: self, target: { kind: 'card', id: target.id }, amount: 1, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' }],
          },
        ];
      },
    },
  ],
};
