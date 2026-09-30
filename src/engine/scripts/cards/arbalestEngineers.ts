// `Arbalest Engineers` - a etb trigger damageTarget, a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARBALEST_ENGINEERS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(ARBALEST_ENGINEERS, "When this creature enters, choose one —\n• This creature deals 1 damage to any target.\n• Put a +1/+1 counter on target creature. It gains trample and haste until end of turn.\n• Create a tapped Powerstone token. (It's an artifact with \"{T}: Add {C}. This mana can't be spent to cast a nonartifact spell.\")");
const LINES = PRINTED.split('\n');

const MODES_L0 = [
  { text: "This creature deals 1 damage to any target.", targets: vocabularyTargets("~ deals 1 damage to any target.") },
  { text: "Put a +1/+1 counter on target creature. It gains trample and haste until end of turn.", targets: vocabularyTargets("Put a +1/+1 counter on target creature. It gains trample and haste until end of turn.") },
  { text: "Create a tapped Powerstone token.", targets: vocabularyTargets("Create a tapped Powerstone token.") },
];

const VOCAB_L0_m1 = vocabularyEffects("Put a +1/+1 counter on target creature. It gains trample and haste until end of turn.", ARBALEST_ENGINEERS.name);
const VOCAB_T_L0_m1 = vocabularyTargets("Put a +1/+1 counter on target creature. It gains trample and haste until end of turn.");
const VOCAB_L0_m2 = vocabularyEffects("Create a tapped Powerstone token.", ARBALEST_ENGINEERS.name);
const VOCAB_T_L0_m2 = vocabularyTargets("Create a tapped Powerstone token.");

export const ARBALEST_ENGINEERS_SCRIPT: CardScript = {
  oracleId: ARBALEST_ENGINEERS.oracleId,
  name: ARBALEST_ENGINEERS.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L0,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Arbalest Engineers - choose one",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
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
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L0_m1, VOCAB_T_L0_m1);
        }
        if (chosen === 2) {
          return ctx.vocabulary(obj, VOCAB_L0_m2, VOCAB_T_L0_m2);
        }
        return [];
      },
    },
  ],
};
