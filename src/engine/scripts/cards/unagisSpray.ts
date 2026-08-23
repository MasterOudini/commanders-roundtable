// `Unagi's Spray` — -4/-0 plus a draw gated on a SIX-SUBTYPE census. The
// census is over MY battlefield only, and any one of the six is enough.
// D263.

import { UNAGI_S_SPRAY } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  UNAGI_S_SPRAY,
  'Target creature gets -4/-0 until end of turn. If you control a Fish, Octopus, Otter, Seal, Serpent, or Whale, draw a card.',
);

const KINDRED = ['Fish', 'Octopus', 'Otter', 'Seal', 'Serpent', 'Whale'];

export const UNAGIS_SPRAY_SCRIPT: CardScript = {
  oracleId: UNAGI_S_SPRAY.oracleId,
  name: UNAGI_S_SPRAY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const target = obj.targets[0];
      if (target && target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind === 'battlefield') {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -4, toughness: 0 });
      }

      let kin = false;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        const subs = ctx.derive(id).typeLine.subtypes;
        if (KINDRED.some((k) => subs.includes(k))) {
          kin = true;
          break;
        }
      }
      if (kin) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
