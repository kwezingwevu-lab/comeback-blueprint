// Accessibility guard shared by qa/sweep.js and qa/qa_full.js (section AD-S3).
// guard(rootSelector) is evaluated INSIDE the page (Puppeteer serialises the function source), so it must stay self-contained.
// It returns a list of one-line problems; an empty list means:
//   - every visible button, [role=button], [role=link], input (not hidden), select, textarea and a[href] has an accessible name
//     (aria-label, aria-labelledby, an associated label, title or text; a placeholder does not count);
//   - every [role=button] / [role=link] that is not natively focusable carries a tabindex;
//   - every aria-expanded / aria-pressed holds the literal "true" or "false".
// Invisible things (display:none, visibility:hidden, hidden or inert ancestors) are ignored, exactly as a screen reader ignores them.
module.exports = function guard(rootSelector) {
  const root = document.querySelector(rootSelector) || document.body;
  const out = [];
  const vis = (e) => {
    if (e.closest('[hidden],[inert]')) return false;
    if (!e.getClientRects().length) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const desc = (e) => {
    let s = e.tagName.toLowerCase();
    if (e.id) s += '#' + e.id;
    const c = String(e.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (c.length) s += '.' + c.join('.');
    const d = [...e.attributes].find((a) => /^data-/.test(a.name));
    if (d) s += '[' + d.name + ']';
    if (e.type && /^(input)$/i.test(e.tagName)) s += '(' + e.type + ')';
    return s;
  };
  const has = (s) => !!(s && String(s).replace(/\s+/g, ' ').trim());
  const named = (e) => {
    if (has(e.getAttribute('aria-label'))) return true;
    const lb = e.getAttribute('aria-labelledby');
    if (lb && lb.split(/\s+/).some((id) => { const n = document.getElementById(id); return n && has(n.textContent); })) return true;
    if (e.labels && [...e.labels].some((l) => has(l.textContent))) return true;
    if (has(e.getAttribute('title'))) return true;
    const tag = e.tagName;
    if (tag === 'INPUT' && /^(button|submit|reset)$/i.test(e.type) && has(e.value)) return true;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return false; // a placeholder or a value is not a name
    if (has(e.textContent)) return true;
    if ([...e.querySelectorAll('[aria-label],img[alt]')].some((n) => has(n.getAttribute('aria-label') || n.getAttribute('alt')))) return true;
    return false;
  };
  const focusable = (e) => /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(e.tagName) || e.hasAttribute('tabindex');
  root.querySelectorAll('button,[role=button],[role=link],input:not([type=hidden]),select,textarea,a[href]').forEach((e) => {
    if (!vis(e)) return;
    if (!named(e)) out.push('no accessible name: ' + desc(e));
    if (/^(button|link)$/.test(e.getAttribute('role') || '') && !focusable(e)) out.push('not keyboard focusable: ' + desc(e));
  });
  root.querySelectorAll('[aria-expanded],[aria-pressed]').forEach((e) => {
    ['aria-expanded', 'aria-pressed'].forEach((a) => {
      if (e.hasAttribute(a) && !/^(true|false)$/.test(e.getAttribute(a))) out.push(a + ' is not a boolean (' + e.getAttribute(a) + '): ' + desc(e));
    });
  });
  return out;
};
