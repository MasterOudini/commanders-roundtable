// `Unholy Hunger` — the target creature is destroyed; Spell mastery counts
// the instants and sorceries in my graveyard by cast face (Ravaging Blaze's
// rule, D279) and pays 2 life at two or more.

import { UNHOLY_HUNGER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  UNHOLY_HUNGER,
  'Destroy target creature.\nSpell mastery — If there are two or more instant and/or sorcery cards in your graveyard, you gain 2 life.',
);

export const UNHOLY_HUNGER_SCRIPT: CardScript = {
  oracleId: UNHOLY_HUNGER.oracleId,
  name: UNHOLY_HUNGER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
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
      let spells = 0;
      for (const id of ctx.state.zones.graveyard[obj.controller] ?? []) {
        const inst = ctx.state.cards[id];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) continue;
        const types = faceOf(oc, 0).typeLine.types;
        if (types.includes('Instant') || types.includes('Sorcery')) spells += 1;
      }
      const me = ctx.state.players[obj.controller];
      if (spells >= 2 && me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
      }
      return events;
    },
  },
};
