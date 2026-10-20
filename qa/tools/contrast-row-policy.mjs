// 471-R revision 2: row classification, not an allowlist or a global threshold.
export function classifyContrastRow({ control = null, large = false, decorativeReason = null } = {}) {
  if (decorativeReason) return { category: "decorative", threshold: null, criterion: null, reason: decorativeReason };
  const ui = ["icon-currentColor", "icon-text", "custom-checkbox", "custom-radio", "input-border"].includes(control);
  return ui
    ? { category: "ui", threshold: 3, criterion: "WCAG 1.4.11" }
    : { category: "text", threshold: large ? 3 : 4.5, criterion: "WCAG 1.4.3" };
}
