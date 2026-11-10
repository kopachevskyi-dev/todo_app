/** Capture before a layout update; call the result after React has committed it. */
export function captureLayout(container: HTMLElement) {
  const before = new Map(
    Array.from(
      container.querySelectorAll<HTMLElement>('[data-layout-id]'),
      (element) => [
        element.dataset.layoutId,
        {
          rect: element.getBoundingClientRect(),
          group: element.dataset.layoutGroup,
        },
      ],
    ),
  );
  return () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const element of container.querySelectorAll<HTMLElement>(
      '[data-layout-id]',
    )) {
      const previous = before.get(element.dataset.layoutId);
      // A task changing groups must appear below its new heading immediately.
      if (!previous || previous.group !== element.dataset.layoutGroup) continue;
      const current = element.getBoundingClientRect();
      const x = previous.rect.left - current.left;
      const y = previous.rect.top - current.top;
      if (x || y)
        element.animate(
          [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }],
          { duration: 220, easing: 'ease-out' },
        );
    }
  };
}
