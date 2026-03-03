import test from 'node:test';
import assert from 'node:assert/strict';
import { computePopoverPosition } from '../src/lib/popover.ts';

test('computePopoverPosition clamps left inside viewport', () => {
  const position = computePopoverPosition(
    { left: 4, top: 120, width: 20, height: 20 },
    { width: 260, height: 80 },
    { width: 320, height: 640 }
  );

  assert.equal(position.left >= 12, true);
});

test('computePopoverPosition flips to top when bottom does not fit', () => {
  const position = computePopoverPosition(
    { left: 100, top: 620, width: 40, height: 24 },
    { width: 260, height: 120 },
    { width: 800, height: 700 }
  );

  assert.equal(position.placement, 'top');
  assert.equal(position.top >= 12, true);
});

test('computePopoverPosition prefers bottom placement when there is room', () => {
  const position = computePopoverPosition(
    { left: 200, top: 200, width: 40, height: 24 },
    { width: 240, height: 100 },
    { width: 1200, height: 900 }
  );

  assert.equal(position.placement, 'bottom');
});
