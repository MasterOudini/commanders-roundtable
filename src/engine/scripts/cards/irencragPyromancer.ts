// `Irencrag Pyromancer` - a secondCard trigger damageTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IRENCRAG_PYROMANCER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IRENCRAG_PYROMANCER, "Whenever you draw your second card each turn, this creature deals 3 damage to any target.");

export const IRENCRAG_PYROMANCER_SCRIPT: CardScript = {
  oracleId: IRENCRAG_PYROMANCER.oracleId,
  name: IRENCRAG_PYROMANCER.name,
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(PRINTED),
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Irencrag Pyromancer - damageTarget",
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
                amount: 3,
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
