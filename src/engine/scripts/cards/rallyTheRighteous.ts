// `Rally the Righteous` — "Radiance — Untap target creature and each
// other creature that shares a color with it. Those creatures get +2/+0
// until end of turn." Brightflame's radiance set, spent on untaps and a
// pump. D237.

import { RALLY_THE_RIGHTEOUS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  RALLY_THE_RIGHTEOUS,
  'Radiance — Untap target creature and each other creature that shares a color with it. Those creatures get +2/+0 until end of turn.',
);

export const RALLY_THE_RIGHTEOUS_SCRIPT: CardScript = {
  oracleId: RALLY_THE_RIGHTEOUS.oracleId,
  name: RALLY_THE_RIGHTEOUS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const shared = new Set(ctx.derive(target.id).colors);
      const hit = [target.id];
      for (const id of ctx.state.zones.battlefield) {
        if (id === target.id) continue;
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.colors.some((c) => shared.has(c))) continue;
        hit.push(id);
      }
      const untap: InstanceId[] = hit.filter((id) => ctx.state.cards[id]?.tapped === true);
      const events: EventBody[] = [];
      if (untap.length > 0) events.push({ t: 'PermanentsUntapped', cards: untap });
      for (const id of hit) {
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: 2, toughness: 0 });
      }
      return events;
    },
  },
};
