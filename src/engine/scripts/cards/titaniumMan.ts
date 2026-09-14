// `Titanium Man` - a attacks trigger pumping itself, a attacks trigger damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TITANIUM_MAN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(TITANIUM_MAN, "Whenever Titanium Man attacks, choose one —\n• Titanium Man gains flying until end of turn.\n• Titanium Man deals 1 damage to any target.");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "Titanium Man gains flying until end of turn.", targets: vocabularyTargets("~ gains flying until end of turn.") },
  { text: "Titanium Man deals 1 damage to any target.", targets: vocabularyTargets("~ deals 1 damage to any target.") },
];

export const TITANIUM_MAN_SCRIPT: CardScript = {
  oracleId: TITANIUM_MAN.oracleId,
  name: TITANIUM_MAN.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Titanium Man - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          const me = ctx.state.cards[self];
          if (!me || me.zone.kind !== 'battlefield') return [];
          return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
        }
        if (chosen === 1) {
          const target = obj.targets[0];
          if (!target || target.kind === 'stack') return [];
          const d = ctx.derive(self);
          const infect = d.keywords.has('infect');
          const wither = d.keywords.has('wither');
          return [
            {
              t: 'DamageDealt',
              damages: [
                {
                  source: self,
                  target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                  amount: 1,
                  deathtouch: d.keywords.has('deathtouch'),
                  lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                  isCommanderDamage: false,
                  viaTrample: 0,
                  toxic: d.toxicAmount ?? 0,
                  applyAs: target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal',
                },
              ],
            },
          ];
        }
        return [];
      },
    },
  ],
};
