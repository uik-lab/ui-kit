(function (w, d) {
  'use strict';

  var VERSION = '1.0.2';
  var SRC = (d.currentScript && d.currentScript.src) || '';
  var RE_JS = /ui(\.min)?\.js(\?.*)?$/;
  var HAS = Object.prototype.hasOwnProperty;
  var TONES = { ok: 1, warning: 1, danger: 1, muted: 1 };
  var TOKENS = { text: 'text', text2: 'text2', bg: 'bg', bg2: 'bg2', bg3: 'bg3', line: 'line', line2: 'line2', danger: 'danger', dangerBg: 'danger-bg',
    success: 'success', successBg: 'success-bg', warn: 'warn', warnText: 'warn-text', accent: 'accent', primary: 'primary', primaryText: 'primary-text' };
  var TAS = [];

  var cssReady = new Promise(function (res) {
    var has = [].some.call(d.querySelectorAll('link[rel="stylesheet"]'), function (l) {
      return /(^|\/)ui(\.min)?\.css(\?|#|$)/.test(l.getAttribute('href') || '');
    });
    if (has || !RE_JS.test(SRC)) { res(); return; }
    var l = d.createElement('link');
    l.rel = 'stylesheet';
    l.href = SRC.replace(RE_JS, 'ui$1.css');
    l.onload = l.onerror = function () { res(); };
    d.head.appendChild(l);
    setTimeout(res, 2000);
  });

  function s(v) { return v == null ? '' : String(v); }
  function norm(t) { return s(t).replace(/\s+/g, ' ').trim(); }
  function paras(t) { return s(t).split(/\n\s*\n/).map(norm).filter(Boolean); }
  function rx(list) {
    return [].concat(list == null ? [] : list).map(function (p) {
      var src = Array.isArray(p) ? p[0] : p, flags = Array.isArray(p) ? s(p[1]) : '';
      try { return new RegExp(s(src), flags.indexOf('g') < 0 ? flags + 'g' : flags); } catch (e) { return null; }
    }).filter(Boolean);
  }
  function clean(l, rs) {
    var t = s(l);
    (rs || []).forEach(function (r) { t = t.replace(r, ''); });
    return t;
  }
  function noteText(lines, comment, prefix, rs) {
    var c = norm(comment);
    return (lines || []).map(function (l) { return clean(l, rs); }).join('\n') + (c ? s(prefix) + c : '');
  }
  function str(v) {
    if (Array.isArray(v)) return v.map(str).join(', ');
    if (v && typeof v === 'object') {
      if (HAS.call(v, 'v')) return s(v.v);
      return Object.keys(v).filter(function (k) { return k !== 'on'; }).map(function (k) { return s(v[k]); }).join(' ');
    }
    return s(v);
  }
  function blank(v) { return Array.isArray(v) ? !v.length : s(v).trim() === ''; }
  function tone(t) { return TONES[t] ? 'uik-' + t : ''; }
  function local(v) { return function (n) { return v && HAS.call(v, n) ? v[n] : undefined; }; }

  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(iso));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function midnight() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function key(x) { return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function plus(x, n) { var y = new Date(x); y.setDate(y.getDate() + n); return y; }
  function months(x, n) { return new Date(x.getFullYear(), x.getMonth() + n, x.getDate()); }
  function span(a, b) { return Math.round((b - a) / 864e5); }
  function parts(x) {
    return { d: x.getDate(), dd: pad(x.getDate()), m: x.getMonth() + 1, mm: pad(x.getMonth() + 1), yyyy: x.getFullYear(), yy: pad(x.getFullYear() % 100) };
  }
  function fmtDate(x, L, short) {
    var f = (L && L.date) || {}, t = short ? f.short : f.long;
    return t ? fill(t, local(parts(x))) : key(x);
  }

  function closing(t, i) {
    var dep = 0;
    for (var j = i; j < t.length; j++) {
      var c = t.charAt(j);
      if (c === '{') dep++;
      else if (c === '}' && !--dep) return j;
    }
    return -1;
  }
  function pieces(t) {
    var o = [], dep = 0, cur = '';
    for (var i = 0; i < t.length; i++) {
      var c = t.charAt(i);
      if (c === '{') dep++;
      else if (c === '}') dep--;
      if (c === '|' && !dep) { o.push(cur); cur = ''; } else cur += c;
    }
    o.push(cur);
    return o;
  }
  function fill(t, get, L) {
    t = s(t);
    var o = '', i = 0;
    while (i < t.length) {
      var a = t.indexOf('{', i);
      if (a < 0) { o += t.slice(i); break; }
      o += t.slice(i, a);
      var z = closing(t, a);
      if (z < 0) { o += t.slice(a); break; }
      var r = expr(t.slice(a + 1, z), get, L);
      o += r == null ? t.slice(a, z + 1) : r;
      i = z + 1;
    }
    return o;
  }
  function look(get, n) {
    var v = get(n);
    if (v !== undefined || n.indexOf('.') < 0) return v;
    var p = n.split('.'), b = get(p[0]);
    if (b === undefined || b === null) return undefined;
    if (Array.isArray(b)) return b.map(function (x) { return x && typeof x === 'object' ? x[p[1]] : undefined; });
    return typeof b === 'object' ? b[p[1]] : undefined;
  }
  function expr(x, get, L) {
    var p = pieces(x), n = p[0];
    if (!/^[\w.]+$/.test(n)) return null;
    var v = look(get, n);
    if (v === undefined) return null;
    for (var k = 1; k < p.length; k++) v = filter(v, p[k], get, L);
    return str(v);
  }
  function each(v, fn) { return Array.isArray(v) ? v.map(fn) : fn(v); }
  function filter(v, f, get, L) {
    var c = f.indexOf(':'), n = c < 0 ? f : f.slice(0, c), a = c < 0 ? '' : f.slice(c + 1);
    if (n === 'date') return each(v, function (x) { var y = day(x); return y ? fmtDate(y, L, a === 'short') : x; });
    if (n === 'lc1') return each(v, function (x) { x = s(x); return x.charAt(0).toLowerCase() + x.slice(1); });
    if (n === 'uc1') return each(v, function (x) { x = s(x); return x.charAt(0).toUpperCase() + x.slice(1); });
    if (n === 'lc') return each(v, function (x) { return s(x).toLowerCase(); });
    if (n === 'uc') return each(v, function (x) { return s(x).toUpperCase(); });
    if (n === 'join') return Array.isArray(v) ? v.map(str).join(a) : v;
    if (n === 'or') return blank(v) ? a : v;
    if (n === 'n') return Array.isArray(v) ? v.length : s(v).length;
    if (n === 'item') {
      if (!Array.isArray(v)) return v;
      return v.map(function (x) {
        return fill(a, function (k) {
          if (x && typeof x === 'object') return HAS.call(x, k) ? x[k] : get(k);
          return k === 'v' ? x : get(k);
        }, L);
      });
    }
    return v;
  }

  function has(a, b) { return s(a).toLowerCase().indexOf(s(b).toLowerCase()) >= 0; }
  function compare(a, b) {
    var num = /^-?\d+(\.\d+)?$/;
    if (num.test(a) && num.test(b)) return parseFloat(a) - parseFloat(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function cond(c, get) {
    var v = look(get, s(c[0])), op = s(c[1]), x = s(c[2]);
    if (v == null) v = '';
    if (Array.isArray(v)) {
      var l = v.map(str), any = l.some(function (y) { return has(y, x); });
      if (op === '=') return x === '' ? !l.length : l.indexOf(x) >= 0;
      if (op === '!=') return x === '' ? l.length > 0 : l.indexOf(x) < 0;
      if (op === '~') return any;
      if (op === '!~') return !any;
      return false;
    }
    v = str(v);
    if (op === '=') return v === x;
    if (op === '!=') return v !== x;
    if (op === '~') return has(v, x);
    if (op === '!~') return !has(v, x);
    if (v === '') return false;
    var r = compare(v, x);
    if (op === '>') return r > 0;
    if (op === '<') return r < 0;
    if (op === '>=') return r >= 0;
    if (op === '<=') return r <= 0;
    return false;
  }
  function test(q, get) {
    if (!q) return true;
    if (Array.isArray(q)) {
      if (typeof q[0] === 'string') return cond(q, get);
      return q.every(function (x) { return test(x, get); });
    }
    if (q.any) return q.any.some(function (x) { return test(x, get); });
    return true;
  }

  function esc(t) { return s(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var RE_UL = /^[-\u2022\u00b7]\s+/, RE_OL = /^(\d+)[.)]\s+/, RE_END = /\p{P}$/u;
  function isTitle(l) { return l.length <= 70 && !RE_END.test(l) && !RE_UL.test(l) && !RE_OL.test(l); }
  function itemHtml(x) {
    var m = x.match(/^([^:.]{2,40}):\s+(.+)$/);
    return m ? '<strong>' + esc(m[1]) + ':</strong> ' + esc(m[2]) : esc(x);
  }
  function mailHtml(text) {
    var blocks = s(text).replace(/\r/g, '').split(/\n[ \t]*\n/).map(function (b) { return b.trim(); }).filter(Boolean);
    var out = [], list = null;
    function flush() {
      if (!list) return;
      out.push('<' + list.tag + '>' + list.items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</' + list.tag + '>');
      list = null;
    }
    blocks.forEach(function (b) {
      var ls = b.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      if (ls.every(function (x) { return RE_UL.test(x); })) {
        if (!list || list.tag !== 'ul') { flush(); list = { tag: 'ul', items: [] }; }
        ls.forEach(function (x) { list.items.push(itemHtml(x.replace(RE_UL, ''))); });
        return;
      }
      var m = ls[0].match(RE_OL);
      if (m) {
        var next = list && list.tag === 'ol' ? list.items.length + 1 : 1;
        if (+m[1] === next) {
          if (!list || list.tag !== 'ol') { flush(); list = { tag: 'ol', items: [] }; }
          var cur = null;
          ls.forEach(function (x) {
            var mm = x.match(RE_OL);
            if (mm && cur !== null && +mm[1] === list.items.length + 2) { list.items.push(cur); cur = null; }
            if (cur === null) cur = itemHtml(x.replace(RE_OL, ''));
            else cur += '<br>' + esc(x);
          });
          list.items.push(cur);
          return;
        }
      }
      flush();
      if (ls.length > 1 && isTitle(ls[0])) out.push('<p><strong>' + esc(ls[0]) + '</strong><br>' + ls.slice(1).map(esc).join('<br>') + '</p>');
      else out.push('<p>' + ls.map(esc).join('<br>') + '</p>');
    });
    flush();
    return out.join('\n');
  }

  function kept(a, b) {
    var n = a.length, m = b.length, T = [], i, j;
    for (i = 0; i <= n; i++) { T.push([]); for (j = 0; j <= m; j++) T[i].push(0); }
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) T[i][j] = a[i] === b[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    }
    var k = b.map(function () { return false; });
    i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { k[j] = true; i++; j++; }
      else if (T[i + 1][j] >= T[i][j + 1]) i++;
      else j++;
    }
    return k;
  }
  function diff(before, after, L) {
    L = L || {};
    var a = paras(before), b = paras(after), o = [];
    b.forEach(function (p) { if (a.indexOf(p) < 0) o.push(s(L.add) + p); });
    a.forEach(function (p) { if (b.indexOf(p) < 0) o.push(s(L.del) + p); });
    var at = [], bt = [];
    a.forEach(function (p) { if (b.indexOf(p) >= 0) at.push(p); });
    b.forEach(function (p, i) { if (a.indexOf(p) >= 0) bt.push(i); });
    var k = kept(at, bt.map(function (i) { return b[i]; }));
    k.forEach(function (x, i) { if (!x) o.push(fill(L.move, local({ n: bt[i] + 1 })) + b[bt[i]]); });
    return o.join('\n\n');
  }

  function h(tag, a, kids) {
    var e = d.createElement(tag);
    if (a) {
      Object.keys(a).forEach(function (k) {
        var v = a[k];
        if (v == null || v === false) return;
        if (k === 'c') e.className = v;
        else if (k === 't') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    return add(e, kids);
  }
  function add(e, kids) {
    if (kids == null) return e;
    (Array.isArray(kids) ? kids : [kids]).forEach(function (k) {
      if (k == null || k === false || k === '') return;
      e.appendChild(typeof k === 'object' ? k : d.createTextNode(String(k)));
    });
    return e;
  }
  function btn(t, fn, cls) { return h('button', { c: 'uik-btn' + (cls ? ' ' + cls : ''), type: 'button', t: s(t), onclick: fn }); }
  function vis(e) { return !!e && !e.closest('.uik-hide'); }
  function mark(t) { return t ? h('span', { c: 'uik-mk', t: t }) : null; }
  function grow(ta) {
    if (!ta.isConnected || !ta.offsetParent) return;
    ta.style.height = 'auto';
    ta.style.height = (ta.scrollHeight + ta.offsetHeight - ta.clientHeight) + 'px';
  }
  w.addEventListener('resize', function () {
    TAS = TAS.filter(function (t) { return t.isConnected; });
    TAS.forEach(grow);
  });
  function area(P, e) { P.tas.push(e); TAS.push(e); }

  function theme(r, T) {
    if (!T || typeof T !== 'object') return;
    var mq = w.matchMedia ? w.matchMedia('(prefers-color-scheme: dark)') : null;
    function put(k, v) { if (v == null || v === '') r.style.removeProperty(k); else r.style.setProperty(k, s(v)); }
    function apply() {
      var m = (mq && mq.matches && T.dark) || T.light || T.dark || {};
      Object.keys(TOKENS).forEach(function (k) { put('--uik-' + TOKENS[k], m[k]); });
      var ht = m.heatText;
      for (var i = 0; i < 4; i++) {
        put('--uik-h' + i, Array.isArray(m.heat) ? m.heat[i] : m.heat);
        put('--uik-ht' + i, Array.isArray(ht) ? ht[i] : ht);
      }
      put('--uik-font', T.font);
    }
    apply();
    if (mq && mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq && mq.addListener) mq.addListener(apply);
  }

  function panel(spec, root, opts) {
    var L = spec.labels || {};
    var P = { L: L, f: {}, fields: [], vis: [], mid: [], end: [], tas: [], root: root };
    P.sep = s(L.sep != null ? L.sep : ' ');
    P.bul = s(L.bullet);
    P.alert = s(L.alert);
    P.strip = rx(L.strip);
    P.lab = function (k, b) { return Object.assign({}, L[k], b && b.l); };
    P.get = function (n) { var f = P.f[n]; return f ? (vis(f.el) ? f.get() : f.rest) : undefined; };
    P.scope = function (x) { return function (n) { return x && HAS.call(x, n) ? x[n] : P.get(n); }; };
    P.fill = function (t, x) { return fill(t, P.scope(x), L); };
    P.test = function (q, x) { return test(q, P.scope(x)); };
    P.parts = function (l, x) {
      return [].concat(l == null ? [] : l).filter(function (o) { return typeof o === 'string' || (o && P.test(o.when, x)); })
        .map(function (o) { return P.fill(typeof o === 'string' ? o : o.t, x); });
    };
    P.tpl = function (t, x) { return P.parts(t, x).join(''); };
    P.up = function () { P.vis.concat(P.mid, P.end).forEach(function (fn) { fn(); }); };
    P.chg = function (id) {
      var v = str(P.get(id));
      P.fields.forEach(function (f) {
        var m = f.set && f.set[id];
        if (m && HAS.call(m, v)) f.put(m[v]);
      });
      P.up();
    };
    P.send = function (t) {
      api.last = t;
      if (opts && typeof opts.send === 'function') { opts.send(t); return; }
      var b = root.querySelector('.uik-sent') || root.appendChild(h('div', { c: 'uik-sent' }));
      b.textContent = (L.sent ? L.sent + '\n\n' : '') + t;
    };
    return P;
  }

  function tx(P, x) {
    if (!Array.isArray(x)) return x == null ? null : s(x);
    var e = h('span');
    P.mid.push(function () {
      var m = x.filter(function (o) { return o && P.test(o.when); })[0];
      e.textContent = m ? s(m.t) : '';
    });
    return e;
  }
  function title(P, t, sub) { return h('div', { c: 'uik-h' }, [tx(P, t), sub ? h('span', { t: P.sep + sub }) : null]); }
  function src(t) { return t ? h('span', { c: 'uik-src', t: t }) : null; }

  var B = {};
  function blk(b, P, F) {
    if (!b || typeof b !== 'object') return null;
    var fn = HAS.call(B, b.type) ? B[b.type] : null;
    var e = fn ? fn(b, P, F) : h('div', { c: 'uik-err', t: P.fill(P.L.unknown || '{type}', { type: s(b.type) }) });
    if (e && b.show) P.vis.push(function () { e.classList.toggle('uik-hide', !P.test(b.show)); });
    return e;
  }
  function blks(l, P, F) { return (l || []).map(function (b) { return blk(b, P, F); }); }

  B.head = function (b, P) {
    var bs = b.badges || [], mk = P.alert.trim();
    return h('div', { c: 'uik-card uik-head' }, [
      h('p', { c: 'uik-title', t: s(b.t) }),
      b.sub ? h('p', { c: 'uik-sub', t: b.sub }) : null,
      bs.length ? h('div', { c: 'uik-badges' }, bs.map(function (x) {
        var tn = TONES[x.tone] ? x.tone : 'muted', t = s(x.t);
        if (tn === 'danger' && mk && t.indexOf(mk) !== 0) t = P.alert + t;
        return h('span', { c: 'uik-badge uik-' + tn, t: t });
      })) : null
    ]);
  };
  B.card = function (b, P, F) { return h('div', { c: 'uik-card' }, [b.h != null ? title(P, b.h, b.sub) : null].concat(blks(b.blocks, P, F))); };
  B.h = function (b, P) { return title(P, b.t, b.sub); };
  B.p = function (b, P) { return h('p', { c: ('uik-p ' + tone(b.tone)).trim() }, tx(P, b.t)); };
  B.kv = function (b) { return h('p', { c: 'uik-p' }, [h('span', { c: 'uik-k', t: s(b.k) }), ' ' + s(b.t)]); };
  B.pill = function (b) { return h('span', { c: 'uik-pill', t: s(b.t) }); };
  B.strong = function (b) { return h('p', { c: 'uik-strong', t: s(b.t) }); };
  B.foot = function (b, P) { return h('p', { c: 'uik-foot' }, tx(P, b.t)); };
  B.ul = function (b) { return h('ul', { c: 'uik-ul' }, (b.items || []).map(function (x) { return h('li', { t: s(x) }); })); };
  B.facts = function (b) {
    return h('div', { c: 'uik-facts' }, (b.items || []).map(function (x) { return h('div', null, [h('span', { t: s(x[0]) }), h('b', { t: s(x[1]) })]); }));
  };
  B.row = function (b, P, F) {
    return h('div', { c: 'uik-grid' }, (b.blocks || []).map(function (x) {
      var e = blk(x, P, F);
      if (e) e.style.flex = (+(x && x.w) || 1) + ' 1 0';
      return e;
    }));
  };
  B.fold = function (b, P) {
    var L = P.lab('fold', b), it = b.items || [], ln = b.line, ls = b.less != null ? b.less : L.less;
    return h('details', { c: 'uik-fold' + (ls ? ' uik-two' : ''), open: !!b.open }, [
      h('summary', null, [
        title(P, b.h),
        h('span', { c: 'uik-more', t: P.fill(b.more != null ? b.more : L.more, { n: it.length }) }),
        ls ? h('span', { c: 'uik-more uik-less', t: P.fill(ls, { n: it.length }) }) : null,
        ln ? h('span', { c: 'uik-line' }, [ln.k ? h('b', { t: s(ln.k) }) : null, (ln.k ? ' ' : '') + s(ln.t)]) : null
      ]),
      h('div', { c: 'uik-items' }, it.map(function (x) {
        return h('div', { c: 'uik-item' + (x.warn ? ' uik-warning' : '') }, [h('b', { t: s(x.d) }), h('span', null, [s(x.t), src(x.src)])]);
      }))
    ]);
  };
  B.rows = function (b, P) {
    var it = b.items || [], three = it.some(function (x) { return x.s != null; });
    return h('div', { c: 'uik-rows' + (three ? ' uik-r3' : '') }, it.map(function (x) {
      return h('div', { c: 'uik-row' }, [
        h('div', { c: ('uik-rk ' + tone(x.ktone)).trim(), t: s(x.k) }),
        three ? h('div', { c: ('uik-rs ' + tone(x.stone)).trim(), t: s(x.s) }) : null,
        h('div', { c: 'uik-rt' }, [s(x.t), src(x.src)]),
        x.btn ? btn(x.btn.t, function () { P.send(P.tpl(x.btn.send)); }) : null
      ]);
    }));
  };
  B.sec = function (b, P) {
    return h('div', { c: 'uik-sec' }, [
      b.h ? h('p', { c: 'uik-st' }, [s(b.h), b.sub ? h('span', { t: P.sep + b.sub }) : null]) : null,
      b.t || b.src ? h('p', { c: 'uik-sx' }, [s(b.t), src(b.src)]) : null,
      b.rows ? B.rows({ items: b.rows }, P) : null
    ]);
  };
  B.table = function (b) {
    var rows = (b.rows || []).map(function (r) {
      return h('tr', null, r.map(function (c) {
        if (c && typeof c === 'object') return h('td', { c: tone(c.tone) || null }, [c.b ? h('b', { t: s(c.b) }) : null, s(c.t)]);
        return h('td', { t: s(c) });
      }));
    });
    return h('table', { c: 'uik-table' }, [b.head ? h('tr', null, b.head.map(function (x) { return h('th', { t: s(x) }); })) : null].concat(rows));
  };
  B.box = function (b, P, F) {
    return h('div', { c: 'uik-box ' + (tone(b.tone) || 'uik-danger') }, [
      b.title ? h('p', { c: 'uik-bt', t: s(b.title) }) : null,
      b.b || b.t ? h('p', { c: 'uik-bp' }, [b.b ? h('b', { t: s(b.b) }) : null, b.b && b.t ? ' ' : null, s(b.t)]) : null
    ].concat(blks(b.blocks, P, F)));
  };

  B.note = function (b, P, F) {
    var L = P.lab('note', b), pre = h('pre', { c: 'uik-note' });
    var cm = b.comment === false ? null : h('input', { c: 'uik-in', type: 'text', maxlength: L.max != null ? s(L.max) : null, placeholder: L.ph || null });
    function text() { return noteText(P.parts(b.lines), cm ? cm.value : '', L.prefix, P.strip); }
    function upd() { pre.textContent = text(); }
    if (cm) cm.addEventListener('input', upd);
    var bt = b.btn ? btn(b.btn.t || L.btn, function () { if (!bt.disabled) P.send(P.tpl(b.btn.send, { note: text() })); }, 'uik-main') : null;
    if (bt && b.disabled) bt.disabled = true;
    if (F) F.notes.push(text);
    P.mid.push(upd);
    var lock = b.lock === false ? null : b.lock || L.lock;
    return h('div', { c: 'uik-notes' }, blks(b.blocks, P, F).concat([
      pre, src(b.src),
      cm && L.comment ? h('label', { c: 'uik-l', t: L.comment }) : null, cm,
      lock ? h('p', { c: 'uik-lock', t: lock }) : null,
      b.disabled ? h('p', { c: 'uik-err', t: s(b.disabled) }) : null,
      bt
    ]));
  };

  B.mail = function (b, P) {
    var L = P.lab('mail', b), P0 = s(b.body);
    var to = h('input', { c: 'uik-in', type: 'text' }), sj = h('input', { c: 'uik-in', type: 'text' }), ta = h('textarea', { c: 'uik-in', rows: '3' });
    to.value = s(b.to); sj.value = s(b.subject); ta.value = P0;
    var ed = h('p', { c: 'uik-edited uik-hide', t: L.edited });
    var pv = h('div', { c: 'uik-html' });
    function vals(x) { return Object.assign({ to: to.value, subject: sj.value, body: ta.value }, x); }
    var br = b.review ? btn(L.review, function () {
      var df = diff(P0, ta.value, L);
      if (df) P.send(P.tpl(b.review, vals({ changes: df })));
    }, 'uik-hide') : null;
    var bs = b.send ? btn(L.send, function () { P.send(P.tpl(b.send, vals())); }, 'uik-main') : null;
    var bBack = btn(L.back, function () { ta.value = P0; chg(); }, 'uik-link uik-hide');
    function chg() {
      var c = norm(ta.value) !== norm(P0);
      [br, bBack, ed].forEach(function (x) { if (x) x.classList.toggle('uik-hide', !c); });
      pv.innerHTML = mailHtml(ta.value);
      grow(ta);
    }
    ta.addEventListener('input', chg);
    area(P, ta);
    pv.innerHTML = mailHtml(P0);
    var dup = b.dup;
    return h('div', { c: 'uik-mail' }, [
      dup ? h('p', { c: ('uik-warn ' + tone(dup.tone)).trim(), t: s(L.dup) + s(dup.t) }) : null,
      h('label', { c: 'uik-l', t: L.to }), to,
      h('label', { c: 'uik-l', t: L.subject }), sj,
      h('label', { c: 'uik-l', t: L.body }), ta, ed,
      h('div', null, (b.warns || []).map(function (x) { return h('p', { c: 'uik-warn' }, [mark(P.bul), s(x)]); })),
      h('details', { c: 'uik-prev' }, [h('summary', { t: L.preview }), pv]),
      br, bs, bBack
    ]);
  };

  B.decide = function (b, P, F) {
    var dr = b.drafts || [], cur = Math.min(+b.pick || 0, Math.max(dr.length - 1, 0));
    var ta = h('textarea', { c: 'uik-in', rows: '4' }), er = h('p', { c: 'uik-err uik-hide' });
    ta.value = s((dr[cur] || {}).t);
    var sw = dr.length > 1 ? btn('', function () {
      cur = (cur + 1) % dr.length;
      ta.value = s(dr[cur].t);
      label();
      er.classList.add('uik-hide');
      grow(ta);
    }, 'uik-link') : null;
    function label() { if (sw) sw.textContent = s(dr[(cur + 1) % dr.length].swap); }
    label();
    ta.addEventListener('input', function () { er.classList.add('uik-hide'); grow(ta); });
    area(P, ta);
    function fail(t) { er.textContent = s(t); er.classList.remove('uik-hide'); }
    var acts = (b.actions || []).map(function (a) {
      return btn(a.t, function () {
        var c = ta.value.trim(), no = a.deny != null ? dr[a.deny] : null;
        if (a.need && !c) { fail(a.need); return; }
        if (no && norm(c) === norm(no.t)) { fail(a.denied); return; }
        P.send(P.tpl(!c && a.empty != null ? a.empty : a.send, { text: c }));
      }, 'uik-main');
    });
    return h('div', { c: 'uik-decide' }, [ta, sw, er].concat(blks(b.blocks, P, F), [b.lock ? h('p', { c: 'uik-lock', t: s(b.lock) }) : null], acts));
  };

  function opt(o) {
    if (o && typeof o === 'object') return { v: s(o.v != null ? o.v : o.t), t: s(o.t != null ? o.t : o.v), h: o.h, on: !!o.on };
    return { v: s(o), t: s(o) };
  }
  function watch(e, P, id) {
    if (!id) return;
    ['input', 'change'].forEach(function (k) { e.addEventListener(k, function () { P.chg(id); }); });
  }
  function field(b, P, F, ctl, io) {
    var L = P.lab('form'), mk = b.req && L.req && b.mark !== false ? h('b', { t: P.sep + L.req }) : null;
    var er = b.req ? h('div', { c: 'uik-err uik-hide', t: s(b.req) }) : null;
    var hd = b.h != null ? h('div', { c: 'uik-h' }, [tx(P, b.h), mk])
      : b.label != null ? h('label', { c: 'uik-l' }, [tx(P, b.label), mk, b.help ? P.sep + b.help : null]) : null;
    var e = h('div', { c: 'uik-f', 'data-f': b.id || null }, [hd].concat(ctl, [er]));
    if (b.id) {
      var v0 = io.get(), f = { id: b.id, el: e, req: !!b.req, get: io.get, put: io.put || function () {}, set: b.set, orig: b.orig != null ? s(b.orig) : str(v0), rest: b.orig != null ? s(b.orig) : v0 };
      P.f[b.id] = f;
      P.fields.push(f);
      if (F) F.fields.push(f);
      if (er) {
        P.end.push(function () {
          var bad = vis(e) && blank(f.get());
          er.classList.toggle('uik-hide', !bad);
          if (io.mark) io.mark.classList.toggle('uik-bad', bad);
        });
      }
    }
    return e;
  }
  B.ro = function (b, P, F) {
    var v = s(b.value != null ? b.value : b.t);
    return field(b, P, F, [h('div', { c: 'uik-ro', t: s(b.t != null ? b.t : b.value) })], { get: function () { return v; } });
  };
  B.select = function (b, P, F) {
    var L = P.lab('form'), e = h('select', { c: 'uik-in' });
    if (b.empty) e.appendChild(h('option', { value: '', t: typeof b.empty === 'string' ? b.empty : s(L.choose) }));
    (b.options || []).map(opt).forEach(function (o) { e.appendChild(h('option', { value: o.v, t: o.t })); });
    if (b.value != null) e.value = s(b.value);
    watch(e, P, b.id);
    return field(b, P, F, [e], { get: function () { return e.value; }, put: function (v) { e.value = s(v); }, mark: e });
  };
  B.date = function (b, P, F) {
    var e = h('input', { c: 'uik-in', type: 'date', min: b.min || null, max: b.max || null });
    e.value = s(b.value);
    watch(e, P, b.id);
    return field(b, P, F, [e], { get: function () { return e.value; }, put: function (v) { e.value = s(v); }, mark: e });
  };
  B.text = function (b, P, F) {
    var e = h('input', { c: 'uik-in', type: 'text', maxlength: b.max ? s(b.max) : null, placeholder: b.ph || null });
    function up(v) { return b.upper ? s(v).toUpperCase() : s(v); }
    e.value = up(b.value);
    if (b.upper) {
      e.addEventListener('input', function () {
        var u = up(e.value);
        if (u === e.value) return;
        var p = e.selectionStart, q = e.selectionEnd;
        e.value = u;
        e.setSelectionRange(p, q);
      });
    }
    watch(e, P, b.id);
    return field(b, P, F, [e], { get: function () { return e.value.trim(); }, put: function (v) { e.value = up(v); }, mark: e });
  };
  B.textarea = function (b, P, F) {
    var L = P.lab('form'), e = h('textarea', { c: 'uik-in', rows: s(b.rows || 2), maxlength: b.max ? s(b.max) : null, placeholder: b.ph || null });
    e.value = s(b.value);
    var ct = b.count === false ? null : b.count || L.count, cn = ct ? h('span') : null;
    var hint = b.hint || cn ? h('div', { c: 'uik-hint' }, [h('span', { t: s(b.hint) }), cn]) : null;
    function u() { if (cn) cn.textContent = P.fill(ct, { n: e.value.length }); grow(e); }
    e.addEventListener('input', u);
    watch(e, P, b.id);
    P.mid.push(u);
    area(P, e);
    return field(b, P, F, [e, hint], { get: function () { return e.value.trim(); }, put: function (v) { e.value = s(v); u(); }, mark: e });
  };
  B.opts = function (b, P, F) {
    var v = s(b.value), box = h('div', { c: 'uik-opts' });
    var bs = (b.options || []).map(opt).map(function (o) {
      return h('button', { c: 'uik-opt', type: 'button', 'data-v': o.v, 'aria-pressed': 'false', onclick: function () { put(o.v); if (b.id) P.chg(b.id); } },
        [h('b', { t: o.t }), o.h ? h('span', { t: s(o.h) }) : null]);
    });
    function put(x) {
      v = s(x);
      bs.forEach(function (e) { e.setAttribute('aria-pressed', String(e.getAttribute('data-v') === v)); });
    }
    add(box, bs);
    put(v);
    return field(b, P, F, [box], { get: function () { return v; }, put: put });
  };
  B.checks = function (b, P, F) {
    var it = (b.options || []).map(opt).map(function (o) {
      var cb = h('input', { type: 'checkbox', value: o.v });
      cb.checked = o.on;
      cb.addEventListener('change', function () { if (b.id) P.chg(b.id); });
      return { o: o, cb: cb, el: h('label', null, [cb, ' ' + o.t]) };
    });
    return field(b, P, F, [h('div', { c: 'uik-chk' }, it.map(function (x) { return x.el; }))], {
      get: function () { return it.filter(function (x) { return x.cb.checked; }).map(function (x) { return x.o.v; }); },
      put: function (v) { v = [].concat(v).map(s); it.forEach(function (x) { x.cb.checked = v.indexOf(x.o.v) >= 0; }); }
    });
  };
  B.pick = function (b, P, F) {
    var cols = b.cols || [];
    var rows = (b.rows || []).map(function (r) {
      var cb = h('input', { type: 'checkbox' });
      cb.checked = r.on !== false;
      cb.addEventListener('change', function () { if (b.id) P.chg(b.id); });
      return { r: r, cb: cb };
    });
    var t = h('table', { c: 'uik-table' }, [h('tr', null, [h('th', { t: s(b.check) })].concat(cols.map(function (c) { return h('th', { t: s(c.t) }); })))]
      .concat(rows.map(function (x) { return h('tr', null, [h('td', null, x.cb)].concat(cols.map(function (c) { return h('td', { t: s(x.r[c.k]) }); }))); })));
    return field(b, P, F, [t], {
      get: function () {
        return rows.filter(function (x) { return x.cb.checked; }).map(function (x) {
          var o = {};
          Object.keys(x.r).forEach(function (k) { if (k !== 'on') o[k] = x.r[k]; });
          return o;
        });
      }
    });
  };

  B.cal = function (b, P, F) {
    var L = P.lab('cal', b), DS = L.days || [], MS = L.months || [];
    var ws = +L.weekStart || 0, wd = (Array.isArray(L.workdays) ? L.workdays : []).map(Number).filter(function (x) { return x >= 0 && x < 7; });
    if (!wd.length) wd = [0, 1, 2, 3, 4, 5, 6];
    var t0 = day(b.today) || midnight(), hol = b.holidays || [], sel = day(b.value) || t0, end = months(t0, 12);
    var lim = b.limit && day(b.limit.d) ? { d: day(b.limit.d), t: s(b.limit.t) } : null;
    var prop = day(b.proposal), cur = day(b.current);
    var kSel = h('b'), kDays = h('b'), kWork = h('span'), kLoad = h('b'), kMargin = h('b'), adj = h('p', { c: 'uik-warn' });
    function first(x) { return plus(x, -((x.getDay() - ws + 7) % 7)); }
    function shown(x) { return wd.indexOf(x.getDay()) >= 0; }
    function work(x) { return shown(x) && hol.indexOf(key(x)) < 0; }
    function count(a, z) { var n = 0, x = plus(a, 1); while (x <= z) { if (work(x)) n++; x = plus(x, 1); } return n; }
    function ctx(x, more) {
      return Object.assign(parts(x), { wd: s(DS[x.getDay()]), mon: s(MS[x.getMonth()]), date: fmtDate(x, P.L), short: fmtDate(x, P.L, true) }, more);
    }
    function txt(t, x, more) { return t ? P.fill(t, ctx(x, more)) : key(x); }
    function load() {
      var l = b.load || {}, sr = l.series || {};
      return (l.by ? sr[str(P.get(l.by))] : sr) || {};
    }
    function toWork(x) {
      var y = x, mv = false;
      for (var i = 0; i < 400 && !work(y); i++) { y = plus(y, 1); mv = true; }
      adj.textContent = mv ? txt(L.moved, y) : '';
      return y;
    }
    var m0 = first(t0), w0 = sel < plus(m0, 21) ? m0 : first(sel);
    var cols = [0, 1, 2, 3, 4, 5, 6].filter(function (j) { return shown(plus(m0, j)); });
    var grid = h('div', { c: 'uik-weeks' });
    var pv = h('button', { c: 'uik-chip', type: 'button', t: s(L.prev), onclick: function () { if (w0 > m0) { w0 = plus(w0, -7); paint(); } } });
    var nx = h('button', { c: 'uik-chip', type: 'button', t: s(L.next), onclick: function () { if (plus(w0, 21) <= end) { w0 = plus(w0, 7); paint(); } } });
    function cell(x, ld, mx) {
      var k = key(x), c = ld[k] || 0, off = x < t0 || x > end, isHol = hol.indexOf(k) >= 0, tags = [];
      if (k === key(t0)) tags.push(L.today);
      if (lim && k === key(lim.d)) tags.push(lim.t);
      if (prop && k === key(prop)) tags.push(L.proposal);
      if (cur && k === key(cur)) tags.push(L.current);
      if (isHol) tags.push(L.holiday);
      var lv = c ? Math.min(3, Math.floor(c / mx * 4)) : 0;
      return h('button', {
        c: 'uik-day ' + (off || isHol ? 'uik-off' : 'uik-l' + lv) + (k === key(sel) ? ' uik-sel' : ''),
        type: 'button', 'data-k': k, disabled: off || isHol, onclick: function () { pick(x); }
      }, [
        h('div', { c: 'uik-dn', t: txt(L.cell, x) }),
        h('div', { c: 'uik-dc', t: String(c) }),
        h('div', { c: 'uik-dt', t: tags.filter(Boolean).join(P.sep) })
      ]);
    }
    function paint() {
      var ld = load(), mx = 1, i, x;
      for (i = 0; i < 21; i++) { x = plus(w0, i); if (shown(x)) mx = Math.max(mx, ld[key(x)] || 0); }
      grid.textContent = '';
      for (var wk = 0; wk < 3; wk++) {
        var w1 = plus(w0, 7 * wk), row = h('div', { c: 'uik-wk' }, [h('div', { c: 'uik-wl', t: txt(L.week, w1) })]);
        row.style.gridTemplateColumns = '90px repeat(' + cols.length + ',minmax(0,1fr))';
        cols.forEach(function (j) { row.appendChild(cell(plus(w1, j), ld, mx)); });
        grid.appendChild(row);
      }
      pv.disabled = !(w0 > m0);
      nx.disabled = !(plus(w0, 21) <= end);
    }
    function center(x) {
      if (x < w0 || x >= plus(w0, 21)) w0 = first(x);
      if (w0 < m0) w0 = m0;
    }
    function choose(x) { sel = x; center(sel); if (b.id) P.chg(b.id); else upd(); }
    function pick(x) { adj.textContent = ''; choose(x); }
    function upd() {
      kSel.textContent = txt(L.sel, sel);
      var n = span(t0, sel);
      kDays.textContent = n === 0 ? s(L.d0) : n === 1 ? s(L.d1) : P.fill(L.dn, { n: n });
      kWork.textContent = P.fill(L.work, { n: count(t0, sel) });
      kLoad.textContent = String(load()[key(sel)] || 0);
      if (lim) {
        var m = span(sel, lim.d);
        kMargin.textContent = m >= 0 ? P.fill(L.dn, { n: m }) : s(L.late);
        kMargin.className = m < 0 ? 'uik-danger' : '';
      }
      paint();
    }
    var freeDate = h('input', {
      c: 'uik-in', type: 'date', min: key(t0), max: key(end),
      onchange: function () { var x = day(freeDate.value); if (x) choose(toWork(x < t0 ? t0 : x)); }
    });
    var sc = (b.shortcuts || []).map(function (n, i) {
      return h('button', { c: 'uik-chip', type: 'button', t: i ? String(n) : P.fill(L.dn, { n: n }), onclick: function () { choose(toWork(plus(t0, +n))); } });
    });
    function kp(v, t) { return h('div', { c: 'uik-kp' }, [v, h('span', { t: s(t) })]); }
    var kps = h('div', { c: 'uik-kps' }, [
      kp(kSel, L.chosen), h('div', { c: 'uik-kp' }, [kDays, kWork]), kp(kLoad, L.load),
      lim ? kp(kMargin, txt(L.margin, lim.d, { t: lim.t })) : null
    ]);
    var shortcutBar = h('div', { c: 'uik-shortcuts' }, (sc.length ? [h('span', { t: s(L.short) })].concat(sc, [h('span', { t: P.bul + s(L.free) })]) : [h('span', { t: s(L.free) })]).concat([freeDate]));
    var nh = b.holidays && b.holidays.length ? null : h('p', { c: 'uik-warn uik-warning uik-nohol' }, [mark(P.alert), s(L.noHol)]);
    var calEl = h('div', { c: 'uik-cal' }, [
      h('div', { c: 'uik-calh' }, [pv, h('span', { t: s(b.legend || L.legend) }), nx]),
      grid,
      h('div', { c: 'uik-leg' }, [s(L.less), h('i', { c: 'uik-l0' }), h('i', { c: 'uik-l1' }), h('i', { c: 'uik-l2' }), h('i', { c: 'uik-l3' }), s(L.more)])
    ]);
    P.mid.push(upd);
    return field(b, P, F, [nh, kps, shortcutBar, adj, calEl], {
      get: function () { return key(sel); },
      put: function (v) { var x = day(v); if (x) { sel = x; adj.textContent = ''; center(x); } }
    });
  };

  B.form = function (b, P) {
    var F = { b: b, fields: [], notes: [], warns: null, sub: false };
    var inner = h('div', null, blks(b.blocks, P, F));
    if (b.rules && b.rules.length && !F.warns) inner.appendChild(B.warns({}, P, F));
    if (!F.sub) add(inner, B.submit({}, P, F));
    F.inner = inner;
    F.done = b.dismiss && b.dismiss.done ? h('p', { c: 'uik-warn uik-hide', t: s(b.dismiss.done) }) : null;
    return h('div', { c: 'uik-form' }, [inner, F.done]);
  };
  B.warns = function (b, P, F) {
    var e = h('div', { c: 'uik-warns' }), rules = b.rules || (F ? F.b.rules : null) || [];
    if (F && !b.rules) F.warns = e;
    P.end.push(function () {
      e.textContent = '';
      rules.forEach(function (r) {
        if (!P.test(r.when)) return;
        var al = r.tone === 'danger' || r.tone === 'warning';
        e.appendChild(h('p', { c: tone(r.tone) || null }, [mark(al ? P.alert : P.bul), P.tpl(r.t)]));
      });
    });
    return e;
  };
  B.submit = function (b, P, F) {
    if (!F) return null;
    var fb = F.b, sb = fb.submit || {};
    F.sub = true;
    var er = h('p', { c: 'uik-err uik-hide' }), lk = h('p', { c: 'uik-err uik-hide' });
    function bad() { return F.fields.some(function (f) { return f.req && vis(f.el) && blank(f.get()); }); }
    function changes() {
      return (fb.changes || []).map(function (c) {
        var f = P.f[c.id];
        if (!f || !vis(f.el)) return null;
        var a = s(f.orig), z = str(f.get());
        return a === z ? null : P.fill(c.t, { from: a, to: z });
      }).filter(Boolean);
    }
    function go() {
      if (!bt || bt.disabled) return;
      var m = (sb.modes || []).filter(function (x) { return P.test(x.when); })[0] || sb, ch = changes();
      if (m.nochange && !ch.length) { er.textContent = s(m.nochange); er.classList.remove('uik-hide'); return; }
      P.send(P.tpl(m.send, { changes: ch, note: F.notes.length ? F.notes[0]() : '' }));
    }
    var bt = sb.t ? btn(sb.t, go, 'uik-main') : null;
    var dm = fb.dismiss ? btn(fb.dismiss.t, function () {
      F.inner.classList.add('uik-hide');
      if (F.done) F.done.classList.remove('uik-hide');
    }, 'uik-link') : null;
    P.end.push(function () {
      var x = bad(), off = fb.disabled;
      if (bt) bt.disabled = !!(x || off);
      lk.textContent = off ? s(off) : x ? s(fb.lock) : '';
      lk.classList.toggle('uik-hide', !lk.textContent);
      er.classList.add('uik-hide');
    });
    return h('div', { c: 'uik-submit' }, [lk, er, bt, dm]);
  };

  function render(el, spec, opts) {
    if (typeof el === 'string') el = d.getElementById(el);
    if (!el) return null;
    spec = spec && typeof spec === 'object' ? spec : {};
    var r = h('div', { c: 'uik' }), P = panel(spec, r, opts && typeof opts === 'object' ? opts : null);
    theme(r, P.L.theme);
    r.style.visibility = 'hidden';
    el.appendChild(r);
    try {
      add(r, blks(spec.blocks, P, null));
      P.up();
    } catch (e) {
      r.className = 'uik uik-fail';
      r.textContent = P.fill(P.L.fail || '{error}', { error: s(e && e.message) });
    }
    function g() { P.tas.forEach(grow); }
    g();
    setTimeout(g, 0);
    cssReady.then(function () { r.style.visibility = ''; g(); });
    return r;
  }

  var api = {
    version: VERSION,
    render: render,
    last: null,
    fn: {
      norm: norm, html: mailHtml, diff: diff,
      note: function (lines, comment, prefix, strip) { return noteText(lines, comment, prefix, rx(strip)); },
      fill: function (t, v, L) { return fill(t, local(v), L); },
      test: function (q, v) { return test(q, local(v)); }
    }
  };
  w.UIK = api;
  function run(it) { if (it && it.length) render(it[0], it[1], it[2]); }
  var q0 = w.UIKQ;
  w.UIKQ = { push: function () { for (var i = 0; i < arguments.length; i++) run(arguments[i]); return 0; } };
  if (q0 && typeof q0.forEach === 'function') q0.forEach(run);
})(window, document);
