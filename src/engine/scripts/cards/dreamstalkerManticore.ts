// `Dreamstalker Manticore` - a castInOpponentsTurn trigger damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAMSTALKER_MANTICORE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAMSTALKER_MANTICORE, "Whenever you cast your first spell during each opponent's turn, this creature deals 1 damage to any target.");

export const DREAMSTALKER_MANTICORE_SCRIPT: CardScript = {
  oracleId: DREAMSTALKER_MANTICORE.oracleId,
  name: DREAMSTALKER_MANTICORE.name,
  triggers: [
    {
      abilityId: 'castInOpponentsTurn-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(PRINTED),
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer !== ev.obj.controller && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 1,
      label: () => "Dreamstalker Manticore - damageTarget",
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
      },
    },
  ],
};
