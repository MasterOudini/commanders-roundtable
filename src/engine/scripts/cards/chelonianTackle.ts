// `Chelonian Tackle` — my creature gets +0/+10 until cleanup, then fights
// up to one creature an opponent controls (Savage Punch's fight, the
// targets told apart by controller, D288).

import { CHELONIAN_TACKLE } from '../../../data/fixtures/engineCards';
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
  CHELONIAN_TACKLE,
  'Target creature you control gets +0/+10 until end of turn. Then it fights up to one target creature an opponent controls. (Each deals damage equal to its power to the other.)',
);

export const CHELONIAN_TACKLE_SCRIPT: CardScript = {
  oracleId: CHELONIAN_TACKLE.oracleId,
  name: CHELONIAN_TACKLE.name,
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
      const events: EventBody[] = [{ t: 'PtModifiedUntilEndOfTurn', card: mine, power: 0, toughness: 10, keywords: [] }];
      if (theirs === null) return events;
      const biter = ctx.derive(mine);
      const bitten = ctx.derive(theirs);
      const biterPower = biter.power ?? 0;
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
