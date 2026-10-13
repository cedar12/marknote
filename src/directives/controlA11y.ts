import type { Directive } from 'vue';

export interface ControlAccessibility {
  label: string;
  id?: string;
  describedBy?: string;
  invalid?: boolean;
}

function describeControl(element: HTMLElement, value: ControlAccessibility) {
  // Element Plus 2.3 sometimes leaves fallthrough ARIA on a non-interactive
  // wrapper. Target the authored control rather than requiring each settings
  // panel to reimplement the same workaround.
  const control = element.matches('[role="switch"], [role="combobox"], [role="button"]') ? element
    : element.querySelector<HTMLElement>('[role="switch"], [role="combobox"], input, select, textarea, [role="button"], button') || element;
  control.setAttribute('aria-label', value.label);
  if (value.id) control.id = value.id;
  if (value.describedBy) control.setAttribute('aria-describedby', value.describedBy);
  else control.removeAttribute('aria-describedby');
  if (value.invalid !== undefined) control.setAttribute('aria-invalid', String(value.invalid));
}

export const vControlA11y: Directive<HTMLElement, ControlAccessibility> = {
  mounted: (element, binding) => describeControl(element, binding.value),
  updated: (element, binding) => describeControl(element, binding.value),
};
