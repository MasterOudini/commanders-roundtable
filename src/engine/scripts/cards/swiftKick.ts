// `Swift Kick` — the pump-then-fight. BOTH controllers are enforced at the
// aim (probed), and the biter's power is read AFTER its own +1/+0, which
// is Ambuscade's arithmetic (D197): the pump is a known delta applied in
// this same batch, so the fight adds it rather than re-deriving.
//
// ⚠️⚠️ **THE TARGETS ARE IDENTIFIED BY CONTROLLER, NOT BY INDEX.**
// `validateTargets` runs `assignTargets`, a one-for-one MATCHING (D102) —
// it proves a legal assignment EXISTS, it does not reorder the answer. So
// a player may submit "theirs, mine" and be accepted, and `obj.targets[0]`
// is simply whatever they listed first. Reading positionally would pump
// the opponent's creature. Its own test submits the pair SWAPPED and
// asserts the right creature still grows.

import { SWIFT_KICK } from '../../../data/fixtures/engineCards';
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
  SWIFT_KICK,
  "Target creature you control gets +1/+0 until end of turn. It fights target creature you don't control.",
);

export const SWIFT_KICK_SCRIPT: CardScript = {
  oracleId: SWIFT_KICK.oracleId,
  name: SWIFT_KICK.name,
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
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: mine, power: 1, toughness: 0 },
      ];
      if (theirs === null) return events;
      const biter = ctx.derive(mine);
      const bitten = ctx.derive(theirs);
      // The +1/+0 is a known delta applied in this same batch: add it.
      const biterPower = (biter.power ?? 0) + 1;
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
          applyAs:
            biter.keywords.has('infect') || biter.keywords.has('wither') ? 'wither' : 'normal',
        } as const);
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
          applyAs:
            bitten.keywords.has('infect') || bitten.keywords.has('wither') ? 'wither' : 'normal',
        } as const);
      }
      if (damages.length > 0) events.push({ t: 'DamageDealt', damages });
      return events;
    },
  },
};
