// `Spawn-Gang Commander` - a castThisSpell trigger vocab, an activation damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPAWN_GANG_COMMANDER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SPAWN_GANG_COMMANDER, "Devoid (This card has no color.)\nWhen you cast this spell, create three 0/1 colorless Eldrazi Spawn creature tokens with \"Sacrifice this token: Add {C}.\"\n{1}{C}, Sacrifice an Eldrazi: This creature deals 2 damage to any target.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create three 0/1 colorless Eldrazi Spawn creature tokens with \"Sacrifice this token: Add {C}.\"", SPAWN_GANG_COMMANDER.name);
const VOCAB_T_L1 = vocabularyTargets("Create three 0/1 colorless Eldrazi Spawn creature tokens with \"Sacrifice this token: Add {C}.\"");

export const SPAWN_GANG_COMMANDER_SCRIPT: CardScript = {
  oracleId: SPAWN_GANG_COMMANDER.oracleId,
  name: SPAWN_GANG_COMMANDER.name,
  activated: [
    {
      ref: `${SPAWN_GANG_COMMANDER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
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
                amount: 2,
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
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castThisSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ["stack"],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.card === self,
      label: () => "Spawn-Gang Commander - Create three 0/1 colorless Eldrazi Spawn creature tokens with \"Sacrifice this token: Add {C}.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
