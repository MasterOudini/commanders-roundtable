// `Nightscape Master` — "{U}{U}, {T}: Return target creature to its owner's
// hand.\n{R}{R}, {T}: This creature deals 2 damage to target creature." Two
// tap activations: Aether Spellbomb's bounce to the OWNER's hand (D272) and
// Arms Dealer's damage with the Master itself as the derived source. D278.

import { NIGHTSCAPE_MASTER } from '../../../data/fixtures/engineCards';
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
  NIGHTSCAPE_MASTER,
  "{U}{U}, {T}: Return target creature to its owner's hand.\n{R}{R}, {T}: This creature deals 2 damage to target creature.",
);
const BOUNCE = PRINTED.split('\n')[0] as string;
const BURN = PRINTED.split('\n')[1] as string;

export const NIGHTSCAPE_MASTER_SCRIPT: CardScript = {
  oracleId: NIGHTSCAPE_MASTER.oracleId,
  name: NIGHTSCAPE_MASTER.name,
  activated: [
    {
      ref: `${NIGHTSCAPE_MASTER.oracleId}#a0`,
      text: BOUNCE,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
    {
      ref: `${NIGHTSCAPE_MASTER.oracleId}#a1`,
      text: BURN,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'card', id: target.id },
                amount: 2,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
