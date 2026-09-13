// `Fire Nation Sentinels` - a aCreatureDies trigger massCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRE_NATION_SENTINELS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRE_NATION_SENTINELS, "Whenever a nontoken creature an opponent controls dies, put a +1/+1 counter on each creature you control.");

export const FIRE_NATION_SENTINELS_SCRIPT: CardScript = {
  oracleId: FIRE_NATION_SENTINELS.oracleId,
  name: FIRE_NATION_SENTINELS.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Fire Nation Sentinels - a counter on each creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const changes: { card: InstanceId; kind: string; delta: number }[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          changes.push({ card: inst.id, kind: "+1/+1", delta: 1 });
        }
        return changes.length ? [{ t: 'CountersChanged', changes }] : [];
      },
    },
  ],
};
