// `Anchovy & Banana Pizza` — "When this artifact enters, destroy target
// creature.\n{2}, {T}, Sacrifice this artifact: You gain 3 life." A Food
// CARD: Ravenous Chupacabra's targeted entry (D237, aimed at any creature)
// on an artifact, plus the printed Food activation — the FIRST Food card
// script; Food TOKENS keep the engine's own line. The activation's tap and
// self-sacrifice are charged at activation (D159), so the gain reads
// `obj.controller`. The trigger is not an activated ability: the Food line
// is `#a0`. D272.

import { ANCHOVY_BANANA_PIZZA } from '../../../data/fixtures/engineCards';
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
  ANCHOVY_BANANA_PIZZA,
  'When this artifact enters, destroy target creature.\n{2}, {T}, Sacrifice this artifact: You gain 3 life.',
);
const ENTRY = PRINTED.split('\n')[0] as string;
const FOOD = PRINTED.split('\n')[1] as string;

export const ANCHOVY_BANANA_PIZZA_SCRIPT: CardScript = {
  oracleId: ANCHOVY_BANANA_PIZZA.oracleId,
  name: ANCHOVY_BANANA_PIZZA.name,
  triggers: [
    {
      abilityId: 'etb-destroy',
      text: ENTRY,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTRY),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Anchovy & Banana Pizza — destroy target creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
  activated: [
    {
      ref: `${ANCHOVY_BANANA_PIZZA.oracleId}#a0`,
      text: FOOD,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me || me.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
};
