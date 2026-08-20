// `Alpha Brawl` — "Target creature an opponent controls deals damage equal
// to its power to each other creature that player controls, then each of
// those creatures deals damage equal to its power to that creature." The
// melee: two DamageDealt events in printed order, all amounts and riders
// from the PRE-resolution derivations — correct because damage MARKS and
// nothing dies until the state-based sweep after resolution (CR 510.2's
// logic at instant speed), so both waves land before any body drops. D197.

import { ALPHA_BRAWL } from '../../../data/fixtures/engineCards';
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
  ALPHA_BRAWL,
  'Target creature an opponent controls deals damage equal to its power to each other creature that player controls, then each of those creatures deals damage equal to its power to that creature.',
);

export const ALPHA_BRAWL_SCRIPT: CardScript = {
  oracleId: ALPHA_BRAWL.oracleId,
  name: ALPHA_BRAWL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const brawler = ctx.state.cards[target.id];
      if (brawler?.zone.kind !== 'battlefield') return [];
      const db = ctx.derive(target.id);
      const others: string[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (id === target.id) continue;
        const card = ctx.state.cards[id];
        if (!card || card.controller !== brawler.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        others.push(id);
      }
      if (others.length === 0) return [];
      const entry = (sourceId: string, targetId: string, amount: number, d: ReturnType<typeof ctx.derive>, controller: string) => ({
        source: sourceId as never,
        target: { kind: 'card' as const, id: targetId as never },
        amount,
        deathtouch: d.keywords.has('deathtouch'),
        lifelinkTo: d.keywords.has('lifelink') ? (controller as never) : null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: d.toxicAmount,
        applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? ('wither' as const) : ('normal' as const),
      });
      const events: EventBody[] = [];
      const outPower = db.power ?? 0;
      if (outPower > 0) {
        events.push({
          t: 'DamageDealt',
          damages: others.map((id) => entry(target.id, id, outPower, db, brawler.controller)),
        });
      }
      const back = others
        .map((id) => ({ id, d: ctx.derive(id) }))
        .filter((x) => (x.d.power ?? 0) > 0)
        .map((x) => entry(x.id, target.id, x.d.power ?? 0, x.d, brawler.controller));
      if (back.length > 0) events.push({ t: 'DamageDealt', damages: back });
      return events;
    },
  },
};
