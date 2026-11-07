// ===================== Compilateur C (sous-ensemble XC8) -> JS générateurs =====================
const CC = (() => {
class CErr extends Error { constructor(msg, line, xc8) { super(msg); this.line = line; this.xc8 = xc8; } }

// ---------- Types ----------
const T = {
  int: (bits, uns) => ({ k: 'int', bits, uns: !!uns }),
  flt: { k: 'float' }, void: { k: 'void' },
  ptr: to => ({ k: 'ptr', to }), arr: (of, n) => ({ k: 'arr', of, n }),
};
const U8 = T.int(8, 1), S8 = T.int(8, 0), S16 = T.int(16, 0), U16 = T.int(16, 1), S32 = T.int(32, 0), U32 = T.int(32, 1), BIT = T.int(1, 1);
const isInt = t => t.k === 'int', isFlt = t => t.k === 'float', isArith = t => isInt(t) || isFlt(t);
const isAddr = t => t.k === 'ptr' || t.k === 'arr';
function sizeOf(t) {
  if (t.k === 'int') return t.bits === 1 ? 1 : t.bits / 8;
  if (t.k === 'float') return 4; if (t.k === 'ptr') return 2;
  if (t.k === 'arr') return t.n * sizeOf(t.of); return 1;
}
function scalarCount(t) { return t.k === 'arr' ? t.n * scalarCount(t.of) : 1; }
function baseElem(t) { while (t.k === 'arr') t = t.of; return t; }
function tname(t) {
  if (t.k === 'int') return t.bits === 1 ? 'bit' : (t.uns ? 'unsigned ' : '') + ({ 8: 'char', 16: 'int', 24: 'short long', 32: 'long' })[t.bits];
  if (t.k === 'float') return 'float'; if (t.k === 'void') return 'void';
  if (t.k === 'ptr') return tname(t.to) + '*'; if (t.k === 'arr') return tname(t.of) + '[' + t.n + ']'; return '?';
}
function promote(t) { if (t.k === 'int' && t.bits < 16) return S16; return t; }
function arith(a, b) {
  if (isFlt(a) || isFlt(b)) return T.flt;
  a = promote(a); b = promote(b);
  if (a.bits !== b.bits) return a.bits > b.bits ? a : b;
  return T.int(a.bits, a.uns || b.uns);
}
function wrap(t, c) {
  if (t.k === 'float') return `Math.fround(${c})`;
  if (t.k !== 'int') return c;
  switch (t.bits) {
    case 1: return `((${c})?1:0)`;
    case 8: return t.uns ? `((${c})&255)` : `((${c})<<24>>24)`;
    case 16: return t.uns ? `((${c})&65535)` : `((${c})<<16>>16)`;
    case 24: return t.uns ? `((${c})&16777215)` : `((${c})<<8>>8)`;
    case 32: return t.uns ? `((${c})>>>0)` : `((${c})|0)`;
  }
  return c;
}
function arrCtor(t) {
  if (t.k === 'int') { if (t.bits <= 8) return t.uns ? 'Uint8Array' : 'Int8Array'; if (t.bits === 16) return t.uns ? 'Uint16Array' : 'Int16Array'; return t.uns ? 'Uint32Array' : 'Int32Array'; }
  if (t.k === 'float') return 'Float32Array'; return 'Array';
}

// ---------- Lexer ----------
const TOKRE = /\s*(?:(0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?[fF]?|\d+[eE][+-]?\d+[fF]?|\d+[uUlL]*)|([A-Za-z_$]\w*)|("(?:[^"\\\n]|\\.)*")|('(?:[^'\\\n]|\\.)*')|(<<=|>>=|\.\.\.|->|\+\+|--|<<|>>|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|\/=|%=|&=|\|=|\^=|##|[{}()\[\];,.?:~!+\-*\/%&|^<>=#@\\]))/y;
function unesc(s, line) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (c !== '\\') { out.push(c.charCodeAt(0) & 255); continue; }
    c = s[++i];
    const m = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, v: 11, '?': 63 };
    if (c === 'x') { let h = ''; while (/[0-9a-fA-F]/.test(s[i + 1] || '')) h += s[++i]; out.push(parseInt(h, 16) & 255); }
    else if (/[0-7]/.test(c)) { let o = c; while (o.length < 3 && /[0-7]/.test(s[i + 1] || '')) o += s[++i]; out.push(parseInt(o, 8) & 255); }
    else if (c in m) out.push(m[c]);
    else throw new CErr(`séquence d'échappement inconnue \\${c}`, line);
  }
  return out;
}
function lexLine(src, line) {
  const toks = []; TOKRE.lastIndex = 0; let pos = 0;
  while (pos < src.length) {
    TOKRE.lastIndex = pos;
    const m = TOKRE.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(pos))) break; throw new CErr(`caractère inattendu « ${src.slice(pos).trim()[0]} »`, line); }
    pos = TOKRE.lastIndex;
    if (m[1] !== undefined) {
      let s = m[1], uns = /u/i.test(s.replace(/^0[xX][0-9a-fA-F]+/, '')), lng = /l/i.test(s.replace(/^0[xX][0-9a-fA-F]+/, ''));
      if (/^0[xX]/.test(s)) { s = s.replace(/[uUlL]+$/, ''); toks.push(numTok(parseInt(s, 16), uns, lng, true, line)); }
      else if (/^0[bB]/.test(s)) { s = s.replace(/[uUlL]+$/, ''); toks.push(numTok(parseInt(s.slice(2), 2), uns, lng, true, line)); }
      else if (/[.eE]/.test(s) || /[fF]$/.test(s)) toks.push({ t: 'num', v: parseFloat(s), ty: T.flt, line });
      else { s = s.replace(/[uUlL]+$/, ''); const oct = s.length > 1 && s[0] === '0'; if (oct && /[89]/.test(s)) throw new CErr(`nombre octal invalide ${s}`, line); toks.push(numTok(oct ? parseInt(s, 8) : parseInt(s, 10), uns, lng, oct, line)); }
    } else if (m[2] !== undefined) toks.push({ t: 'id', v: m[2], line });
    else if (m[3] !== undefined) toks.push({ t: 'str', v: unesc(m[3].slice(1, -1), line), line });
    else if (m[4] !== undefined) { const b = unesc(m[4].slice(1, -1), line); if (!b.length) throw new CErr('caractère vide \'\'', line); toks.push({ t: 'num', v: b[b.length - 1], ty: S16, line, chr: true }); }
    else toks.push({ t: 'op', v: m[5], line });
  }
  return toks;
}
function numTok(v, uns, lng, nondec, line) {
  let ty;
  if (!lng && !uns && v <= 32767) ty = S16;
  else if (!lng && (uns || nondec) && v <= 65535) ty = U16;
  else if (!uns && v <= 2147483647) ty = S32;
  else ty = U32;
  if (v > 4294967295) throw new CErr(`constante trop grande : ${v}`, line);
  return { t: 'num', v, ty, line };
}

// ---------- Préprocesseur ----------
const KNOWN_HDR = /^(xc\.h|p18f452\.h|p18c452\.h|p18f252\.h|pic18f452\.h|pic18\.h|htc\.h|stdio\.h|stdlib\.h|stdint\.h|stdbool\.h|string\.h|math\.h|delays\.h|plib\.h|p18cxxx\.h|pic18fregs\.h)$/i;
function stripComments(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; }
    else if (c === '/' && d === '*') { i += 2; out += ' '; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; }
    else if (c === '"' || c === "'") { const q = c; out += c; i++; while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { out += src[i++]; } out += src[i++]; } if (i < n) out += src[i++]; }
    else out += src[i++];
  }
  return out;
}
function preprocess(src, warn) {
  src = src.replace(/\r\n?/g, '\n');
  { const lines0 = src.split('\n'); lines0.forEach((l, i) => { if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(l)) warn('caractère invisible (code de contrôle) ignoré sur cette ligne', i + 1); }); }
  src = stripComments(src.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' '));
  const raw = src.split('\n');
  // continuation de ligne
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    let l = raw[i], start = i;
    while (/\\\s*$/.test(l) && i + 1 < raw.length) { l = l.replace(/\\\s*$/, ' ') + raw[++i]; }
    lines.push({ s: l, n: start + 1 });
    for (let k = start; k < i; k++) lines.push({ s: '', n: k + 2 });
  }
  const macros = new Map();
  const def = (k, v) => macros.set(k, { body: lexLine(v, 0) });
  def('__XC8', '1'); def('__XC', '1'); def('_18F452', '1'); def('__18F452', '1'); def('__PICC18__', '1');
  def('true', '1'); def('false', '0'); def('TRUE', '1'); def('FALSE', '0'); def('NULL', '0');
  def('HIGH', '1'); def('LOW', '0');
  const out = [], cond = []; let asm = false; const info = { pragmas: [] };
  const active = () => cond.every(c => c.on);
  for (const { s, n } of lines) {
    const tr = s.trim();
    if (asm) {
      if (/^#\s*endasm\b/.test(tr)) { asm = false; continue; }
      if (active() && tr) out.push({ t: 'id', v: '__asmi', line: n }, { t: 'op', v: '(', line: n }, { t: 'str', v: [...tr].map(c => c.charCodeAt(0)), line: n }, { t: 'op', v: ')', line: n }, { t: 'op', v: ';', line: n });
      continue;
    }
    if (tr[0] === '#') {
      const m = /^#\s*(\w*)\s*(.*)$/.exec(tr); const dir = m[1], rest = m[2];
      if (dir === 'ifdef' || dir === 'ifndef') { const nm = rest.trim().split(/\s+/)[0]; const has = macros.has(nm); cond.push({ on: active() && (dir === 'ifdef' ? has : !has), done: false, parent: active() }); cond[cond.length - 1].done = cond[cond.length - 1].on; continue; }
      if (dir === 'if') { const parent = active(); const v = parent && evalIf(rest, n); cond.push({ on: parent && v, done: parent && v, parent }); continue; }
      if (dir === 'elif') { const c = cond[cond.length - 1]; if (!c) throw new CErr('#elif sans #if', n); if (c.done || !c.parent) c.on = false; else { c.on = evalIf(rest, n); c.done = c.on; } continue; }
      if (dir === 'else') { const c = cond[cond.length - 1]; if (!c) throw new CErr('#else sans #if', n); c.on = c.parent && !c.done; c.done = true; continue; }
      if (dir === 'endif') { if (!cond.length) throw new CErr('#endif sans #if', n); cond.pop(); continue; }
      if (!active()) continue;
      if (dir === 'include') { const h = (/[<"]([^>"]+)[>"]/.exec(rest) || [])[1] || ''; if (!KNOWN_HDR.test(h.split('/').pop())) warn(`#include "${h}" : fichier non disponible dans le simulateur, ignoré`, n); continue; }
      if (dir === 'define') {
        const dm = /^([A-Za-z_]\w*)(\(([^)]*)\))?\s*(.*)$/.exec(rest);
        if (!dm) throw new CErr('#define mal formé', n);
        const body = lexLine(dm[4], n);
        if (dm[2] !== undefined) macros.set(dm[1], { params: dm[3].split(',').map(x => x.trim()).filter(x => x), body });
        else macros.set(dm[1], { body });
        continue;
      }
      if (dir === 'undef') { macros.delete(rest.trim()); continue; }
      if (dir === 'pragma') { info.pragmas.push(rest); continue; }
      if (dir === 'asm') { asm = true; continue; }
      if (dir === 'error') throw new CErr('#error ' + rest, n);
      if (dir === 'warning') { warn('#warning ' + rest, n); continue; }
      if (dir === '') continue;
      warn(`directive #${dir} ignorée`, n); continue;
    }
    if (!active() || !tr) continue;
    out.push(...expand(lexLine(s, n), new Set()));
  }
  if (cond.length) throw new CErr('#if/#ifdef sans #endif', lines.length);
  if (asm) throw new CErr('#asm sans #endasm', lines.length);
  info.macros = macros;
  return { toks: out, info };

  function evalIf(expr, n) {
    let toks = lexLine(expr, n), r = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'id' && t.v === 'defined') {
        let nm; if (toks[i + 1] && toks[i + 1].v === '(') { nm = toks[i + 2].v; i += 3; } else { nm = toks[i + 1].v; i++; }
        r.push({ t: 'num', v: macros.has(nm) ? 1 : 0, line: n });
      } else r.push(t);
    }
    r = expand(r, new Set());
    const js = r.map(t => t.t === 'num' ? String(t.v) : t.t === 'id' ? '0' : t.v).join(' ');
    try { return !!Function('"use strict";return (' + js + ')')(); } catch (e) { throw new CErr('expression #if invalide', n); }
  }
  function expand(toks, hide) {
    const res = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t !== 'id' || !macros.has(t.v) || hide.has(t.v)) { res.push(t); continue; }
      const m = macros.get(t.v); const h = new Set(hide); h.add(t.v);
      if (!m.params) { res.push(...expand(m.body.map(x => ({ ...x, line: t.line })), h)); continue; }
      if (!(toks[i + 1] && toks[i + 1].t === 'op' && toks[i + 1].v === '(')) { res.push(t); continue; }
      let depth = 0, j, args = [[]];
      for (j = i + 2; j < toks.length; j++) {
        const u = toks[j];
        if (u.t === 'op' && u.v === '(') depth++;
        else if (u.t === 'op' && u.v === ')') { if (depth === 0) break; depth--; }
        else if (u.t === 'op' && u.v === ',' && depth === 0) { args.push([]); continue; }
        args[args.length - 1].push(u);
      }
      if (j >= toks.length) throw new CErr(`appel de macro ${t.v}( non fermé sur la ligne`, t.line);
      if (m.params.length === 0 && args.length === 1 && !args[0].length) args = [];
      if (args.length !== m.params.length) throw new CErr(`macro ${t.v} : ${m.params.length} argument(s) attendu(s), ${args.length} donné(s)`, t.line);
      const body = [];
      for (let k = 0; k < m.body.length; k++) {
        const b = m.body[k];
        if (b.t === 'op' && b.v === '#' && m.body[k + 1] && m.params.includes(m.body[k + 1].v)) {
          const a = args[m.params.indexOf(m.body[++k].v)];
          body.push({ t: 'str', v: [...a.map(x => x.t === 'num' ? String(x.v) : x.t === 'str' ? '"' + String.fromCharCode(...x.v) + '"' : x.v).join(' ')].map(c => c.charCodeAt(0)), line: t.line });
          continue;
        }
        if (b.t === 'op' && b.v === '##') {
          const prev = body.pop(); let nx = m.body[++k]; let nxt = (nx && m.params.includes(nx.v)) ? args[m.params.indexOf(nx.v)] : [nx];
          const pasted = (prev ? (prev.t === 'num' ? String(prev.v) : prev.v) : '') + nxt.map(x => x.t === 'num' ? String(x.v) : x.v).join('');
          body.push(...lexLine(pasted, t.line)); continue;
        }
        if (b.t === 'id' && m.params.includes(b.v)) {
          const a = args[m.params.indexOf(b.v)];
          const nextPaste = m.body[k + 1] && m.body[k + 1].v === '##';
          body.push(...(nextPaste ? a : expand(a, hide)).map(x => ({ ...x, line: t.line })));
        } else body.push({ ...b, line: t.line });
      }
      res.push(...expand(body, h));
      i = j;
    }
    return res;
  }
}

// ---------- Parser ----------
const TYPE_KW = new Set(['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', 'bit', '__bit', '_Bool', 'bool',
  'const', 'volatile', 'static', 'extern', 'register', 'auto', 'near', 'far', '__near', '__far', 'persistent', '__persistent', 'inline', '__inline',
  'typedef', 'enum', 'struct', 'union', 'interrupt', '__interrupt', 'low_priority', 'high_priority', '__low_priority', '__high_priority', 'ram', 'rom', '__ram', '__rom', '__at', '_at']);
const TYPEDEFS0 = { uint8_t: U8, int8_t: S8, uint16_t: U16, int16_t: S16, uint24_t: T.int(24, 1), int24_t: T.int(24, 0), uint32_t: U32, int32_t: S32,
  BYTE: U8, WORD: U16, DWORD: U32, BOOL: U8, UINT8: U8, UINT16: U16, INT8: S8, INT16: S16, UINT32: U32, INT32: S32, size_t: U16, uint_fast8_t: U8, uint_least8_t: U8 };

function parse(toks) {
  let p = 0;
  const typedefs = Object.assign({}, TYPEDEFS0);
  const enums = {};
  const EOF = { t: 'eof', v: '<fin>', line: toks.length ? toks[toks.length - 1].line : 1 };
  const peek = (o = 0) => toks[p + o] || EOF;
  const next = () => toks[p++] || EOF;
  const is = (v, o = 0) => { const t = peek(o); return (t.t === 'op' || t.t === 'id') && t.v === v; };
  const accept = v => { if (is(v)) { p++; return true; } return false; };
  const fmt = t => t.t === 'eof' ? 'la fin du fichier' : t.t === 'str' ? 'une chaîne' : `« ${t.v} »`;
  const expect = (v, what) => { if (!accept(v)) { const t = peek(); const prevLine = toks[p - 1] ? toks[p - 1].line : t.line; throw new CErr(`« ${v} » attendu${what ? ' ' + what : ''} avant ${fmt(t)}`, v === ';' ? prevLine : t.line, v === ';' ? "error: expected ';' after expression" : `error: expected '${v}'`); } };
  const isTypeStart = () => { const t = peek(); return t.t === 'id' && (TYPE_KW.has(t.v) || typedefs[t.v]); };

  function parseSpec() {
    let sign = null, size = null, base = null, longs = 0, line = peek().line;
    const q = { isr: false, low: false, stat: false, typedef: false, cnst: false, ext: false };
    while (true) {
      const t = peek(); if (t.t !== 'id') break; const v = t.v;
      if (v === 'unsigned' || v === 'signed') { sign = v; p++; }
      else if (v === 'short') { size = (size === 'long' ? 'shortlong' : 'short'); p++; }
      else if (v === 'long') { longs++; size = size === 'short' ? 'shortlong' : 'long'; p++; }
      else if (['char', 'int', 'float', 'double', 'void', 'bit', '__bit', '_Bool', 'bool'].includes(v)) { if (base && !(base === 'int' || v === 'int')) throw new CErr(`types incompatibles « ${base} ${v} »`, t.line); if (!(base && v === 'int')) base = v; p++; }
      else if (v === 'const') { q.cnst = true; p++; }
      else if (v === 'static') { q.stat = true; p++; }
      else if (v === 'extern') { q.ext = true; p++; }
      else if (v === 'typedef') { q.typedef = true; p++; }
      else if (v === 'interrupt' || v === '__interrupt') { q.isr = true; p++; if (is('(')) { p++; let d = 1; while (d && peek().t !== 'eof') { const u = next(); if (u.v === '(') d++; else if (u.v === ')') d--; else if (/low_priority/.test(u.v)) q.low = true; } } }
      else if (v === 'low_priority' || v === '__low_priority') { q.low = true; p++; }
      else if (v === '__at' || v === '_at') { p++; expect('('); while (!accept(')')) next(); }
      else if (['volatile', 'register', 'auto', 'near', 'far', '__near', '__far', 'persistent', '__persistent', 'inline', '__inline', 'high_priority', '__high_priority', 'ram', 'rom', '__ram', '__rom'].includes(v)) p++;
      else if (v === 'enum') { p++; base = 'enumT'; parseEnum(); }
      else if (v === 'struct' || v === 'union') throw new CErr(`« ${v} » n'est pas supporté par le simulateur (utilise des variables séparées ou des tableaux)`, t.line);
      else if (typedefs[v] && !base && !sign && !size) { base = { td: typedefs[v] }; p++; }
      else break;
    }
    let ty;
    if (base && base.td) ty = base.td;
    else if (base === 'enumT') ty = S16;
    else if (base === 'void') ty = T.void;
    else if (base === 'float' || base === 'double') ty = T.flt;
    else if (base === 'bit' || base === '__bit' || base === '_Bool' || base === 'bool') ty = BIT;
    else if (base === 'char') ty = T.int(8, sign !== 'signed');
    else if (size === 'short') ty = T.int(16, sign === 'unsigned');
    else if (size === 'shortlong') ty = T.int(24, sign === 'unsigned');
    else if (size === 'long') ty = T.int(32, sign === 'unsigned');
    else if (base === 'int' || sign) ty = T.int(16, sign === 'unsigned');
    else return null;
    return { ty, q, line };
  }
  function parseEnum() {
    if (peek().t === 'id' && !is('{')) p++;
    if (!accept('{')) return;
    let val = 0;
    while (!accept('}')) {
      const nm = next(); if (nm.t !== 'id') throw new CErr('nom attendu dans enum', nm.line);
      if (accept('=')) val = constEval(parseAssign());
      enums[nm.v] = val++;
      if (!accept(',')) { expect('}'); break; }
    }
  }
  function constEval(e) {
    const r = constTry(e); if (r === null) throw new CErr('expression constante attendue', e.line); return r;
  }
  function constTry(e) {
    switch (e.e) {
      case 'num': return e.v;
      case 'id': return e.name in enums ? enums[e.name] : null;
      case 'un': { const x = constTry(e.x); if (x === null) return null; return { '-': -x, '+': x, '~': ~x, '!': x ? 0 : 1 }[e.op] ?? null; }
      case 'bin': { const a = constTry(e.l), b = constTry(e.r); if (a === null || b === null) return null;
        switch (e.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return Math.trunc(a / b); case '%': return a % b; case '<<': return a << b; case '>>': return a >> b; case '&': return a & b; case '|': return a | b; case '^': return a ^ b; case '<': return +(a < b); case '>': return +(a > b); case '==': return +(a == b); case '!=': return +(a != b); case '<=': return +(a <= b); case '>=': return +(a >= b); case '&&': return +(a && b); case '||': return +(a || b); } return null; }
      case 'cast': return constTry(e.x);
      case 'cond': { const c = constTry(e.c); if (c === null) return null; return constTry(c ? e.a : e.b); }
      case 'sizeof': return e.ty ? sizeOf(e.ty) : null;
    }
    return null;
  }
  function parseDeclarator(base, allowAbstract) {
    let ty = base, line = peek().line;
    while (accept('*')) { ty = T.ptr(ty); while (is('const') || is('volatile') || is('near') || is('far') || is('rom') || is('ram')) p++; }
    let name = null;
    if (peek().t === 'id' && !TYPE_KW.has(peek().v)) { name = next().v; line = toks[p - 1].line; }
    else if (!allowAbstract) throw new CErr(`nom de variable attendu avant ${fmt(peek())}`, peek().line);
    const dims = [];
    let func = null;
    if (is('(')) { p++; func = parseParams(); }
    while (accept('[')) { if (accept(']')) dims.push(null); else { dims.push(constEval(parseExpr())); expect(']'); } }
    for (let i = dims.length - 1; i >= 0; i--) ty = T.arr(ty, dims[i]);
    if (func) ty = { k: 'func', ret: ty, params: func.params, variadic: func.variadic };
    return { name, ty, line };
  }
  function parseParams() {
    const params = []; let variadic = false;
    if (accept(')')) return { params, variadic };
    if (is('void') && is(')', 1)) { p += 2; return { params, variadic }; }
    while (true) {
      if (accept('...')) { variadic = true; expect(')'); break; }
      const sp = parseSpec(); if (!sp) throw new CErr(`type de paramètre attendu avant ${fmt(peek())}`, peek().line);
      const d = parseDeclarator(sp.ty, true);
      let ty = d.ty; if (ty.k === 'arr') ty = T.ptr(ty.of);
      params.push({ name: d.name, ty, line: d.line });
      if (accept(')')) break; expect(',');
    }
    return { params, variadic };
  }
  function parseInit() {
    if (accept('{')) {
      const items = [];
      while (!accept('}')) { items.push(parseInit()); if (!accept(',')) { expect('}', 'pour fermer la liste d\'initialisation'); break; } }
      return { list: items, line: peek().line };
    }
    return parseAssign();
  }
  // ---- Expressions ----
  const BINP = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
  const ASG = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
  function parseExpr() { let e = parseAssign(); while (is(',')) { const line = next().line; e = { e: 'comma', l: e, r: parseAssign(), line }; } return e; }
  function parseAssign() {
    const l = parseCond();
    const t = peek();
    if (t.t === 'op' && ASG.has(t.v)) { p++; return { e: 'asg', op: t.v, l, r: parseAssign(), line: t.line }; }
    return l;
  }
  function parseCond() {
    const c = parseBin(1);
    if (is('?')) { const line = next().line; const a = parseExpr(); expect(':', 'dans l\'opérateur ternaire'); const b = parseCond(); return { e: 'cond', c, a, b, line }; }
    return c;
  }
  function parseBin(minP) {
    let l = parseUnary();
    while (true) {
      const t = peek(); if (t.t !== 'op') break; const pr = BINP[t.v]; if (!pr || pr < minP) break;
      p++; const r = parseBin(pr + 1); l = { e: 'bin', op: t.v, l, r, line: t.line };
    }
    return l;
  }
  function isCastAhead() {
    if (!is('(')) return false; const t = peek(1);
    return t.t === 'id' && (typedefs[t.v] || ['void', 'char', 'short', 'int', 'long', 'float', 'double', 'signed', 'unsigned', 'bit', '__bit', '_Bool', 'bool', 'const', 'volatile'].includes(t.v));
  }
  function parseTypeName() { const sp = parseSpec(); const d = parseDeclarator(sp.ty, true); return d.ty; }
  function parseUnary() {
    const t = peek();
    if (t.t === 'op') {
      if (t.v === '++' || t.v === '--') { p++; return { e: 'pre', op: t.v, x: parseUnary(), line: t.line }; }
      if (['-', '+', '!', '~', '*', '&'].includes(t.v)) { p++; return { e: 'un', op: t.v, x: parseUnary(), line: t.line }; }
      if (isCastAhead()) { p++; const ty = parseTypeName(); expect(')'); return { e: 'cast', ty, x: parseUnary(), line: t.line }; }
    }
    if (t.t === 'id' && t.v === 'sizeof') {
      p++;
      if (isCastAhead()) { p++; const ty = parseTypeName(); expect(')'); return { e: 'sizeof', ty, line: t.line }; }
      return { e: 'sizeof', x: parseUnary(), line: t.line };
    }
    return parsePostfix(parsePrimary());
  }
  function parsePrimary() {
    const t = next();
    if (t.t === 'num') return { e: 'num', v: t.v, ty: t.ty, line: t.line };
    if (t.t === 'str') { let v = t.v.slice(); while (peek().t === 'str') v = v.concat(next().v); return { e: 'str', v, line: t.line }; }
    if (t.t === 'id') { if (t.v in enums) return { e: 'num', v: enums[t.v], ty: S16, line: t.line }; return { e: 'id', name: t.v, line: t.line }; }
    if (t.t === 'op' && t.v === '(') { const e = parseExpr(); expect(')'); return e; }
    throw new CErr(`expression attendue avant ${fmt(t)}`, t.line);
  }
  function parsePostfix(e) {
    while (true) {
      const t = peek();
      if (is('[')) { p++; const i = parseExpr(); expect(']'); e = { e: 'idx', a: e, i, line: t.line }; }
      else if (is('(')) { p++; const args = []; if (!accept(')')) { while (true) { args.push(parseAssign()); if (accept(')')) break; expect(',', 'entre les arguments'); } } e = { e: 'call', f: e, args, line: t.line }; }
      else if (is('.') || is('->')) { p++; const n = next(); if (n.t !== 'id') throw new CErr('nom de champ attendu après « . »', n.line); e = { e: 'mem', x: e, name: n.v, line: t.line }; }
      else if (is('++') || is('--')) { p++; e = { e: 'post', op: t.v, x: e, line: t.line }; }
      else break;
    }
    return e;
  }
  // ---- Statements ----
  function parseStmt() {
    const t = peek();
    if (t.t === 'eof') throw new CErr('fin de fichier inattendue (accolade « } » manquante ?)', t.line, "error: expected '}'");
    if (is('{')) return parseBlock();
    if (t.t === 'id') {
      switch (t.v) {
        case 'if': { p++; expect('(', 'après if'); const c = parseExpr(); expect(')', 'après la condition du if'); const a = parseStmt(); let b = null; if (accept('else')) b = parseStmt(); return { s: 'if', c, a, b, line: t.line }; }
        case 'while': { p++; expect('(', 'après while'); const c = parseExpr(); expect(')', 'après la condition du while'); return { s: 'while', c, body: parseStmt(), line: t.line }; }
        case 'do': { p++; const body = parseStmt(); if (!accept('while')) throw new CErr('« while » attendu après le corps du do', peek().line); expect('('); const c = parseExpr(); expect(')'); expect(';', 'après do…while'); return { s: 'do', c, body, line: t.line }; }
        case 'for': { p++; expect('(', 'après for'); let init = null; if (!accept(';')) { if (isTypeStart()) init = parseDecl(); else { init = { s: 'expr', x: parseExpr(), line: t.line }; expect(';', 'dans le for'); } }
          let c = null; if (!accept(';')) { c = parseExpr(); expect(';', 'dans le for'); }
          let upd = null; if (!accept(')')) { upd = parseExpr(); expect(')', 'à la fin du for'); }
          return { s: 'for', init, c, upd, body: parseStmt(), line: t.line }; }
        case 'switch': { p++; expect('('); const c = parseExpr(); expect(')'); return { s: 'switch', c, body: parseStmt(), line: t.line }; }
        case 'case': { p++; const v = parseCond(); expect(':', 'après case'); return { s: 'case', v: constEval(v), line: t.line }; }
        case 'default': { p++; expect(':', 'après default'); return { s: 'default', line: t.line }; }
        case 'break': p++; expect(';', 'après break'); return { s: 'break', line: t.line };
        case 'continue': p++; expect(';', 'après continue'); return { s: 'continue', line: t.line };
        case 'return': { p++; let x = null; if (!is(';')) x = parseExpr(); expect(';', 'après return'); return { s: 'return', x, line: t.line }; }
        case 'goto': throw new CErr('goto n\'est pas supporté par le simulateur', t.line);
        case '_asm': case '__asm_c18': { p++; let n = 0; while (!is('_endasm')) { const u = next(); if (u.t === 'eof') throw new CErr('_endasm manquant', t.line); if (u.t === 'id') n++; } p++; return { s: 'asm', n: Math.max(1, n), line: t.line }; }
      }
      if (peek(1).t === 'op' && peek(1).v === ':' && !TYPE_KW.has(t.v)) throw new CErr('les étiquettes (labels) ne sont pas supportées', t.line);
      if (isTypeStart()) return parseDecl();
    }
    if (accept(';')) return { s: 'empty', line: t.line };
    const x = parseExpr(); expect(';', 'à la fin de l\'instruction'); return { s: 'expr', x, line: t.line };
  }
  function parseBlock() { const line = peek().line; expect('{'); const body = []; while (!accept('}')) body.push(parseStmt()); return { s: 'block', body, line }; }
  function parseDecl() {
    const sp = parseSpec(); const decls = [];
    if (accept(';')) return { s: 'empty', line: sp.line };
    while (true) {
      const d = parseDeclarator(sp.ty);
      let init = null; if (accept('=')) init = parseInit();
      if (sp.q.typedef) typedefs[d.name] = d.ty;
      else decls.push({ name: d.name, ty: d.ty, init, line: d.line, stat: sp.q.stat, cnst: sp.q.cnst });
      if (accept(';')) break; if (!accept(',')) throw new CErr('« ; » manquant à la fin de la déclaration', toks[p - 1].line, "error: expected ';' at end of declaration");
    }
    return { s: 'decl', decls, line: sp.line };
  }
  // ---- Top level ----
  const prog = { funcs: [], globals: [] };
  while (peek().t !== 'eof') {
    if (accept(';')) continue;
    const t0 = peek();
    const sp = parseSpec();
    if (!sp) {
      if (t0.t === 'id' && is('(', 1)) throw new CErr(`type de retour manquant pour la fonction ${t0.v} (ex : void ${t0.v}(void))`, t0.line);
      throw new CErr(`déclaration attendue avant ${fmt(t0)}`, t0.line);
    }
    if (accept(';')) continue;
    while (true) {
      const d = parseDeclarator(sp.ty);
      if (d.ty.k === 'func' && is('{')) {
        if (sp.q.typedef) throw new CErr('typedef de fonction non supporté', d.line);
        prog.funcs.push({ name: d.name, ty: d.ty, body: parseBlock(), line: d.line, isr: sp.q.isr, low: sp.q.low });
        break;
      }
      let init = null; if (accept('=')) init = parseInit();
      if (sp.q.typedef) typedefs[d.name] = d.ty;
      else if (d.ty.k === 'func') prog.globals.push({ proto: true, name: d.name, ty: d.ty, line: d.line, isr: sp.q.isr });
      else prog.globals.push({ name: d.name, ty: d.ty, init, line: d.line, cnst: sp.q.cnst, ext: sp.q.ext });
      if (accept(';')) break; if (!accept(',')) throw new CErr('« ; » manquant à la fin de la déclaration', toks[p - 1].line, "error: expected ';' at end of declaration");
    }
  }
  return prog;
}

// ---------- Génération de code ----------
const BUILTINS = new Set(['Nop', 'NOP', '__nop', 'CLRWDT', 'ClrWdt', 'SLEEP', 'Sleep', 'di', 'ei', 'RESET', 'Reset', '__delay_ms', '__delay_us', '_delay', '__asmi', 'asm', '__asm', '__asm__',
  'Delay10TCYx', 'Delay100TCYx', 'Delay1KTCYx', 'Delay10KTCYx', 'Delay1TCY', 'printf', 'abs', 'labs']);
function costOp(op, t) {
  const b = t.k === 'float' ? 4 : t.k === 'int' ? Math.max(1, t.bits / 8 | 0) : 2;
  if (t.k === 'float') return op === '/' ? 300 : op === '*' ? 150 : 100;
  switch (op) {
    case '*': return b === 1 ? 3 : b === 2 ? 28 : 90;
    case '/': case '%': return b === 1 ? 90 : b === 2 ? 260 : 650;
    case '<<': case '>>': return 2 + 2 * b;
    case '==': case '!=': case '<': case '>': case '<=': case '>=': return 2 * b + 2;
    default: return b;
  }
}

const HC = { div: (a, b) => { if (!b) throw 0; return Math.trunc(a / b); }, mod: (a, b) => { if (!b) throw 0; return a % b; } };
function generate(prog, sfr, warn) {
  // sfr: { regs:{NAME:{w:8|16}}, bits:{ 'PORTBbits':{RB0:[reg,pos,w]...} }, flat:{RB0:[reg,pos,w]} }
  const lines = []; let uid = 0;
  const globalScope = new Map(); const funcs = new Map();
  const strPool = []; const statics = [];
  let fnState = null; // {tmps, scopes, ret}
  let cost = 0;
  const emit = s => lines.push(s);
  const id = n => n.replace(/\$/g, '_');

  function lookup(name) {
    if (fnState) for (let i = fnState.scopes.length - 1; i >= 0; i--) { const v = fnState.scopes[i].get(name); if (v) return v; }
    return globalScope.get(name);
  }
  function tmp() { const n = '$t' + (fnState.ntmp++); return n; }

  // déclaration des fonctions
  for (const g of prog.globals) if (g.proto) { if (!funcs.has(g.name)) funcs.set(g.name, { name: g.name, ty: g.ty, js: 'f_' + id(g.name), defined: false, isr: g.isr }); }
  for (const f of prog.funcs) {
    if (funcs.has(f.name) && funcs.get(f.name).defined) throw new CErr(`la fonction ${f.name} est définie deux fois`, f.line);
    funcs.set(f.name, { name: f.name, ty: f.ty, js: 'f_' + id(f.name), defined: true, isr: f.isr, low: f.low, line: f.line });
  }

  // ---- expressions ----
  // résultat : {c, t, lv?, addr?:{a,o}}
  function rv(x) { // convertit une expression en valeur (décroissance tableau -> adresse)
    return x;
  }
  function addrOf(x, line) { // x : résultat de type arr/ptr -> {a,o} codes
    if (x.t.k === 'arr') return x.addr;
    if (x.t.k === 'ptr') return { ptrObj: x.c };
    throw new CErr('adresse attendue', line);
  }
  function ptrValue(x, line) { // donne un code JS produisant un objet pointeur {a,o} (ou null)
    if (x.t.k === 'arr') return `H.mk(${x.addr.a},${x.addr.o})`;
    if (x.t.k === 'ptr') return x.c;
    if (x.isNull) return 'null';
    if (isInt(x.t)) { if (x.constVal === 0) return 'null'; throw new CErr('conversion entier → pointeur non supportée', line); }
    throw new CErr('pointeur attendu', line);
  }
  function conv(x, t, line) { // convertit valeur x vers type t (code)
    if (t.k === 'ptr') return ptrValue(x, line);
    if (t.k === 'void') return x.c;
    if (isAddr(x.t)) throw new CErr(`impossible de convertir un pointeur/tableau en ${tname(t)}`, line);
    if (x.t.k === 'void') throw new CErr('une fonction void ne renvoie pas de valeur', line);
    if (t.k === 'int' && x.t.k === 'int' && t.bits >= x.t.bits && (t.uns === x.t.uns || (!x.t.uns && false) || (x.t.uns && t.bits > x.t.bits))) return x.c;
    if (t.k === 'float' && x.t.k === 'float') return x.c;
    if (t.k === 'float') return `(+${x.c})`;
    if (t.bits === 1) return `((${x.c})?1:0)`;
    if (x.t.k === 'float') return wrap(t, `H.f2i(${x.c})`);
    return wrap(t, x.c);
  }
  function lvalue(e) {
    // renvoie {prep, get, set(v), t}
    const line = e.line;
    if (e.e === 'id') {
      const v = lookup(e.name);
      if (v) {
        if (v.kind === 'var') return { prep: '', get: v.js, set: c => `(${v.js}=${c})`, t: v.ty, cnst: v.cnst, name: e.name };
        if (v.kind === 'arr') throw new CErr(`impossible d'affecter le tableau ${e.name} en entier`, line);
      }
      if (sfr.regs[e.name]) { const r = e.name; return { prep: '', get: `R.r.${r}()`, set: c => `R.w.${r}(${c})`, t: sfr.regs[r].w === 16 ? U16 : U8, sfr: r }; }
      if (sfr.flat[e.name]) { const [r, pos, w] = sfr.flat[e.name]; return bitLv(r, pos, w); }
      if (funcs.has(e.name)) throw new CErr(`${e.name} est une fonction, pas une variable`, line);
      throw undeclared(e.name, line);
    }
    if (e.e === 'mem') {
      if (e.x.e === 'id' && sfr.bits[e.x.name]) {
        const b = sfr.bits[e.x.name][e.name];
        if (!b) throw new CErr(`${e.x.name} n'a pas de champ ${e.name}`, line);
        return bitLv(b[0], b[1], b[2]);
      }
      throw new CErr('les structures ne sont pas supportées (seuls les champs de registres type PORTBbits.RB0 le sont)', line);
    }
    if (e.e === 'idx' || (e.e === 'un' && e.op === '*')) {
      let base, idx;
      if (e.e === 'idx') { base = gen(e.a); idx = gen(e.i); if (isAddr(idx.t) && !isAddr(base.t)) [base, idx] = [idx, base]; }
      else { base = gen(e.x); idx = { c: '0', t: S16 }; }
      if (!isAddr(base.t)) throw new CErr(e.e === 'idx' ? 'indexation [] sur quelque chose qui n\'est ni un tableau ni un pointeur' : 'déréférencement * d\'une valeur qui n\'est pas un pointeur', line);
      if (!isInt(idx.t)) throw new CErr('l\'indice d\'un tableau doit être un entier', line);
      const et = base.t.k === 'arr' ? base.t.of : base.t.to;
      if (et.k === 'arr') throw new CErr('affectation d\'une ligne entière de tableau impossible', line);
      cost += 4;
      const ta = tmp(), ti = tmp();
      let prep;
      if (base.t.k === 'arr') prep = `${ta}=${base.addr.a},${ti}=(${base.addr.o})+(${idx.c}),`;
      else prep = `${ta}=${base.c},${ti}=H.np(${ta},${line}).o+(${idx.c}),${ta}=${ta}.a,`;
      return { prep, get: `H.ld(${ta},${ti},${line})`, set: c => `H.st(${ta},${ti},${c},${line})`, t: et, cnst: base.cnst };
    }
    throw new CErr('cette expression ne peut pas être affectée (lvalue attendue)', line);
  }
  function bitLv(r, pos, w) {
    const mask = (1 << w) - 1;
    const pm = /^PORT([A-E])$/.exec(r);
    return { prep: '', get: pm ? `R.rp(${'ABCDE'.indexOf(pm[1])},${pos},${w})` : w === 8 ? `R.r.${r}()` : `((R.r.${r}()>>${pos})&${mask})`, set: c => `R.wb("${r}",${pos},${w},${c})`, t: w === 1 ? BIT : T.int(w <= 8 ? 8 : 16, 1), bitw: w, sfr: r };
  }
  function undeclared(name, line) {
    const low = name.toLowerCase();
    const sugg = Object.keys(sfr.regs).find(k => k.toLowerCase() === low) || [...globalScope.keys()].find(k => k.toLowerCase() === low);
    if (/^(R[A-E]\d)$/.test(name)) return new CErr(`« ${name} » non déclaré — écris PORT${name[1]}bits.${name}`, line);
    if (name === '_XTAL_FREQ') return new CErr('_XTAL_FREQ non défini : ajoute #define _XTAL_FREQ 8000000 (fréquence du quartz) avant d\'utiliser __delay_ms', line);
    return new CErr(`« ${name} » n'est pas déclaré${sugg ? ` (tu voulais dire ${sugg} ?)` : ''}`, line, `error: use of undeclared identifier '${name}'`);
  }
  function asgCode(lv, valCode) { return lv.set(valCode); }

  function gen(e) {
    const line = e.line;
    switch (e.e) {
      case 'num': return { c: String(e.v), t: e.ty, constVal: e.v };
      case 'str': {
        const k = strPool.length; strPool.push(e.v.concat([0]));
        const ty = T.arr(U8, e.v.length + 1);
        return { c: `$s${k}`, t: ty, addr: { a: `$s${k}`, o: '0' }, cnst: true };
      }
      case 'id': {
        const v = lookup(e.name);
        if (v) {
          if (v.kind === 'var') { cost += sizeOf(v.ty) > 2 ? 2 : 1; return { c: v.js, t: v.ty }; }
          if (v.kind === 'arr') return { c: v.js, t: v.ty, addr: { a: v.js, o: '0' }, cnst: v.cnst };
        }
        if (sfr.regs[e.name]) { cost += 1; return { c: `R.r.${e.name}()`, t: sfr.regs[e.name].w === 16 ? U16 : U8 }; }
        if (sfr.flat[e.name]) { const lv = lvalue(e); cost += 1; return { c: lv.get, t: lv.t }; }
        if (funcs.has(e.name)) throw new CErr(`la fonction ${e.name} doit être appelée avec des parenthèses : ${e.name}()`, line);
        if (BUILTINS.has(e.name)) throw new CErr(`${e.name} doit être appelée avec des parenthèses : ${e.name}()`, line);
        throw undeclared(e.name, line);
      }
      case 'mem': { const lv = lvalue(e); cost += 1; return { c: lv.get, t: lv.t }; }
      case 'idx': {
        const base0 = gen(e.a); let base = base0, idx = gen(e.i);
        if (isAddr(idx.t) && !isAddr(base.t)) [base, idx] = [idx, base];
        if (!isAddr(base.t)) throw new CErr(`indexation [] sur une variable qui n'est ni un tableau ni un pointeur`, line);
        if (!isInt(idx.t)) throw new CErr('l\'indice d\'un tableau doit être un entier', line);
        const et = base.t.k === 'arr' ? base.t.of : base.t.to;
        cost += 4;
        if (et.k === 'arr') { // sous-tableau
          const n = scalarCount(et);
          if (base.t.k === 'arr') return { c: '', t: et, addr: { a: base.addr.a, o: `(${base.addr.o})+(${idx.c})*${n}` }, cnst: base.cnst };
          const tp = tmp(); return { c: '', t: et, addr: { a: `(${tp}=H.np(${base.c},${line})).a`, o: `${tp}.o+(${idx.c})*${n}` } };
        }
        if (base.t.k === 'arr') return { c: `H.ld(${base.addr.a},(${base.addr.o})+(${idx.c}),${line})`, t: et };
        const tp = tmp();
        return { c: `(${tp}=H.np(${base.c},${line}),H.ld(${tp}.a,${tp}.o+(${idx.c}),${line}))`, t: et };
      }
      case 'un': {
        if (e.op === '&') {
          const x = e.x;
          if (x.e === 'idx') { const r = binArith('+', gen(x.a), gen(x.i), line); return r; }
          const g = gen(x);
          if (g.t.k === 'arr') return { c: `H.mk(${g.addr.a},${g.addr.o})`, t: T.ptr(g.t.of) };
          throw new CErr('l\'opérateur & sur une variable simple n\'est pas supporté (passe plutôt par une variable globale ou un tableau)', line);
        }
        if (e.op === '*') { const lv = lvalue(e); return { c: `(${lv.prep}${lv.get})`, t: lv.t }; }
        const x = gen(e.x);
        if (e.op === '!') { cost += 2; return { c: `(${x.c}?0:1)`, t: S16 }; }
        if (!isArith(x.t)) throw new CErr(`opérateur ${e.op} sur un pointeur/tableau`, line);
        const t = isFlt(x.t) ? T.flt : promote(x.t);
        cost += costOp('+', t);
        if (e.op === '+') return { c: x.c, t };
        if (e.op === '-') return { c: wrap(t, `-(${x.c})`), t, constVal: x.constVal !== undefined ? -x.constVal : undefined };
        if (e.op === '~') { if (isFlt(t)) throw new CErr('~ sur un float', line); return { c: wrap(t, `~(${x.c})`), t }; }
        break;
      }
      case 'pre': case 'post': {
        const lv = lvalue(e.x);
        if (lv.cnst) throw new CErr('modification d\'une variable const', line);
        const d = e.op === '++' ? '+' : '-';
        if (lv.t.k === 'ptr') {
          const t1 = tmp();
          if (e.e === 'post') return { c: `(${lv.prep}${t1}=${lv.get},${lv.set(`H.mk(${t1}.a,${t1}.o${d}1)`)},${t1})`, t: lv.t };
          return { c: `(${lv.prep}${t1}=${lv.get},${lv.set(`H.mk(${t1}.a,${t1}.o${d}1)`)})`, t: lv.t };
        }
        cost += sizeOf(lv.t);
        const t1 = tmp();
        const nv = wrap(lv.t, `${t1}${d}1`);
        if (e.e === 'post') return { c: `(${lv.prep}${t1}=${lv.get},${lv.set(nv)},${t1})`, t: lv.t };
        return { c: `(${lv.prep}${t1}=${lv.get},${lv.set(nv)})`, t: lv.t };
      }
      case 'bin': return genBin(e);
      case 'asg': {
        const lv = lvalue(e.l);
        if (lv.cnst) throw new CErr('affectation d\'une variable const', line);
        const r = gen(e.r);
        cost += sizeOf(lv.t);
        if (e.op === '=') {
          if (lv.t.k === 'ptr') return { c: `(${lv.prep}${lv.set(`H.pc(${ptrValue(r, line)})`)})`, t: lv.t };
          checkNarrow(lv, r, line);
          return { c: `(${lv.prep}${lv.set(conv(r, lv.t, line))})`, t: lv.t };
        }
        const op = e.op.slice(0, -1);
        if (lv.t.k === 'ptr') {
          if (op !== '+' && op !== '-') throw new CErr(`${e.op} sur un pointeur`, line);
          const t1 = tmp(); return { c: `(${lv.prep}${t1}=${lv.get},${lv.set(`H.mk(${t1}.a,${t1}.o${op}(${r.c}))`)})`, t: lv.t };
        }
        const t1 = tmp();
        const res = binArith(op, { c: t1, t: lv.t }, r, line);
        return { c: `(${lv.prep}${t1}=${lv.get},${lv.set(conv(res, lv.t, line))})`, t: lv.t };
      }
      case 'cond': {
        const c = gen(e.c), a = gen(e.a), b = gen(e.b); cost += 3;
        if (isAddr(a.t) || isAddr(b.t)) return { c: `(${c.c}?${ptrValue(a, line)}:${ptrValue(b, line)})`, t: T.ptr(isAddr(a.t) ? (a.t.of || a.t.to) : (b.t.of || b.t.to)) };
        if (a.t.k === 'void' || b.t.k === 'void') return { c: `(${c.c}?${a.c}:${b.c})`, t: T.void };
        const t = arith(a.t, b.t);
        return { c: `(${c.c}?${conv(a, t, line)}:${conv(b, t, line)})`, t };
      }
      case 'comma': { const a = gen(e.l), b = gen(e.r); return { c: `(${a.c},${b.c})`, t: b.t, addr: b.addr }; }
      case 'cast': {
        const x = gen(e.x); cost += 1;
        if (e.ty.k === 'ptr') return { c: ptrValue(x, line), t: e.ty };
        if (e.ty.k === 'void') return { c: x.c, t: T.void };
        return { c: conv(x, e.ty, line), t: e.ty };
      }
      case 'sizeof': {
        if (e.ty) return { c: String(sizeOf(e.ty)), t: U16, constVal: sizeOf(e.ty) };
        const save = cost; const x = gen(e.x); cost = save;
        return { c: String(sizeOf(x.t)), t: U16, constVal: sizeOf(x.t) };
      }
      case 'call': return genCall(e);
    }
    throw new CErr('expression non supportée', line);
  }
  function checkNarrow(lv, r, line) {
    if (r.constVal !== undefined && lv.t.k === 'int' && lv.t.bits > 1 && lv.t.bits <= 16) {
      const max = lv.t.uns ? (1 << lv.t.bits) - 1 : (1 << (lv.t.bits - 1)) - 1, min = lv.t.uns ? -(1 << lv.t.bits - 1) : -(1 << (lv.t.bits - 1));
      if (r.constVal > max || r.constVal < min) warn(`la constante ${r.constVal} ne tient pas dans un ${tname(lv.t)} (max ${max}) : elle sera tronquée`, line);
    }
    if (lv.bitw && lv.bitw < 8 && r.constVal !== undefined && r.constVal >= (1 << lv.bitw)) warn(`valeur ${r.constVal} trop grande pour un champ de ${lv.bitw} bit(s)`, line);
  }
  function binArith(op, l, r, line) {
    if (isAddr(l.t) || isAddr(r.t)) {
      if ((op === '+' || op === '-') && isAddr(l.t) && isInt(r.t)) {
        const et = l.t.k === 'arr' ? l.t.of : l.t.to; const n = scalarCount(et);
        if (l.t.k === 'arr') return { c: `H.mk(${l.addr.a},(${l.addr.o})${op}(${r.c})*${n})`, t: T.ptr(et) };
        const tp = tmp(); return { c: `(${tp}=H.np(${l.c},${line}),H.mk(${tp}.a,${tp}.o${op}(${r.c})*${n}))`, t: T.ptr(et) };
      }
      if (op === '+' && isInt(l.t) && isAddr(r.t)) return binArith('+', r, l, line);
      if (op === '-' && isAddr(l.t) && isAddr(r.t)) { const a = ptrValue(l, line), b = ptrValue(r, line); return { c: `(H.np(${a},${line}).o-H.np(${b},${line}).o)`, t: S16 }; }
      throw new CErr(`opérateur ${op} invalide entre ${tname(l.t)} et ${tname(r.t)}`, line);
    }
    if (l.t.k === 'void' || r.t.k === 'void') throw new CErr('une fonction void ne renvoie pas de valeur', line);
    const isShift = op === '<<' || op === '>>';
    const t = isShift ? (isFlt(l.t) ? null : promote(l.t)) : arith(l.t, r.t);
    if (!t || (isFlt(t) && ['%', '<<', '>>', '&', '|', '^'].includes(op))) throw new CErr(`l'opérateur ${op} n'accepte pas de float`, line);
    cost += costOp(op, t);
    const L = isShift ? l.c : conv(l, t, line), Rr = isShift ? r.c : conv(r, t, line);
    if (isFlt(t)) return { c: `Math.fround((${L})${op}(${Rr}))`, t };
    let c;
    switch (op) {
      case '*': c = t.bits === 32 ? `Math.imul(${L},${Rr})` : `(${L})*(${Rr})`; break;
      case '/': c = `H.div(${L},${Rr},${line})`; break;
      case '%': c = `H.mod(${L},${Rr},${line})`; break;
      case '>>': c = t.uns ? `(${L})>>>(${Rr})` : `(${L})>>(${Rr})`; break;
      default: c = `(${L})${op}(${Rr})`;
    }
    let cv; if (l.constVal !== undefined && r.constVal !== undefined) { try { cv = Function('H', 'return ' + wrap(t, c))(HC); if (!Number.isFinite(cv)) cv = undefined; } catch (e) { cv = undefined; } }
    if (cv !== undefined && ['+', '-', '*', '<<'].includes(op) && t.k === 'int') {
      const exact = op === '+' ? l.constVal + r.constVal : op === '-' ? l.constVal - r.constVal : op === '*' ? l.constVal * r.constVal : l.constVal * Math.pow(2, r.constVal);
      if (exact !== cv) warn(`dépassement : ${l.constVal} ${op} ${r.constVal} = ${exact} ne tient pas dans un ${tname(t)} (${t.bits} bits) → ${cv}. Ajoute un suffixe L ou un cast (unsigned long)`, line);
    }
    return { c: wrap(t, c), t, constVal: cv };
  }
  function genBin(e) {
    const line = e.line, op = e.op;
    if (op === '&&' || op === '||') { const a = gen(e.l), b = gen(e.r); cost += 3; return { c: `((${a.c})${op}(${b.c})?1:0)`, t: S16 }; }
    const l = gen(e.l), r = gen(e.r);
    if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
      const jop = op === '==' ? '===' : op === '!=' ? '!==' : op;
      if (isAddr(l.t) || isAddr(r.t)) {
        const a = ptrValue(l, line), b = ptrValue(r, line); cost += 4;
        if (op === '==' || op === '!=') return { c: `(H.peq(${a},${b})${op === '==' ? '?1:0' : '?0:1'})`, t: S16 };
        return { c: `((H.np(${a},${line}).o${jop}H.np(${b},${line}).o)?1:0)`, t: S16 };
      }
      const t = arith(l.t, r.t); cost += costOp(op, t);
      if (t.k === 'int' && l.t.uns !== r.t.uns && t.uns) {
        const neg = (l.constVal < 0 ? l : r.constVal < 0 ? r : null);
        if (neg) warn(`comparaison entre un ${tname(l.t === neg.t ? r.t : l.t)} (non signé) et une valeur négative : toujours vraie/fausse`, line);
      }
      if (t.k === 'int' && l.t.k === 'int' && l.t.bits <= 8 && r.constVal !== undefined && (r.constVal > (l.t.uns ? 255 : 127))) warn(`comparaison d'un ${tname(l.t)} avec ${r.constVal} : un ${tname(l.t)} ne dépasse jamais ${l.t.uns ? 255 : 127}`, line);
      return { c: `((${conv(l, t, line)})${jop}(${conv(r, t, line)})?1:0)`, t: S16 };
    }
    return binArith(op, l, r, line);
  }
  function genCall(e) {
    const line = e.line;
    if (e.f.e !== 'id') throw new CErr('appel indirect de fonction non supporté', line);
    const name = e.f.name;
    const fn = funcs.get(name);
    if (!fn && BUILTINS.has(name)) return genBuiltin(name, e.args, line);
    if (!fn) {
      if (lookup(name)) throw new CErr(`${name} n'est pas une fonction`, line);
      throw new CErr(`fonction « ${name} » non déclarée${/^lcd|^LCD|^Lcd/.test(name) ? ' (il faut écrire toi-même les fonctions LCD dans ce fichier)' : ''}`, line);
    }
    const ps = fn.ty.params;
    if (e.args.length !== ps.length) throw new CErr(`${name}() attend ${ps.length} argument(s), ${e.args.length} donné(s)`, line, `error: too ${e.args.length < ps.length ? 'few' : 'many'} arguments to function call, expected ${ps.length}, have ${e.args.length}`);
    if (fn.isr) throw new CErr('on n\'appelle pas une routine d\'interruption directement', line);
    const args = e.args.map((a, i) => { const g = gen(a); return ps[i].ty.k === 'ptr' ? `H.pc(${ptrValue(g, line)})` : conv(g, ps[i].ty, line); });
    cost += 4 + 2 * ps.length;
    return { c: `(yield* ${fn.js}(${args.join(',')}))`, t: fn.ty.ret, call: true };
  }
  function strArg(a, line, what) {
    if (a.e !== 'str') throw new CErr(`${what} attend une chaîne entre guillemets`, line);
    return String.fromCharCode(...a.v);
  }
  function countAsm(s) {
    let n = 0;
    for (const part of s.split(/[;\n]/)) {
      const w = part.trim().split(/\s+/)[0].toLowerCase(); if (!w) continue;
      n += /^(goto|call|return|retfie|retlw|bra|rcall)$/.test(w) ? 2 : 1;
    }
    return Math.max(n, 1);
  }
  function genBuiltin(name, args, line) {
    const need = n => { if (args.length !== n) throw new CErr(`${name}() attend ${n} argument(s)`, line); };
    switch (name) {
      case 'Nop': case 'NOP': case '__nop': need(0); return { c: 'H.cyc(1)', t: T.void, delay: true };
      case 'CLRWDT': case 'ClrWdt': need(0); return { c: 'H.cyc(1)', t: T.void };
      case 'SLEEP': case 'Sleep': need(0); return { c: '(yield* H.sleep())', t: T.void };
      case 'RESET': case 'Reset': need(0); return { c: 'H.reset()', t: T.void };
      case 'di': need(0); return { c: 'R.wb("INTCON",7,1,0)', t: T.void };
      case 'ei': need(0); return { c: 'R.wb("INTCON",7,1,1)', t: T.void };
      case '__asmi': case 'asm': case '__asm': case '__asm__': {
        need(1); const s = strArg(args[0], line, name);
        return { c: `(yield* H.delay(${countAsm(s)}))`, t: T.void, delay: true };
      }
      case '__delay_ms': case '__delay_us': {
        need(1);
        if (!prog.xtal) throw new CErr(`${name} nécessite #define _XTAL_FREQ (ex : #define _XTAL_FREQ 8000000) avant son utilisation`, line);
        const x = gen(args[0]);
        if (x.constVal === undefined) warn(`${name} avec une variable : XC8 exige une constante (erreur de compilation sur MPLAB)`, line);
        const k = name === '__delay_ms' ? prog.xtal / 4000 : prog.xtal / 4000000;
        return { c: `(yield* H.delay(Math.round((${x.c})*${k})))`, t: T.void, delay: true };
      }
      case '_delay': { need(1); const x = gen(args[0]); return { c: `(yield* H.delay(${x.c}))`, t: T.void, delay: true }; }
      case 'Delay1TCY': return { c: `(yield* H.delay(1))`, t: T.void };
      case 'Delay10TCYx': case 'Delay100TCYx': case 'Delay1KTCYx': case 'Delay10KTCYx': {
        need(1); const m = { Delay10TCYx: 10, Delay100TCYx: 100, Delay1KTCYx: 1000, Delay10KTCYx: 10000 }[name]; const x = gen(args[0]);
        return { c: `(yield* H.delay(((${x.c})&255||256)*${m}))`, t: T.void, delay: true };
      }
      case 'abs': case 'labs': { need(1); const x = gen(args[0]); cost += 4; return { c: wrap(promote(x.t), `Math.abs(${x.c})`), t: promote(x.t) }; }
      case 'printf': { const fmt = args[0] && args[0].e === 'str' ? String.fromCharCode(...args[0].v) : ''; const rest = args.slice(1).map(a => gen(a)); return { c: `H.printf(${JSON.stringify(fmt)},[${rest.map(r => r.c).join(',')}])`, t: S16 }; }
    }
  }

  // ---- statements ----
  let loopDepth = 0, switchDepth = 0;
  function costStmt(c) { return c ? `S.C+=${c};` : ''; }
  function genStmt(s, ind) {
    const pad = '  '.repeat(ind);
    const L = `S.L=${s.line};`;
    switch (s.s) {
      case 'empty': return;
      case 'block': fnState.scopes.push(new Map()); for (const x of s.body) genStmt(x, ind); fnState.scopes.pop(); return;
      case 'expr': { cost = 0; const x = gen(s.x); emit(`${pad}${L}${costStmt(cost)}${x.c};`); return; }
      case 'asm': emit(`${pad}${L}yield* H.delay(${s.n});`); return;
      case 'decl': for (const d of s.decls) genLocalDecl(d, pad, L); return;
      case 'if': {
        cost = 0; const c = gen(s.c); cost += 2;
        emit(`${pad}${L}S.C+=${cost};if(${c.c}){`);
        fnState.scopes.push(new Map()); genStmt(s.a, ind + 1); fnState.scopes.pop();
        if (s.b) { emit(`${pad}}else{`); fnState.scopes.push(new Map()); genStmt(s.b, ind + 1); fnState.scopes.pop(); }
        emit(`${pad}}`); return;
      }
      case 'while': {
        cost = 0; const c = gen(s.c); const k = cost + 2;
        emit(`${pad}${L}while((S.C>=S.N?(yield* H.ev()):0,S.L=${s.line},S.C+=${k},${c.c})){`);
        loopDepth++; fnState.scopes.push(new Map()); genStmt(s.body, ind + 1); fnState.scopes.pop(); loopDepth--;
        emit(`${pad}}`); return;
      }
      case 'do': {
        emit(`${pad}${L}do{`);
        loopDepth++; fnState.scopes.push(new Map()); genStmt(s.body, ind + 1); fnState.scopes.pop(); loopDepth--;
        cost = 0; const c = gen(s.c); const k = cost + 2;
        emit(`${pad}}while((S.C>=S.N?(yield* H.ev()):0,S.L=${s.line},S.C+=${k},${c.c}));`); return;
      }
      case 'for': {
        fnState.scopes.push(new Map());
        emit(`${pad}{`);
        if (s.init) genStmt(s.init, ind + 1);
        cost = 0; const c = s.c ? gen(s.c) : { c: '1' }; const kc = cost + 2;
        cost = 0; const u = s.upd ? gen(s.upd) : null; const ku = cost + 2;
        emit(`${pad}for(;(S.C>=S.N?(yield* H.ev()):0,S.L=${s.line},S.C+=${kc},${c.c});${u ? `S.C+=${ku},${u.c}` : `S.C+=2`}){`);
        loopDepth++; fnState.scopes.push(new Map()); genStmt(s.body, ind + 1); fnState.scopes.pop(); loopDepth--;
        emit(`${pad}}}`);
        fnState.scopes.pop(); return;
      }
      case 'switch': {
        cost = 0; const c = gen(s.c); cost += 6;
        if (s.body.s !== 'block') throw new CErr('le corps du switch doit être un bloc { }', s.line);
        emit(`${pad}${L}S.C+=${cost};switch(${conv(c, promote(c.t), s.line)}){`);
        switchDepth++; fnState.scopes.push(new Map());
        const seen = new Set();
        for (const x of s.body.body) {
          if (x.s === 'case') { if (seen.has(x.v)) throw new CErr(`case ${x.v} en double`, x.line); seen.add(x.v); emit(`${pad}case ${x.v}:S.C+=2;`); }
          else if (x.s === 'default') emit(`${pad}default:`);
          else genStmt(x, ind + 1);
        }
        fnState.scopes.pop(); switchDepth--;
        emit(`${pad}}`); return;
      }
      case 'case': case 'default': throw new CErr(`« ${s.s} » en dehors d'un switch`, s.line);
      case 'break': if (!loopDepth && !switchDepth) throw new CErr('break en dehors d\'une boucle ou d\'un switch', s.line); emit(`${pad}${L}S.C+=2;break;`); return;
      case 'continue': if (!loopDepth) throw new CErr('continue en dehors d\'une boucle', s.line); emit(`${pad}${L}S.C+=2;continue;`); return;
      case 'return': {
        const rt = fnState.ret;
        if (s.x) {
          if (rt.k === 'void') throw new CErr('return avec une valeur dans une fonction void', s.line);
          cost = 0; const x = gen(s.x); const v = rt.k === 'ptr' ? `H.pc(${ptrValue(x, s.line)})` : conv(x, rt, s.line);
          emit(`${pad}${L}S.C+=${cost + 3};return ${v};`);
        } else { if (rt.k !== 'void') warn('return sans valeur dans une fonction qui doit renvoyer une valeur', s.line); emit(`${pad}${L}S.C+=3;return 0;`); }
        return;
      }
    }
    throw new CErr('instruction non supportée', s.line);
  }
  function initArray(ty, init, line, isConstCtx) {
    // renvoie code JS d'un tableau typé initialisé
    let n = ty.n; const et = baseElem(ty);
    const flat = [];
    if (init) {
      if (init.e === 'str') {
        if (!(ty.of.k === 'int' && ty.of.bits === 8)) throw new CErr('une chaîne ne peut initialiser qu\'un tableau de char', line);
        if (n === null) n = init.v.length + 1;
        if (init.v.length > n) throw new CErr(`chaîne trop longue pour le tableau (${init.v.length} caractères, place pour ${n})`, line);
        for (const c of init.v) flat.push(String(c));
        if (init.v.length === n) warn('pas de place pour le \\0 final de la chaîne', line);
      } else if (init.list) {
        const fill = (t, it, out) => {
          if (t.k === 'arr') {
            const cnt = scalarCount(t.of); const items = it.list || [it];
            const nn = t.n === null ? items.length : t.n;
            if (items.length > nn) throw new CErr(`trop de valeurs d'initialisation (${items.length} pour ${nn} cases)`, line);
            items.forEach((x, i) => { const sub = []; if (t.of.k === 'arr') fill(t.of, x, sub); else sub.push(scalar(x)); while (sub.length < cnt) sub.push('0'); out.push(...sub); });
            for (let i = items.length; i < nn; i++) for (let j = 0; j < cnt; j++) out.push('0');
            return nn;
          }
        };
        const scalar = x => {
          if (x.list) { if (x.list.length !== 1) throw new CErr('accolades en trop dans l\'initialisation', line); x = x.list[0]; }
          if (et.k === 'ptr') { cost = 0; const g = gen(x); return ptrValue(g, line); }
          cost = 0; const g = gen(x); return conv(g, et, line);
        };
        const nn = fill(n === null ? T.arr(ty.of, null) : ty, init, flat);
        if (n === null) n = nn;
      } else throw new CErr('un tableau s\'initialise avec { ... } ou une chaîne', line);
    }
    if (n === null) throw new CErr('taille du tableau manquante', line);
    const total = n * scalarCount(ty.of);
    const C = arrCtor(et);
    const fullTy = T.arr(ty.of, n);
    if (!flat.length) return { code: C === 'Array' ? `new Array(${total}).fill(null)` : `new ${C}(${total})`, ty: fullTy };
    return { code: C === 'Array' ? `H.fillA([${flat.join(',')}],${total})` : `H.fillT(${C},[${flat.join(',')}],${total})`, ty: fullTy };
  }
  function genLocalDecl(d, pad, L) {
    const scope = fnState.scopes[fnState.scopes.length - 1];
    if (scope.has(d.name)) throw new CErr(`« ${d.name} » est déjà déclaré dans ce bloc`, d.line);
    if (d.ty.k === 'void') throw new CErr(`variable ${d.name} de type void`, d.line);
    if (d.ty.k === 'func') throw new CErr('déclaration de fonction dans une fonction non supportée', d.line);
    const js = `v_${id(d.name)}_${uid++}`;
    if (d.stat) {
      // variable statique : globale cachée
      if (d.ty.k === 'arr') { const a = initArray(d.ty, d.init, d.line); statics.push(`let ${js}=${a.code};`); scope.set(d.name, { kind: 'arr', js, ty: a.ty, cnst: d.cnst }); }
      else { let v = '0'; if (d.init) { const save = fnState; cost = 0; const g = gen(d.init); v = d.ty.k === 'ptr' ? ptrValue(g, d.line) : conv(g, d.ty, d.line); } statics.push(`let ${js}=${v};`); scope.set(d.name, { kind: 'var', js, ty: d.ty, cnst: d.cnst }); }
      return;
    }
    if (d.ty.k === 'arr') {
      cost = 0; const a = initArray(d.ty, d.init, d.line);
      emit(`${pad}${L}S.C+=${2 + sizeOf(a.ty)};let ${js}=${a.code};`);
      scope.set(d.name, { kind: 'arr', js, ty: a.ty, cnst: d.cnst });
      return;
    }
    let v = d.ty.k === 'ptr' ? 'null' : '0';
    cost = 0;
    if (d.init) {
      if (d.init.list) throw new CErr('accolades { } pour une variable simple', d.line);
      const g = gen(d.init); if (d.ty.k !== 'ptr') checkNarrow({ t: d.ty }, g, d.line);
      v = d.ty.k === 'ptr' ? `H.pc(${ptrValue(g, d.line)})` : conv(g, d.ty, d.line); cost += sizeOf(d.ty);
    }
    emit(`${pad}${L}${costStmt(cost)}let ${js}=${v};`);
    scope.set(d.name, { kind: 'var', js, ty: d.ty, cnst: d.cnst });
  }

  // ---- globales ----
  const globDecl = [], globInit = [], watch = [];
  fnState = { scopes: [], ntmp: 0, ret: T.void };
  for (const g of prog.globals) {
    if (g.proto) continue;
    if (sfr.regs[g.name] || sfr.bits[g.name]) throw new CErr(`${g.name} est un registre du PIC, choisis un autre nom`, g.line);
    if (globalScope.has(g.name)) { if (g.ext) continue; throw new CErr(`la variable globale ${g.name} est déclarée deux fois`, g.line); }
    if (g.ty.k === 'void') throw new CErr(`variable ${g.name} de type void`, g.line);
    const js = `g_${id(g.name)}`;
    if (g.ty.k === 'arr') {
      const a = initArray(g.ty, g.init, g.line);
      globDecl.push(`let ${js};`); globInit.push(`${js}=${a.code};`);
      globalScope.set(g.name, { kind: 'arr', js, ty: a.ty, cnst: g.cnst });
      watch.push({ name: g.name, js, ty: a.ty, arr: true });
    } else {
      globalScope.set(g.name, { kind: 'var', js, ty: g.ty, cnst: g.cnst });
      globDecl.push(`let ${js}=${g.ty.k === 'ptr' ? 'null' : '0'};`);
      if (g.init) {
        if (g.init.list) throw new CErr('accolades { } pour une variable simple', g.line);
        cost = 0; const x = gen(g.init); if (g.ty.k !== 'ptr') checkNarrow({ t: g.ty }, x, g.line);
        globInit.push(`${js}=${g.ty.k === 'ptr' ? `H.pc(${ptrValue(x, g.line)})` : conv(x, g.ty, g.line)};`);
      }
      watch.push({ name: g.name, js, ty: g.ty });
    }
  }
  const initTmps = fnState.ntmp;

  // ---- fonctions ----
  const fnCodes = [];
  let isrH = null, isrL = null;
  for (const f of prog.funcs) {
    const info = funcs.get(f.name);
    if (f.isr) {
      if (f.ty.params.length) throw new CErr('une routine d\'interruption ne prend pas de paramètre (void)', f.line);
      if (f.low) { if (isrL) throw new CErr('deux routines d\'interruption basse priorité', f.line); isrL = info.js; }
      else { if (isrH) throw new CErr('deux routines d\'interruption haute priorité', f.line); isrH = info.js; }
    }
    fnState = { scopes: [new Map()], ntmp: 0, ret: f.ty.ret };
    const params = f.ty.params.map(pp => { if (!pp.name) throw new CErr('paramètre sans nom', f.line); const js = `p_${id(pp.name)}_${uid++}`; fnState.scopes[0].set(pp.name, { kind: 'var', js, ty: pp.ty }); return js; });
    const start = lines.length;
    loopDepth = 0; switchDepth = 0;
    genStmt(f.body, 1);
    const body = lines.splice(start);
    const tmps = Array.from({ length: fnState.ntmp }, (_, i) => '$t' + i);
    fnCodes.push(`function* ${info.js}(${params.join(',')}){\n  ${tmps.length ? 'let ' + tmps.join(',') + ';' : ''}S.C+=2;if(S.C>=S.N)yield* H.ev();S.depth++;if(S.depth>31)H.stack(${f.line});try{\n${body.join('\n')}\n  }finally{S.depth--;}\n  return 0;}`);
  }
  for (const [n, f] of funcs) if (!f.defined) {
    // utilisée ?
    fnCodes.push(`function* ${f.js}(){H.undef("${n}");}`);
  }
  const main = funcs.get('main');
  if (!main || !main.defined) throw new CErr('fonction main() introuvable', 1);
  if (main.ty.params.length) warn('main() ne devrait pas avoir de paramètres sur un PIC', main.line);

  const strs = strPool.map((s, i) => `const $s${i}=new Uint8Array([${s.join(',')}]);`);
  const initT = Array.from({ length: initTmps }, (_, i) => '$t' + i);
  const js = `"use strict";
${strs.join('\n')}
${globDecl.join('\n')}
${statics.join('\n')}
${fnCodes.join('\n')}
function* $init(){${initT.length ? 'let ' + initT.join(',') + ';' : ''}${globInit.join('\n')}}
return {
  init:$init, main:${main.js}, isrH:${isrH || 'null'}, isrL:${isrL || 'null'},
  watch:()=>[${watch.map(w => `[${JSON.stringify(w.name)},${w.js}]`).join(',')}]
};`;
  return { js, watchInfo: watch.map(w => ({ name: w.name, ty: tname(w.ty), arr: !!w.arr, t: w.ty })), hasIsrH: !!isrH, hasIsrL: !!isrL };
}

function compile(src, sfr) {
  const warnings = [];
  const warn = (msg, line) => warnings.push({ msg, line });
  const { toks, info } = preprocess(src, warn);
  const prog = parse(toks);
  for (const pr of info.pragmas) {
    const m = /^interrupt(low)?\s+(\w+)/.exec(pr.trim());
    if (m) { const f = prog.funcs.find(f => f.name === m[2]); if (f) { f.isr = true; f.low = !!m[1]; } }
  }
  if (info.pragmas.some(p => /^code\b/.test(p.trim()))) warn('Syntaxe C18 (#pragma code / #pragma interrupt) : acceptée ici, mais sur MPLAB X avec XC8 il faut écrire void __interrupt() isr(void)', 0);
  const xm = info.macros.get('_XTAL_FREQ');
  if (xm && xm.body.length && xm.body[0].t === 'num') prog.xtal = xm.body[0].v;
  for (const pr of info.pragmas) { if (/\bWDT\s*=\s*ON\b/i.test(pr)) warn('#pragma config WDT = ON : le chien de garde n\'est pas simulé (mets WDT = OFF)', 0); }
  const out = generate(prog, sfr, warn);
  const seen = new Set();
  out.warnings = warnings.filter(w => { const k = w.msg + w.line; if (seen.has(k)) return false; seen.add(k); return true; });
  out.xtal = prog.xtal || null; out.pragmas = info.pragmas;
  return out;
}
return { compile, CErr, tname };
})();
export default CC;
