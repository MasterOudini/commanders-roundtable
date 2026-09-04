// `Curious Farm Animals` - "When this creature dies, you gain 3 life" (a
// looks-back trigger) and "{2}, Sacrifice this creature: Destroy up to one
// target artifact or enchantment" (D299's count over D297's list).

import { CURIOUS_FARM_ANIMALS } from '../../../data/fixtures/engineCards';
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
  CURIOUS_FARM_ANIMALS,
  'When this creature dies, you gain 3 life.\n{2}, Sacrifice this creature: Destroy up to one target artifact or enchantment.',
);
const LINES = PRINTED.split('\n');

export const CURIOUS_FARM_ANIMALS_SCRIPT: CardScript = {
  oracleId: CURIOUS_FARM_ANIMALS.oracleId,
  name: CURIOUS_FARM_ANIMALS.name,
  triggers: [
    {
      abilityId: 'dies',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Curious Farm Animals - you gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: me.life + 3 }];
      },
    },
  ],
  activated: [
    {
      ref: `${CURIOUS_FARM_ANIMALS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick ("up to one" may be declared with none).
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          // CR 701.7b - an indestructible permanent is not destroyed.
          if (ctx.derive(target.id).keywords.has('indestructible')) continue;
          out.push({ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'graveyard', player: card.owner } }] });
        }
        return out;
      },
    },
  ],
};
