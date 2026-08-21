// `Surtr, Fiery Jötun` — the HISTORIC cast watcher that TARGETS: Jhoira's
// filter (artifact, legendary, or Saga — CR 700.10) feeding a 3-damage
// ping through the trigger's own aim. The trample line is Tier 2 and
// never counts; TEXT = split[1].
//
// ⚠️ The fixture const strips the diacritic: SURTR_FIERY_J_TUN
// (constName collapses non-alphanumeric runs — the Lothlórien Lookout
// precedent, D222).

import { SURTR_FIERY_J_TUN } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import { faceOf } from '../../oracle';
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
  SURTR_FIERY_J_TUN,
  "Trample (This creature can deal excess combat damage to the player it's attacking.)\n" +
    'Whenever you cast a historic spell, Surtr deals 3 damage to any target. ' +
    '(Artifacts, legendaries, and Sagas are historic.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SURTR_FIERY_JOTUN_SCRIPT: CardScript = {
  oracleId: SURTR_FIERY_J_TUN.oracleId,
  name: SURTR_FIERY_J_TUN.name,
  triggers: [
    {
      abilityId: 'historic-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        const face = faceOf(oc, ev.obj.faceIndex);
        return (
          face.typeLine.types.includes('Artifact') ||
          face.typeLine.supertypes.includes('Legendary') ||
          face.typeLine.subtypes.includes('Saga')
        );
      },
      label: () => 'Surtr, Fiery Jötun — deals 3 damage to any target',
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
          return [];
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target:
                  target.kind === 'player'
                    ? { kind: 'player', id: target.id }
                    : { kind: 'card', id: target.id },
                amount: 3,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect')
                  ? target.kind === 'player'
                    ? 'poison'
                    : 'wither'
                  : d.keywords.has('wither') && target.kind === 'card'
                    ? 'wither'
                    : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
