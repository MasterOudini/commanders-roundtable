// `Hearthborn Battler` - a secondSpell trigger damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HEARTHBORN_BATTLER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(HEARTHBORN_BATTLER, "Haste\nWhenever a player casts their second spell each turn, this creature deals 2 damage to target opponent.");
const LINES = PRINTED.split('\n');

export const HEARTHBORN_BATTLER_SCRIPT: CardScript = {
  oracleId: HEARTHBORN_BATTLER.oracleId,
  name: HEARTHBORN_BATTLER.name,
  triggers: [
    {
      abilityId: 'secondSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(LINES[1] as string),
      matches: (ctx, _self, ev) => ev.t === 'SpellCast' && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Hearthborn Battler - damageTarget",
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
};
