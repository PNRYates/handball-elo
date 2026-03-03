export interface PopoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PopoverViewport {
  width: number;
  height: number;
}

export interface PopoverPosition {
  left: number;
  top: number;
  placement: 'top' | 'bottom';
}

export function computePopoverPosition(
  anchor: PopoverRect,
  popover: { width: number; height: number },
  viewport: PopoverViewport,
  padding = 12,
  gap = 8
): PopoverPosition {
  const clampedLeft = Math.min(
    Math.max(padding, anchor.left + anchor.width / 2 - popover.width / 2),
    viewport.width - popover.width - padding
  );

  const bottomTop = anchor.top + anchor.height + gap;
  const topTop = anchor.top - popover.height - gap;

  const fitsBottom = bottomTop + popover.height <= viewport.height - padding;
  const fitsTop = topTop >= padding;

  if (fitsBottom || !fitsTop) {
    return {
      left: clampedLeft,
      top: Math.min(bottomTop, viewport.height - popover.height - padding),
      placement: 'bottom',
    };
  }

  return {
    left: clampedLeft,
    top: Math.max(padding, topTop),
    placement: 'top',
  };
}
