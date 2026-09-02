// `Savage Punch` — "Target creature you control fights target creature you
// don't control.\nFerocious — The creature you control gets +2/+2 until end
// of turn before it fights if you control a creature with power 4 or
// greater." Swift Kick's fight (D255: the two read BY CONTROLLER) with an
// ability-word rider (Radiance's rule, D270) asked at resolution BEFORE the
// pump — a creature of mine with derived power 4 or more — and the pump
// then counted into the bite as a known delta, exactly as Swift Kick's
// +1/+0 is. D280.

import { SAVAGE_PUNCH } from '../../../data/fixtures/engineCards';
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
  SAVAGE_PUNCH,
  "Target creature you control fights target creature you don't control.\nFerocious — The creature you control gets +2/+2 until end of turn before it fights if you control a creature with power 4 or greater.",
);

export const SAVAGE_PUNCH_SCRIPT: CardScript = {
  oracleId: SAVAGE_PUNCH.oracleId,
  name: SAVAGE_PUNCH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let mine: InstanceId | null = null;
      let theirs: InstanceId | null = null;
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card') continue;
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        if (card.controller === obj.controller) mine ??= target.id;
        else theirs ??= target.id;
      }
      if (mine === null) return [];
      // Ferocious, asked before the pump: any creature of mine at power 4+.
      let ferocious = false;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (d.typeLine.types.includes('Creature') && (d.power ?? 0) >= 4) {
          ferocious = true;
          break;
        }
      }
      const events: EventBody[] = [];
      const bonus = ferocious ? 2 : 0;
      if (ferocious) events.push({ t: 'PtModifiedUntilEndOfTurn', card: mine, power: 2, toughness: 2, keywords: [] });
      if (theirs === null) return events;
      const biter = ctx.derive(mine);
      const bitten = ctx.derive(theirs);
      const biterPower = (biter.power ?? 0) + bonus;
      const bittenPower = bitten.power ?? 0;
      const theirController = ctx.state.cards[theirs]?.controller;
      const damages = [];
      if (biterPower > 0) {
        damages.push({
          source: mine,
          target: { kind: 'card' as const, id: theirs },
          amount: biterPower,
          deathtouch: biter.keywords.has('deathtouch'),
          lifelinkTo: biter.keywords.has('lifelink') ? obj.controller : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: biter.keywords.has('infect') || biter.keywords.has('wither') ? ('wither' as const) : ('normal' as const),
        });
      }
      if (bittenPower > 0) {
        damages.push({
          source: theirs,
          target: { kind: 'card' as const, id: mine },
          amount: bittenPower,
          deathtouch: bitten.keywords.has('deathtouch'),
          lifelinkTo: bitten.keywords.has('lifelink') && theirController ? theirController : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: bitten.keywords.has('infect') || bitten.keywords.has('wither') ? ('wither' as const) : ('normal' as const),
        });
      }
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      return events;
    },
  },
};
