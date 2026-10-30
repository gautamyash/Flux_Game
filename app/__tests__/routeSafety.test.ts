import { Route } from '../src/nav/Nav';
import { stackHasActiveGame } from '../src/nav/routeSafety';

describe('navigation update safety', () => {
  it('keeps updates deferred when a screen is pushed above an active game', () => {
    const stack: { r: Route }[] = [
      { r: { name: 'home' } },
      { r: { name: 'game', source: { kind: 'chaos' }, runId: 'run-12345678' } },
      { r: { name: 'settings' } },
    ];

    expect(stackHasActiveGame(stack)).toBe(true);
  });

  it('allows the update manager to reach a safe route after all game screens are removed', () => {
    const stack: { r: Route }[] = [{ r: { name: 'home' } }, { r: { name: 'modes' } }];

    expect(stackHasActiveGame(stack)).toBe(false);
  });
});
