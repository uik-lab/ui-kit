Data-driven UI blocks kit: `UIK.render(element, spec, { send: handler })` draws the blocks described in `spec`, whose data carry every text, format and color; buttons pass their text to `handler` (shown in the panel when there is none).
Load `ui.js` with a script tag (it adds `ui.css` from the same folder), or queue before it loads: `(window.UIKQ = window.UIKQ || []).push([element, spec, { send: handler }])`.
Pinned versions only: always load an exact version; a published version never changes.
