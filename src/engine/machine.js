// ===================== Machine PIC18F452 + modules =====================
const PICM = (() => {
const PORTS = ['A', 'B', 'C', 'D', 'E'];
const PMASK = [0x3F, 0xFF, 0xFF, 0xFF, 0x07];
const pinName = p => 'R' + PORTS[p >> 3] + (p & 7);
const pinIdx = n => { const m = /^R([A-E])(\d)$/.exec(n); return m ? PORTS.indexOf(m[1]) * 8 + +m[2] : null; };
const ALL_PINS = []; PORTS.forEach((P, i) => { for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1) ALL_PINS.push(i * 8 + b); });
const AN_PINS = ['RA0', 'RA1', 'RA2', 'RA3', 'RA5', 'RE0', 'RE1', 'RE2'].map(pinIdx);
// PCFG : chaîne AN7..AN0 ; A analogique, D numérique, + Vref+, - Vref-
const PCFG = ['AAAAAAAA', 'AAAA+AAA', 'DDDAAAAA', 'DDDA+AAA', 'DDDDADAA', 'DDDD+DAA', 'DDDDDDDD', 'DDDDDDDD', 'AAAA+-AA', 'DDAAAAAA', 'DDAA+AAA', 'DDAA+-AA', 'DDDA+-AA', 'DDDD+-AA', 'DDDDDDDA', 'DDDD+-DA'];

// ---------- Description des SFR pour le compilateur ----------
function buildSFR() {
  const regs = {}, bits = {}, flat = {};
  const R = (n, w = 8) => regs[n] = { w };
  PORTS.forEach(P => { R('PORT' + P); R('LAT' + P); R('TRIS' + P); });
  ['INTCON', 'INTCON2', 'INTCON3', 'T0CON', 'TMR0L', 'TMR0H', 'T1CON', 'TMR1L', 'TMR1H', 'T2CON', 'TMR2', 'PR2', 'PIR1', 'PIE1', 'IPR1', 'PIR2', 'PIE2', 'IPR2', 'RCON',
    'ADCON0', 'ADCON1', 'ADRESH', 'ADRESL', 'STATUS', 'WREG', 'OSCCON', 'CCP1CON', 'CCPR1L', 'CCPR1H', 'CCP2CON', 'CCPR2L', 'CCPR2H', 'T3CON', 'TMR3L', 'TMR3H',
    'SSPCON1', 'SSPCON2', 'SSPSTAT', 'SSPBUF', 'SSPADD', 'TXSTA', 'RCSTA', 'SPBRG', 'TXREG', 'RCREG', 'LVDCON', 'WDTCON', 'EECON1', 'EECON2', 'EEADR', 'EEDATA', 'BSR', 'FSR0L', 'FSR0H', 'PRODL', 'PRODH'].forEach(n => R(n));
  R('SSPCON', 8); R('TMR0', 16); R('TMR1', 16); R('ADRES', 16); R('TMR3', 16); R('CCPR1', 16);
  const B = (reg, defs) => { const o = bits[reg + 'bits'] = bits[reg + 'bits'] || {}; for (const [names, pos, w] of defs) for (const n of names.split('/')) { o[n] = [reg, pos, w || 1]; if (!(n in flat)) flat[n] = [reg, pos, w || 1]; } };
  PORTS.forEach((P, i) => {
    const d = []; for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1 || (P === 'A' && b === 6)) d.push(['R' + P + b, b]);
    B('PORT' + P, d);
  });
  PORTS.forEach((P, i) => { const d = []; for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1 || (P === 'A' && b === 6)) d.push([`LAT${P}${b}/L${P}${b}`, b]); B('LAT' + P, d); });
  PORTS.forEach((P, i) => { const d = []; for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1 || (P === 'A' && b === 6)) d.push([`TRIS${P}${b}`, b]); B('TRIS' + P, d); });
  // alias TRISBbits.RB0 (sans les mettre en flat car déjà pris par PORT)
  PORTS.forEach((P, i) => { for (let b = 0; b < 8; b++) if (PMASK[i] >> b & 1) bits['TRIS' + P + 'bits']['R' + P + b] = ['TRIS' + P, b, 1]; });
  bits.TRISEbits.PSPMODE = ['TRISE', 4, 1]; bits.TRISEbits.IBOV = ['TRISE', 5, 1];
  B('INTCON', [['RBIF', 0], ['INT0IF/INT0F', 1], ['TMR0IF/T0IF', 2], ['RBIE', 3], ['INT0IE/INT0E', 4], ['TMR0IE/T0IE', 5], ['PEIE/GIEL', 6], ['GIE/GIEH', 7]]);
  B('INTCON2', [['RBIP', 0], ['TMR0IP/T0IP', 2], ['INTEDG2', 4], ['INTEDG1', 5], ['INTEDG0', 6], ['RBPU/nRBPU/NOT_RBPU', 7]]);
  B('INTCON3', [['INT1IF/INT1F', 0], ['INT2IF/INT2F', 1], ['INT1IE/INT1E', 3], ['INT2IE/INT2E', 4], ['INT1IP/INT1P', 6], ['INT2IP/INT2P', 7]]);
  B('T0CON', [['T0PS0', 0], ['T0PS1', 1], ['T0PS2', 2], ['T0PS', 0, 3], ['PSA', 3], ['T0SE', 4], ['T0CS', 5], ['T08BIT', 6], ['TMR0ON', 7]]);
  B('T1CON', [['TMR1ON', 0], ['TMR1CS', 1], ['T1SYNC/nT1SYNC/NOT_T1SYNC', 2], ['T1OSCEN', 3], ['T1CKPS0', 4], ['T1CKPS1', 5], ['T1CKPS', 4, 2], ['RD16', 7]]);
  B('T2CON', [['T2CKPS0', 0], ['T2CKPS1', 1], ['T2CKPS', 0, 2], ['TMR2ON', 2], ['TOUTPS0', 3], ['TOUTPS1', 4], ['TOUTPS2', 5], ['TOUTPS3', 6], ['TOUTPS/T2OUTPS', 3, 4]]);
  B('PIR1', [['TMR1IF', 0], ['TMR2IF', 1], ['CCP1IF', 2], ['SSPIF', 3], ['TXIF', 4], ['RCIF', 5], ['ADIF', 6], ['PSPIF', 7]]);
  B('PIE1', [['TMR1IE', 0], ['TMR2IE', 1], ['CCP1IE', 2], ['SSPIE', 3], ['TXIE', 4], ['RCIE', 5], ['ADIE', 6], ['PSPIE', 7]]);
  B('IPR1', [['TMR1IP', 0], ['TMR2IP', 1], ['CCP1IP', 2], ['SSPIP', 3], ['TXIP', 4], ['RCIP', 5], ['ADIP', 6], ['PSPIP', 7]]);
  B('PIR2', [['CCP2IF', 0], ['TMR3IF', 1], ['LVDIF', 2], ['BCLIF', 3], ['EEIF', 4]]);
  B('PIE2', [['CCP2IE', 0], ['TMR3IE', 1], ['LVDIE', 2], ['BCLIE', 3], ['EEIE', 4]]);
  B('IPR2', [['CCP2IP', 0], ['TMR3IP', 1], ['LVDIP', 2], ['BCLIP', 3], ['EEIP', 4]]);
  B('RCON', [['BOR/nBOR', 0], ['POR/nPOR', 1], ['PD/nPD', 2], ['TO/nTO', 3], ['RI/nRI', 4], ['IPEN', 7]]);
  B('ADCON0', [['ADON', 0], ['GO_DONE/GO/DONE/GO_nDONE/NOT_DONE/nDONE/GODONE', 2], ['CHS0', 3], ['CHS1', 4], ['CHS2', 5], ['CHS', 3, 3], ['ADCS0', 6], ['ADCS1', 7], ['ADCS', 6, 2]]);
  B('ADCON1', [['PCFG0', 0], ['PCFG1', 1], ['PCFG2', 2], ['PCFG3', 3], ['PCFG', 0, 4], ['ADCS2', 6], ['ADFM', 7]]);
  B('SSPSTAT', [['BF', 0], ['UA', 1], ['R_W/R_NOT_W/RW', 2], ['S', 3], ['P', 4], ['D_A/D_NOT_A', 5], ['CKE', 6], ['SMP', 7]]);
  B('SSPCON1', [['SSPM0', 0], ['SSPM1', 1], ['SSPM2', 2], ['SSPM3', 3], ['SSPM', 0, 4], ['CKP', 4], ['SSPEN', 5], ['SSPOV', 6], ['WCOL', 7]]);
  B('CCP1CON', [['CCP1M0', 0], ['CCP1M1', 1], ['CCP1M2', 2], ['CCP1M3', 3], ['CCP1M', 0, 4], ['DC1B0', 4], ['DC1B1', 5], ['DC1B', 4, 2]]);
  B('CCP2CON', [['CCP2M0', 0], ['CCP2M1', 1], ['CCP2M2', 2], ['CCP2M3', 3], ['CCP2M', 0, 4], ['DC2B0', 4], ['DC2B1', 5], ['DC2B', 4, 2]]);
  delete flat.S; delete flat.P; delete flat.BF; delete flat.UA;
  B('STATUS', [['C', 0], ['DC', 1], ['Z', 2], ['OV', 3], ['N', 4]]);
  delete flat.C; delete flat.Z; delete flat.N; delete flat.DC; delete flat.OV; // trop génériques
  return { regs, bits, flat };
}
const SFR = buildSFR();

class RTErr extends Error { constructor(msg, line) { super(msg); this.line = line; } }

// ---------- PIC ----------
class PIC {
  constructor(bench, log) {
    this.bench = bench; this.log = log || (() => { });
    this.S = { C: 0, N: 0, L: 0, depth: 0, frameEnd: 0 };
    this.fosc = 8e6; this.prog = null; this.once = new Set();
    this.buildR(); this.reset();
  }
  warnOnce(key, msg, line) { if (this.once.has(key)) return; this.once.add(key); this.log('warn', msg, line); }
  reset() {
    const S = this.S; S.C = 0; S.N = 0; S.L = 0; S.depth = 0; S.frameEnd = 0;
    this.lat = [0, 0, 0, 0, 0]; this.tris = [0x7F, 0xFF, 0xFF, 0xFF, 0x07];
    this.reg = {};
    for (const n in SFR.regs) this.reg[n] = 0;
    Object.assign(this.reg, { INTCON2: 0xFF, INTCON3: 0xC0, T0CON: 0xFF, PR2: 0xFF, IPR1: 0xFF, IPR2: 0xFF, RCON: 0x1C, TXSTA: 0x02 });
    this.t0 = { val: 0, acc: 0, hbuf: 0 }; this.t1 = { val: 0, acc: 0, hbuf: 0 }; this.t2 = { acc: 0, post: 0 };
    this.adcDone = Infinity; this.sspDone = Infinity; this.sspTx = 0; this.lastC = 0; this.inH = false; this.inL = false;
    this.rbLatch = 0; this.prevIn = {};
    this.once = new Set(); this.sleeping = false;
  }
  get fcy() { return this.fosc / 4; }
  // ----- broches -----
  pinOut(p) {
    const P = p >> 3, b = p & 7; if (this.tris[P] >> b & 1) return null;
    if (p === 18 && this.pwmActive()) { const w = this.pwm(); return (this.S.C % w.T) < w.Th ? 1 : 0; }
    return this.lat[P] >> b & 1;
  }
  pwmActive() { return (this.reg.CCP1CON & 0x0C) === 0x0C && (this.reg.T2CON & 4); }
  pwm() { const r = this.reg, ps = [1, 4, 16, 16][r.T2CON & 3]; const T = (r.PR2 + 1) * ps; const Th = Math.min(T, (((r.CCPR1L << 2) | ((r.CCP1CON >> 4) & 3)) * ps) / 4); return { T, Th, f: this.fcy / T }; }
  isAnalog(p) {
    const i = AN_PINS.indexOf(p); if (i < 0) return false;
    const c = PCFG[this.reg.ADCON1 & 15][7 - i]; return c !== 'D';
  }
  readPort(P, wmask) {
    wmask = wmask || 0;
    let v = 0;
    for (let b = 0; b < 8; b++) {
      if (!(PMASK[P] >> b & 1)) continue;
      const p = P * 8 + b;
      if (this.tris[P] >> b & 1) {
        if (this.isAnalog(p)) { if ((wmask >> b & 1) || this.bench.byPin[p]) this.warnOnce('an' + p, `${pinName(p)} est configurée en entrée analogique (ADCON1) : en numérique elle se lit toujours 0. Mets par ex. ADCON1 = 0x07 pour passer le port A/E en numérique.`, this.S.L); continue; }
        let lv = this.bench.extLevel(p, this);
        if (lv === null) { if (P === 1 && !(this.reg.INTCON2 & 0x80)) lv = 1; else { lv = 0; if (wmask >> b & 1) this.warnOnce('fl' + p, `${pinName(p)} est lue en entrée mais rien n'y est branché (entrée flottante, lue 0 ici)`, this.S.L); } }
        v |= lv << b;
      } else {
        v |= (this.lat[P] >> b & 1) << b;
      }
    }
    if (P === 1) this.rbLatch = v;
    return v;
  }
  chkOut(P, v) {
    const ch = (v ^ this.lat[P]) & this.tris[P] & PMASK[P];
    if (!ch) return;
    for (let b = 0; b < 8; b++) if (ch >> b & 1) { const p = P * 8 + b; const l = this.bench.byPin[p]; if (l && l.some(([m]) => m === 'seg7' || m === 'lcd' || (m === 'keypad'))) this.warnOnce('tr' + p, `Écriture sur ${pinName(p)} alors qu'elle est en entrée (TRIS${PORTS[P]}${b} = 1) : rien ne sort. Mets TRIS${PORTS[P]} à 0 pour les sorties.`, this.S.L); }
  }
  pinsChanged() { this.bench.onPins(this.S.C, this); }
  // ----- registres -----
  buildR() {
    const m = this; const r = {}, w = {};
    PORTS.forEach((P, i) => {
      r['PORT' + P] = () => m.readPort(i);
      w['PORT' + P] = v => { m.chkOut(i, v); m.lat[i] = v & 255; m.pinsChanged(); m.S.N = m.S.C; return v & 255; };
      r['LAT' + P] = () => m.lat[i];
      w['LAT' + P] = v => { m.chkOut(i, v); m.lat[i] = v & 255; m.pinsChanged(); m.S.N = m.S.C; return v & 255; };
      r['TRIS' + P] = () => m.tris[i];
      w['TRIS' + P] = v => { m.tris[i] = v & 255; m.pinsChanged(); m.S.N = m.S.C; return v & 255; };
    });
    for (const n in SFR.regs) if (!r[n]) { r[n] = () => m.reg[n]; w[n] = v => { m.reg[n] = v & (SFR.regs[n].w === 16 ? 65535 : 255); m.S.N = m.S.C; return m.reg[n]; }; }
    const sync = () => m.sync();
    r.TMR0L = () => { sync(); m.t0.hbuf = m.t0.val >> 8; return m.t0.val & 255; };
    r.TMR0H = () => { sync(); return (m.reg.T0CON & 0x40) ? (m.t0.val >> 8) : m.t0.hbuf; };
    w.TMR0H = v => { sync(); m.t0.hbuf = v & 255; if (m.reg.T0CON & 0x40) m.t0.val = (m.t0.val & 255) | (v & 255) << 8; return v & 255; };
    w.TMR0L = v => { sync(); v &= 255; m.t0.val = (m.reg.T0CON & 0x40) ? (m.t0.val & 0xFF00) | v : (m.t0.hbuf << 8) | v; m.t0.acc = 0; m.S.N = m.S.C; return v; };
    r.TMR0 = () => { sync(); return m.t0.val; };
    w.TMR0 = v => { sync(); m.t0.val = v & 65535; m.t0.acc = 0; m.S.N = m.S.C; return v & 65535; };
    r.T0CON = () => m.reg.T0CON; w.T0CON = v => { sync(); m.reg.T0CON = v & 255; m.S.N = m.S.C; return v & 255; };
    r.TMR1L = () => { sync(); m.t1.hbuf = m.t1.val >> 8; return m.t1.val & 255; };
    r.TMR1H = () => { sync(); return (m.reg.T1CON & 0x80) ? m.t1.hbuf : (m.t1.val >> 8); };
    w.TMR1H = v => { sync(); v &= 255; if (m.reg.T1CON & 0x80) m.t1.hbuf = v; else m.t1.val = (m.t1.val & 255) | v << 8; m.S.N = m.S.C; return v; };
    w.TMR1L = v => { sync(); v &= 255; m.t1.val = (m.reg.T1CON & 0x80) ? (m.t1.hbuf << 8) | v : (m.t1.val & 0xFF00) | v; m.S.N = m.S.C; return v; };
    r.TMR1 = () => { sync(); return m.t1.val; };
    w.TMR1 = v => { sync(); m.t1.val = v & 65535; m.S.N = m.S.C; return v & 65535; };
    w.T1CON = v => { sync(); m.reg.T1CON = v & 255; m.S.N = m.S.C; return v & 255; };
    w.T2CON = v => { sync(); m.reg.T2CON = v & 255; m.t2.post = 0; m.t2.acc = 0; m.S.N = m.S.C; return v & 255; };
    r.TMR2 = () => { sync(); return m.reg.TMR2; };
    w.TMR2 = v => { sync(); m.reg.TMR2 = v & 255; m.t2.acc = 0; m.S.N = m.S.C; return v & 255; };
    w.PR2 = v => { sync(); m.reg.PR2 = v & 255; m.S.N = m.S.C; return v & 255; };
    r.ADRES = () => (m.reg.ADRESH << 8) | m.reg.ADRESL;
    w.ADRES = v => { m.reg.ADRESH = v >> 8 & 255; m.reg.ADRESL = v & 255; return v & 65535; };
    r.ADCON0 = () => { sync(); return m.reg.ADCON0; };
    w.ADCON0 = v => {
      sync(); v &= 255; const old = m.reg.ADCON0;
      m.reg.ADCON0 = v;
      if ((v & 4) && !(old & 4)) {
        if (!(v & 1)) { m.warnOnce('adon', 'GO mis à 1 alors que le convertisseur est éteint (ADON = 0) : aucune conversion', m.S.L); m.reg.ADCON0 &= ~4; }
        else {
          const sel = ((m.reg.ADCON1 >> 4) & 4) | (v >> 6);
          const tadMul = [0.5, 2, 8, -1, 1, 4, 16, -1][sel];
          const tad = tadMul < 0 ? 4e-6 * m.fcy : tadMul;
          const tadUs = tad / m.fcy * 1e6;
          if (tadMul > 0 && tadUs < 1.6) m.warnOnce('tad', `TAD = ${tadUs.toFixed(2)} µs < 1,6 µs minimum (bits ADCS) : sur le vrai PIC le résultat serait faux. Choisis une horloge ADC plus lente.`, m.S.L);
          m.adcDone = m.S.C + Math.ceil(12 * tad) + 1; m.S.N = m.S.C;
        }
      }
      if (!(v & 4) && (old & 4) && m.adcDone !== Infinity) m.adcDone = Infinity; // arrêt
      return v;
    };
    r.WREG = () => m.reg.WREG;
    r.SSPCON = () => m.reg.SSPCON1; w.SSPCON = v => w.SSPCON1(v);
    r.SSPBUF = () => { sync(); m.reg.SSPSTAT &= ~1; return m.reg.SSPBUF; };
    w.SSPBUF = v => {
      sync(); v &= 255; const c1 = m.reg.SSPCON1;
      if (!(c1 & 0x20)) { m.warnOnce('sspen', 'Écriture dans SSPBUF alors que le MSSP est désactivé (SSPEN = 0 dans SSPCON1) : rien n\'est envoyé', m.S.L); m.reg.SSPBUF = v; return v; }
      if ((c1 & 15) > 3) { m.warnOnce('sspm', 'MSSP pas en mode SPI maître (SSPM = 0000 à 0011) : seul le SPI maître est simulé', m.S.L); return v; }
      if (m.sspDone !== Infinity) { m.reg.SSPCON1 |= 0x80; m.warnOnce('wcol', 'Collision SPI (WCOL) : SSPBUF écrit avant la fin de l\'octet précédent — attends SSPIF ou BF', m.S.L); return v; }
      if (m.tris[2] >> 3 & 1 || m.tris[2] >> 5 & 1) m.warnOnce('spitris', 'SPI : RC3 (SCK) et RC5 (SDO) doivent être en sortie (TRISC3 = TRISC5 = 0)', m.S.L);
      const perBit = [1, 4, 16, 2 * ((m.reg.PR2 + 1) * [1, 4, 16, 16][m.reg.T2CON & 3])][c1 & 3];
      m.sspTx = v; m.sspDone = m.S.C + 8 * perBit; m.S.N = m.S.C; return v;
    };
    this.R = {
      r, w,
      rp: (i, pos, wd) => (m.readPort(i, ((1 << wd) - 1) << pos) >> pos) & ((1 << wd) - 1),
      wb: (name, pos, wd, v) => {
        const mask = ((1 << wd) - 1) << pos;
        let base;
        if (/^PORT/.test(name)) base = m.readPort(PORTS.indexOf(name[4]), 0); else base = r[name] ? r[name]() : m.reg[name];
        const nv = (base & ~mask) | ((v << pos) & mask);
        w[name](nv);
        return (nv & mask) >> pos;
      }
    };
  }
  // ----- périphériques -----
  sync() {
    const C = this.S.C, dc = C - this.lastC; if (dc <= 0) return; this.lastC = C;
    const reg = this.reg;
    // Timer0
    if ((reg.T0CON & 0x80) && !(reg.T0CON & 0x20)) {
      const ps = (reg.T0CON & 8) ? 1 : 2 << (reg.T0CON & 7);
      const t = this.t0; t.acc += dc; const ticks = Math.floor(t.acc / ps); t.acc -= ticks * ps;
      if (ticks) {
        if (reg.T0CON & 0x40) { const v = (t.val & 255) + ticks; if (v > 255) reg.INTCON |= 4; t.val = (t.val & 0xFF00) | (v & 255); }
        else { const v = t.val + ticks; if (v > 65535) reg.INTCON |= 4; t.val = v & 65535; }
      }
    }
    // Timer1
    if ((reg.T1CON & 1) && !(reg.T1CON & 2)) {
      const ps = 1 << ((reg.T1CON >> 4) & 3); const t = this.t1; t.acc += dc; const ticks = Math.floor(t.acc / ps); t.acc -= ticks * ps;
      if (ticks) { const v = t.val + ticks; if (v > 65535) reg.PIR1 |= 1; t.val = v & 65535; }
    }
    // Timer2
    if (reg.T2CON & 4) {
      const ps = [1, 4, 16, 16][reg.T2CON & 3], post = ((reg.T2CON >> 3) & 15) + 1, t = this.t2;
      t.acc += dc; let ticks = Math.floor(t.acc / ps); t.acc -= ticks * ps;
      if (ticks) {
        const period = reg.PR2 + 1; let val = reg.TMR2, matches = 0;
        const toMatch = (reg.PR2 - val) & 255;
        if (ticks <= toMatch) val += ticks;
        else { ticks -= toMatch + 1; matches = 1 + Math.floor(ticks / period); val = ticks % period; }
        reg.TMR2 = val & 255;
        if (matches) { t.post += matches; if (t.post >= post) { reg.PIR1 |= 2; t.post %= post; } }
      }
    }
    // ADC
    if (C >= this.adcDone) { this.adcDone = Infinity; this.finishADC(); }
    if (C >= this.sspDone) { this.sspDone = Infinity; reg.PIR1 |= 8; reg.SSPSTAT |= 1; reg.SSPBUF = 0; this.bench.spiByte(this.sspTx, this); }
    if (this.bench.gbfActive()) this.edgeCheck();
  }
  finishADC() {
    const reg = this.reg; const ch = (reg.ADCON0 >> 3) & 7; const p = AN_PINS[ch];
    const cfg = PCFG[reg.ADCON1 & 15];
    if (cfg[7 - ch] !== 'A') this.warnOnce('ch' + ch, `Conversion sur AN${ch} (${pinName(p)}) alors qu'elle n'est pas configurée analogique dans ADCON1 (PCFG)`, this.S.L);
    if (!(this.tris[p >> 3] >> (p & 7) & 1)) this.warnOnce('trisan' + ch, `AN${ch} (${pinName(p)}) est en sortie (TRIS = 0) : mets-la en entrée pour mesurer`, this.S.L);
    let V = this.bench.analogV(p);
    if (V === null) { V = 0; this.warnOnce('anfl' + ch, `Rien n'est branché sur AN${ch} (${pinName(p)}) : la conversion donne 0`, this.S.L); }
    let vp = 5, vm = 0;
    if (cfg.includes('+')) { const v = this.bench.analogV(AN_PINS[3]); vp = v === null ? 5 : v; }
    if (cfg.includes('-')) { const v = this.bench.analogV(AN_PINS[2]); vm = v === null ? 0 : v; }
    let res = Math.round((V - vm) / Math.max(1e-6, vp - vm) * 1023); res = Math.max(0, Math.min(1023, res));
    this.lastAdc = { ch, V, res };
    if (reg.ADCON1 & 0x80) { reg.ADRESH = res >> 8; reg.ADRESL = res & 255; } else { reg.ADRESH = res >> 2; reg.ADRESL = (res & 3) << 6; }
    reg.ADCON0 &= ~4; reg.PIR1 |= 0x40;
  }
  nextEvent() {
    const reg = this.reg, C = this.S.C; let n = Infinity;
    if ((reg.T0CON & 0x80) && !(reg.T0CON & 0x20)) { const ps = (reg.T0CON & 8) ? 1 : 2 << (reg.T0CON & 7); const rem = (reg.T0CON & 0x40) ? 256 - (this.t0.val & 255) : 65536 - this.t0.val; n = Math.min(n, rem * ps - this.t0.acc); }
    if ((reg.T1CON & 1) && !(reg.T1CON & 2)) { const ps = 1 << ((reg.T1CON >> 4) & 3); n = Math.min(n, (65536 - this.t1.val) * ps - this.t1.acc); }
    if (reg.T2CON & 4) { const ps = [1, 4, 16, 16][reg.T2CON & 3], post = ((reg.T2CON >> 3) & 15) + 1; const ticks = ((reg.PR2 - reg.TMR2) & 255) + 1 + (post - 1 - this.t2.post) * (reg.PR2 + 1); n = Math.min(n, ticks * ps - this.t2.acc); }
    if (this.adcDone !== Infinity) n = Math.min(n, this.adcDone - C);
    if (this.sspDone !== Infinity) n = Math.min(n, this.sspDone - C);
    n = Math.min(n, this.bench.gbfNextEdge(C, this.fcy) - C);
    return C + Math.max(1, n);
  }
  inputsChanged() { this.edgeCheck(); this.S.N = this.S.C; }
  edgeCheck() {
    // fronts sur INT0/1/2 et changement RB4-RB7
    const reg = this.reg;
    const lvl = p => { if (!(this.tris[p >> 3] >> (p & 7) & 1)) return this.pinOut(p); const v = this.bench.extLevel(p, this); return v === null ? ((p >> 3) === 1 && !(reg.INTCON2 & 0x80) ? 1 : 0) : v; };
    const edges = [[8, 'INTCON', 1, 0x40], [9, 'INTCON3', 0, 0x20], [10, 'INTCON3', 1, 0x10]];
    for (const [p, r, bit, edgMask] of edges) {
      const v = lvl(p), pv = this.prevIn[p] ?? v; this.prevIn[p] = v;
      const rising = !!(reg.INTCON2 & edgMask);
      if (v !== pv && (rising ? v === 1 : v === 0)) reg[r] |= 1 << bit;
    }
    let cur = 0; for (let b = 4; b < 8; b++) if (this.tris[1] >> b & 1) cur |= lvl(8 + b) << b;
    const mask = this.tris[1] & 0xF0;
    if (((cur ^ this.rbLatch) & mask)) reg.INTCON |= 1;
  }
  pendingLevel() {
    const reg = this.reg, ic = reg.INTCON, i2 = reg.INTCON2, i3 = reg.INTCON3;
    const src = [
      [ic & 4, ic & 0x20, i2 & 4], [ic & 2, ic & 0x10, 1], [ic & 1, ic & 8, i2 & 1],
      [i3 & 1, i3 & 8, i3 & 0x40], [i3 & 2, i3 & 0x10, i3 & 0x80],
    ];
    const p1 = reg.PIR1 & reg.PIE1, p2 = reg.PIR2 & reg.PIE2 & 0x1F;
    if (!(reg.RCON & 0x80)) {
      if (!(ic & 0x80)) return 0;
      if (src.some(s => s[0] && s[1])) return 2;
      if ((ic & 0x40) && (p1 || p2)) return 2;
      return 0;
    }
    if (!(ic & 0x80)) return 0;
    let hi = src.some(s => s[0] && s[1] && s[2]) || (p1 & reg.IPR1) || (p2 & reg.IPR2);
    if (hi) return 2;
    if (!(ic & 0x40)) return 0;
    let lo = src.some(s => s[0] && s[1] && !s[2]) || (p1 & ~reg.IPR1) || (p2 & ~reg.IPR2);
    return lo ? 1 : 0;
  }
  *checkIrq() {
    const S = this.S, reg = this.reg, prog = this.prog;
    for (let guard = 0; guard < 4; guard++) {
      const lvl = this.pendingLevel();
      const ipen = reg.RCON & 0x80;
      if (lvl === 2 && !this.inH) {
        if (!prog.isrH) { this.warnOnce('noisr', 'Interruption déclenchée mais aucune fonction d\'interruption n\'est définie (void __interrupt() isr(void))', S.L); return; }
        this.inH = true; this.sleeping = false; reg.INTCON &= ~0x80; S.C += 3; const L = S.L, d = S.depth;
        try { yield* prog.isrH(); } finally { S.depth = d; }
        reg.INTCON |= 0x80; this.inH = false; S.C += 2; S.L = L; this.sync(); continue;
      }
      if (lvl === 1 && ipen && !this.inH && !this.inL) {
        if (!prog.isrL) { this.warnOnce('noisrl', 'Interruption basse priorité déclenchée mais aucune routine low_priority n\'est définie', S.L); return; }
        this.inL = true; this.sleeping = false; reg.INTCON &= ~0x40; S.C += 3; const L = S.L, d = S.depth;
        try { yield* prog.isrL(); } finally { S.depth = d; }
        reg.INTCON |= 0x40; this.inL = false; S.C += 2; S.L = L; this.sync(); continue;
      }
      return;
    }
  }
  makeH() {
    const m = this, S = this.S;
    const H = {
      *ev() {
        m.sync();
        yield* m.checkIrq();
        while (S.C >= S.frameEnd) { yield 0; m.sync(); yield* m.checkIrq(); }
        S.N = Math.min(S.frameEnd, m.nextEvent());
      },
      *delay(n) {
        n = Math.max(0, Math.round(n)) || 0;
        while (n > 0) { const step = Math.min(n, Math.max(1, S.N - S.C)); S.C += step; n -= step; if (S.C >= S.N) yield* H.ev(); }
      },
      *sleep() { m.sleeping = true; m.log('info', 'SLEEP() : le PIC dort jusqu\'à une interruption', S.L); while (m.sleeping) { S.C = Math.max(S.C, Math.min(S.N, S.frameEnd)); yield* H.ev(); if (m.pendingFlag()) m.sleeping = false; } },
      cyc(n) { S.C += n; return 0; },
      ld(a, i, line) { if (i < 0 || i >= a.length || i !== (i | 0)) throw new RTErr(`accès hors du tableau : indice ${i} (taille ${a.length})`, line); return a[i]; },
      st(a, i, v, line) { if (i < 0 || i >= a.length || i !== (i | 0)) throw new RTErr(`écriture hors du tableau : indice ${i} (taille ${a.length})`, line); a[i] = v; return a[i]; },
      mk(a, o) { return { a, o }; },
      pc(p) { return p === null ? null : { a: p.a, o: p.o }; },
      np(p, line) { if (!p) throw new RTErr('utilisation d\'un pointeur NULL (non initialisé ?)', line); return p; },
      peq(a, b) { if (a === null || b === null) return a === b; return a.a === b.a && a.o === b.o; },
      div(a, b, line) { if (b === 0) throw new RTErr('division par zéro', line); return Math.trunc(a / b); },
      mod(a, b, line) { if (b === 0) throw new RTErr('modulo par zéro', line); return a % b; },
      f2i(x) { return Number.isFinite(x) ? Math.trunc(x) : 0; },
      fillT(C, vals, n) { const a = new C(n); a.set(vals.slice(0, n)); return a; },
      fillA(vals, n) { const a = new Array(n).fill(null); vals.forEach((v, i) => a[i] = v); return a; },
      stack(line) { throw new RTErr('débordement de la pile matérielle du PIC (31 niveaux) : récursion trop profonde ?', line); },
      undef(n) { throw new RTErr(`la fonction ${n}() est déclarée mais jamais définie`, S.L); },
      reset() { throw new RTErr('RESET() appelé', S.L); },
      printf(fmt, args) { let i = 0; const s = fmt.replace(/%[-0-9.]*[lh]?([diuxXcsf%])/g, (m0, c) => { if (c === '%') return '%'; const v = args[i++]; if (c === 'c') return String.fromCharCode(v); if (c === 'x') return (v >>> 0).toString(16); if (c === 'X') return (v >>> 0).toString(16).toUpperCase(); if (c === 's') return v && v.a ? String.fromCharCode(...Array.from(v.a.slice(v.o)).slice(0, Array.from(v.a.slice(v.o)).indexOf(0) >>> 0)) : ''; if (c === 'f') return (+v).toFixed(2); return String(v); }); m.log('out', s, S.L); return s.length; },
    };
    return H;
  }
  pendingFlag() { const r = this.reg; return (r.INTCON & r.INTCON << 3 & 0x38) || (r.PIR1 & r.PIE1); }
}
// ---------- Modules ----------
const MODULES = {
  seg7: { title: 'Module 7 segments', sigs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp', 'dis0', 'dis1', 'dis2', 'dis3'] },
  lcd: { title: 'Module LCD 16×2', sigs: ['rs', 'rw', 'e', 'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'] },
  keypad: { title: 'Module clavier 16 touches', sigs: ['c1', 'c2', 'c3', 'c4', 'r1', 'r2', 'r3', 'r4'] },
  buttons: { title: 'Module boutons poussoirs', sigs: ['bp0', 'bp1', 'bp2', 'bp3'] },
  switches: { title: 'Module interrupteurs', sigs: ['i0', 'i1', 'i2', 'i3'] },
  pots: { title: 'Module potentiomètres', sigs: ['pot0', 'pot1', 'pot2', 'pot3'] },
  gbf: { title: 'GBF', sigs: ['out'] },
  buzzer: { title: 'Module buzzer', sigs: ['buz'] },
  dac: { title: 'Module MCP4921 (CNA SPI)', sigs: ['cs', 'sck', 'sdi', 'ldac'] },
  bnc: { title: 'Module BNC + oscilloscope', sigs: ['ch1', 'ch2'] },
};
const KEY_LAYOUTS = {
  std: [['1', '2', '3', 'A'], ['4', '5', '6', 'B'], ['7', '8', '9', 'C'], ['*', '0', '#', 'D']],
  hex: [['0', '1', '2', '3'], ['4', '5', '6', '7'], ['8', '9', 'A', 'B'], ['C', 'D', 'E', 'F']],
};

class LCD {
  constructor() { this.reset(); }
  reset() {
    this.dd = new Uint8Array(128).fill(32); this.cg = new Uint8Array(64);
    this.ac = 0; this.tgt = 'dd'; this.dl8 = true; this.lines2 = false; this.on = false; this.cur = false; this.blink = false;
    this.inc = true; this.sh = false; this.shift = 0; this.nib = null; this.busyUntil = 0; this.prevE = 0; this.count = 0; this.out = 0; this.rnib = 0; this.font5x10 = false;
  }
  dur(fcy, v, rs) { return rs ? 43e-6 * fcy : (v === 1 || (v & 0xFE) === 2) ? 1.52e-3 * fcy : 37e-6 * fcy; }
  moveAc(d) {
    if (this.tgt === 'cg') { this.ac = (this.ac + d) & 63; return; }
    let a = this.ac + d;
    if (this.lines2) { if (a === 0x28) a = 0x40; else if (a === 0x68) a = 0; else if (a === 0x3F) a = 0x27; else if (a < 0) a = 0x67; }
    else { if (a > 0x4F) a = 0; else if (a < 0) a = 0x4F; }
    this.ac = a & 127;
  }
  exec(rs, v, C, fcy, ctx) {
    if (this.count === 0 && C < 15e-3 * fcy) ctx.warn('lcd15', `LCD : première commande ${((C / fcy) * 1000).toFixed(1)} ms après la mise sous tension, il faut attendre au moins 15 ms`);
    if (C < this.busyUntil) {
      ctx.warn('lcdbusy', `LCD occupé : ${rs ? 'donnée' : 'commande 0x' + v.toString(16).toUpperCase().padStart(2, '0')} envoyée ${((this.busyUntil - C) / fcy * 1e6).toFixed(0)} µs trop tôt (il faut attendre ~40 µs après chaque commande, 1,6 ms après 0x01/0x02)${ctx.strict ? ' — ignorée (mode strict)' : ''}`);
      if (ctx.strict) return;
    }
    this.count++;
    this.busyUntil = C + this.dur(fcy, v, rs);
    if (rs) {
      if (this.tgt === 'dd') { this.dd[this.ac] = v; this.moveAc(this.inc ? 1 : -1); if (this.sh) this.shift += this.inc ? 1 : -1; }
      else { this.cg[this.ac & 63] = v & 0x1F; this.moveAc(1); }
      return;
    }
    if (v & 0x80) { this.tgt = 'dd'; this.ac = v & 0x7F; }
    else if (v & 0x40) { this.tgt = 'cg'; this.ac = v & 0x3F; }
    else if (v & 0x20) { this.dl8 = !!(v & 0x10); this.lines2 = !!(v & 8); this.font5x10 = !!(v & 4); }
    else if (v & 0x10) { if (v & 8) this.shift += (v & 4) ? -1 : 1; else this.moveAc((v & 4) ? 1 : -1); }
    else if (v & 8) { this.on = !!(v & 4); this.cur = !!(v & 2); this.blink = !!(v & 1); }
    else if (v & 4) { this.inc = !!(v & 2); this.sh = !!(v & 1); }
    else if (v & 2) { this.ac = 0; this.tgt = 'dd'; this.shift = 0; }
    else if (v & 1) { this.dd.fill(32); this.ac = 0; this.tgt = 'dd'; this.shift = 0; this.inc = true; }
  }
  readVal(rs, C) {
    if (rs) { const v = this.tgt === 'dd' ? this.dd[this.ac] : this.cg[this.ac & 63]; return v; }
    return (C < this.busyUntil ? 0x80 : 0) | this.ac;
  }
  // texte visible ligne l (0/1), colonne c
  charAt(l, c) { if (l === 1 && !this.lines2) return -1; const base = l ? 0x40 : 0; const span = this.lines2 ? 40 : 80; let o = ((c + this.shift) % span + span) % span; return this.dd[base + o]; }
}

class Bench {
  constructor() {
    this.active = new Set(['seg7']);
    this.wiring = {}; for (const k in MODULES) { this.wiring[k] = {}; for (const s of MODULES[k].sigs) this.wiring[k][s] = null; }
    this.opts = { segActiveLow: true, disActiveLow: true, bpActiveLow: true, keyLayout: 'std', lcdStrict: false };
    this.bp = [0, 0, 0, 0]; this.sw = [0, 0, 0, 0]; this.pot = [2.5, 1.2, 3.3, 4.8]; this.keys = new Set();
    this.lcd = new LCD();
    this.gbf = { f: 1000, wave: 'square', duty: 0.5 };
    this.hist = { ch1: [], ch2: [] };
    this.scopeSrc = { ch1: 'pin', ch2: 'pin' };
    this.dac = { bytes: [], inReg: null, vout: 0, hist: [], prevCs: 1, prevLdac: 1 };
    this.buz = { toggles: 0, last: null };
    this.seg = { on: [0, 1, 2, 3].map(() => new Float64Array(8)), mask: [0, 0, 0, 0], lastC: 0, frameC: 0 };
    this.warn = () => { };
    this.rebuild();
  }
  pin(mod, sig) { return this.active.has(mod) ? this.wiring[mod][sig] : null; }
  rebuild() {
    // index broche -> signaux
    this.byPin = {};
    for (const m of this.active) for (const s of MODULES[m].sigs) { const p = this.wiring[m][s]; if (p === null || p === undefined) continue; (this.byPin[p] = this.byPin[p] || []).push([m, s]); }
  }
  conflicts() {
    const out = [];
    const inputs = { buttons: 1, switches: 1, pots: 1, gbf: 1 };
    for (const p in this.byPin) {
      const l = this.byPin[p];
      const drivers = l.filter(([m]) => inputs[m]);
      if (l.filter(([m]) => m !== 'bnc').length > 1) out.push(`${pinName(+p)} reliée à ${l.map(([m, s]) => s.toUpperCase()).join(' + ')}${drivers.length > 1 ? ' (court-circuit possible !)' : ''}`);
    }
    return out;
  }
  // ---- GBF (signal 0/5 V fonction du temps simulé) ----
  gbfActive() { return this.active.has('gbf') && this.wiring.gbf.out !== null && this.wiring.gbf.out !== undefined; }
  gbfPhase(C, fcy) { return C / fcy * this.gbf.f; }
  gbfV(C, fcy) {
    const g = this.gbf, ph = this.gbfPhase(C, fcy), fr = ph - Math.floor(ph);
    if (g.wave === 'sine') return 2.5 + 2.5 * Math.sin(2 * Math.PI * ph);
    if (g.wave === 'triangle') return fr < 0.5 ? 10 * fr : 10 * (1 - fr);
    return fr < g.duty ? 5 : 0;
  }
  gbfLevel(C, fcy) { // niveau logique cohérent avec gbfNextEdge (évite les erreurs d'arrondi)
    const ph = this.gbfPhase(C, fcy), fr = ph - Math.floor(ph), [e0, e1] = this.gbfEdges();
    return fr >= e0 && fr < e1 ? 1 : 0;
  }
  gbfEdges() { const g = this.gbf; return g.wave === 'sine' ? [0, 0.5] : g.wave === 'triangle' ? [0.25, 0.75] : [0, g.duty]; }
  gbfNextEdge(C, fcy) {
    if (!this.gbfActive() || !(this.gbf.f > 0)) return Infinity;
    const per = fcy / this.gbf.f, ph = C / per, k = Math.floor(ph), fr = ph - k;
    const [e0, e1] = this.gbfEdges();
    let nx = fr < e0 ? k + e0 : fr < e1 ? k + e1 : k + 1 + e0;
    let c = Math.ceil(nx * per); if (c <= C) c = C + 1; return c;
  }
  spiByte(b, pic) {
    if (!this.active.has('dac')) return;
    const cs = this.pin('dac', 'cs'); if (cs === null || pic.pinOut(cs) !== 0) return;
    if (this.pin('dac', 'sck') !== 19 || this.pin('dac', 'sdi') !== 21) { pic.warnOnce('dacwire', 'MCP4921 : SCK doit être relié à RC3 (SCK) et SDI à RC5 (SDO), sinon il ne reçoit rien', pic.S.L); return; }
    this.dac.bytes.push(b);
  }
  dacUpdate(C) {
    const d = this.dac; if (!d.inReg) return;
    const { cfg, data } = d.inReg;
    const v = (cfg & 1) ? Math.min(5, data / 4096 * 5 * ((cfg & 2) ? 1 : 2)) : 0;
    d.vout = v; const last = d.hist[d.hist.length - 1];
    if (!last || last[1] !== v) { d.hist.push([C, v]); if (d.hist.length > 80000) d.hist.splice(0, 30000); }
  }
  dacPins(C, pic) {
    const d = this.dac, csP = this.pin('dac', 'cs'), ldP = this.pin('dac', 'ldac');
    const cs = csP === null ? 1 : (pic.pinOut(csP) ?? 1), ld = ldP === null ? 0 : (pic.pinOut(ldP) ?? 1);
    if (cs === 0 && d.prevCs === 1) d.bytes = [];
    if (cs === 1 && d.prevCs === 0) {
      if (d.bytes.length >= 2) { const wd = (d.bytes[d.bytes.length - 2] << 8) | d.bytes[d.bytes.length - 1]; d.inReg = { cfg: wd >> 12, data: wd & 0xFFF }; if (wd & 0x8000) pic.warnOnce('dacab', 'MCP4921 : bit 15 (A/B) à 1 — le MCP4921 n\'a que la voie A, il faut ce bit à 0', pic.S.L); if (ld === 0) this.dacUpdate(C); }
      else if (d.bytes.length === 1) pic.warnOnce('dac1', 'MCP4921 : CS remonté après un seul octet, il en faut 2 (16 bits : 4 bits de config + 12 bits de donnée)', pic.S.L);
      d.bytes = [];
    }
    if (ld === 0 && d.prevLdac === 1 && cs === 1) this.dacUpdate(C);
    d.prevCs = cs; d.prevLdac = ld;
  }
  buzFreq(pic) {
    const p = this.pin('buzzer', 'buz'); if (p === null || !pic) return 0;
    if (p === 18 && pic.pwmActive() && !(pic.tris[2] >> 2 & 1)) { const w = pic.pwm(); return w.Th > 0 && w.Th < w.T ? w.f : 0; }
    return this.buz.f || 0;
  }
  reset() { this.hist = { ch1: [], ch2: [] }; this.dac = { bytes: [], inReg: null, vout: 0, hist: [], prevCs: 1, prevLdac: 1 }; this.buz = { toggles: 0, last: null, f: 0, t0: 0 }; this.lcd.reset(); const s = this.seg; s.on.forEach(a => a.fill(0)); s.mask = [0, 0, 0, 0]; s.lastC = 0; s.frameC = 0; }
  extLevel(p, pic) {
    const l = this.byPin[p]; if (!l) return null;
    for (const [m, s] of l) {
      if (m === 'buttons') { const i = +s[2]; return this.opts.bpActiveLow ? (this.bp[i] ? 0 : 1) : (this.bp[i] ? 1 : 0); }
      if (m === 'switches') return this.sw[+s[1]];
      if (m === 'pots') return this.pot[+s[3]] >= 2.0 ? 1 : 0;
      if (m === 'gbf') return this.gbfLevel(pic.S.C, pic.fcy);
      if (m === 'keypad') {
        const isRow = s[0] === 'r', idx = +s[1] - 1;
        for (const k of this.keys) {
          const [r, c] = k.split(',').map(Number);
          if (isRow ? r !== idx : c !== idx) continue;
          const other = this.pin('keypad', isRow ? 'c' + (c + 1) : 'r' + (r + 1));
          if (other !== null && pic.pinOut(other) === 1) return 1;
        }
        return 0; // pull-down 10k
      }
      if (m === 'lcd' && s[0] === 'd') {
        const rw = this.pin('lcd', 'rw'), e = this.pin('lcd', 'e');
        if (rw !== null && e !== null && pic.pinOut(rw) === 1 && pic.pinOut(e) === 1) {
          const bit = +s[1]; let v = this.lcd.out;
          if (!this.lcd.dl8) { v = this.lcd.rnib === 0 ? v : (v << 4) & 0xF0; }
          return (v >> bit) & 1;
        }
      }
    }
    return null;
  }
  analogV(p) {
    const l = this.byPin[p]; if (!l) return null;
    for (const [m, s] of l) { if (m === 'pots') return this.pot[+s[3]]; if (m === 'gbf') return this._pic ? this.gbfV(this._pic.S.C, this._pic.fcy) : 0; }
    return null;
  }
  // ---- oscilloscope : historique des sorties sur CH1/CH2 ----
  recordScope(C, pic) {
    for (const ch of ['ch1', 'ch2']) {
      const p = this.pin('bnc', ch); if (p === null) continue;
      const v = pic.pinOut(p); if (v === null) continue;
      const h = this.hist[ch], last = h[h.length - 1];
      if (!last || last[1] !== v * 5) { h.push([C, v * 5]); if (h.length > 60000) h.splice(0, 20000); }
    }
  }
  scopeV(ch, C, pic) {
    if (this.scopeSrc[ch] === 'dac') { const h = this.dac.hist; if (!h.length || C < h[0][0]) return 0; let lo = 0, hi = h.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (h[mid][0] <= C) lo = mid; else hi = mid - 1; } return h[lo][1]; }
    const p = this.pin('bnc', ch); if (p === null) return null;
    if (p === 18 && pic.pwmActive() && !(pic.tris[2] >> 2 & 1)) { const w = pic.pwm(); return (C % w.T) < w.Th ? 5 : 0; }
    const out = pic.pinOut(p);
    if (out === null) {
      const l = (this.byPin[p] || []);
      for (const [m, s] of l) { if (m === 'gbf') return this.gbfV(C, pic.fcy); if (m === 'pots') return this.pot[+s[3]]; if (m === 'buttons' || m === 'switches' || m === 'keypad') { const v = this.extLevel(p, pic); return v === null ? 0 : v * 5; } }
      return 0;
    }
    const h = this.hist[ch]; if (!h.length || C < h[0][0]) return h.length ? h[0][1] : out * 5;
    let lo = 0, hi = h.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (h[mid][0] <= C) lo = mid; else hi = mid - 1; }
    return h[lo][1];
  }
  onPins(C, pic) {
    this._pic = pic;
    if (this.active.has('bnc')) this.recordScope(C, pic);
    if (this.active.has('dac')) this.dacPins(C, pic);
    if (this.active.has('buzzer')) { const p = this.pin('buzzer', 'buz'); if (p !== null) { const v = pic.pinOut(p); if (v !== null && v !== this.buz.last) { this.buz.toggles++; this.buz.last = v; } } }
    if (this.active.has('seg7')) this.segUpdate(C, pic);
    if (this.active.has('lcd')) this.lcdUpdate(C, pic);
  }
  segUpdate(C, pic) {
    const s = this.seg, dt = C - s.lastC;
    if (dt > 0) { for (let d = 0; d < 4; d++) { const mk = s.mask[d]; if (mk) for (let k = 0; k < 8; k++) if (mk >> k & 1) s.on[d][k] += dt; } }
    s.lastC = C;
    const lvl = sig => { const p = this.wiring.seg7[sig]; return p === null ? null : pic.pinOut(p); };
    const SEG = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];
    let segMask = 0;
    SEG.forEach((n, k) => { const v = lvl(n); if (v !== null && (this.opts.segActiveLow ? v === 0 : v === 1)) segMask |= 1 << k; });
    for (let d = 0; d < 4; d++) { const v = lvl('dis' + d); const on = v !== null && (this.opts.disActiveLow ? v === 0 : v === 1); s.mask[d] = on ? segMask : 0; }
  }
  segFrame(C) {
    // renvoie luminosité [4][8] sur la fenêtre depuis la dernière trame
    const s = this.seg; this.segUpdateTime(C);
    const span = Math.max(1, C - s.frameC); s.frameC = C;
    const res = s.on.map(a => Array.from(a, v => v / span));
    s.on.forEach(a => a.fill(0));
    return res;
  }
  segUpdateTime(C) { const s = this.seg, dt = C - s.lastC; if (dt > 0) { for (let d = 0; d < 4; d++) { const mk = s.mask[d]; if (mk) for (let k = 0; k < 8; k++) if (mk >> k & 1) s.on[d][k] += dt; } } s.lastC = C; }
  lcdUpdate(C, pic) {
    const W = this.wiring.lcd, lv = sig => W[sig] === null ? null : pic.pinOut(W[sig]);
    const E = lv('e') === 1 ? 1 : 0, lcd = this.lcd;
    const ctx = { warn: (k, msg) => pic.warnOnce(k, msg, pic.S.L), strict: this.opts.lcdStrict };
    if (E && !lcd.prevE) {
      // front montant : préparer lecture
      if (lv('rw') === 1) { if (lcd.dl8 || lcd.rnib === 0) lcd.out = lcd.readVal(lv('rs') === 1, C); }
    }
    if (!E && lcd.prevE) {
      const rs = lv('rs') === 1, rw = lv('rw') === 1;
      if (W.e !== null && W.rs === null) pic.warnOnce('lcdrs', 'LCD : la broche RS n\'est reliée à rien', pic.S.L);
      if (rw) {
        if (!lcd.dl8) { lcd.rnib ^= 1; if (lcd.rnib === 0 && rs) lcd.moveAc(1); } else if (rs) lcd.moveAc(1);
      } else {
        let byte = 0; for (let b = 0; b < 8; b++) if (lv('d' + b) === 1) byte |= 1 << b;
        if (lcd.dl8) lcd.exec(rs, byte, C, pic.fcy, ctx);
        else {
          if (lcd.nib === null) { lcd.nib = byte & 0xF0; lcd.nibRs = rs; }
          else { const v = lcd.nib | (byte >> 4); lcd.nib = null; lcd.exec(rs, v, C, pic.fcy, ctx); }
        }
      }
    }
    lcd.prevE = E;
  }
}

// ---------- Simulation ----------
class Sim {
  constructor(bench, log) { this.bench = bench; this.log = log; this.pic = new PIC(bench, log); this.gen = null; this.state = 'idle'; }
  load(compiled, fosc) {
    this.compiled = compiled;
    this.pic.fosc = fosc;
    const pic = this.pic;
    this.H = pic.makeH();
    const factory = new Function('S', 'R', 'H', compiled.js);
    this.prog = factory(pic.S, pic.R, this.H);
    pic.prog = this.prog;
  }
  start() {
    this.pic.reset(); this.bench.reset(); this.bench._pic = this.pic; this.bench.warn = (k, m) => this.pic.warnOnce(k, m, this.pic.S.L);
    const prog = this.prog;
    this.gen = (function* () { yield* prog.init(); yield* prog.main(); })();
    this.state = 'run';
    this.pic.pinsChanged();
  }
  runCycles(n) {
    if (this.state !== 'run') return;
    const S = this.pic.S;
    S.frameEnd = S.C + Math.max(1, Math.round(n));
    S.N = Math.min(S.frameEnd, this.pic.nextEvent());
    try {
      const r = this.gen.next();
      if (r.done) { this.state = 'done'; this.log('info', 'main() est terminé (sur le vrai PIC, XC8 redémarre le programme : pense au while(1) final)', S.L); }
    } catch (e) {
      this.state = 'error';
      if (e instanceof RTErr) this.log('error', 'Erreur à l\'exécution : ' + e.message, e.line || S.L);
      else { this.log('error', 'Erreur interne du simulateur : ' + e.message, S.L); console.error(e); }
    }
    this.pic.sync();
  }
}
return { PIC, Bench, Sim, LCD, SFR, MODULES, KEY_LAYOUTS, PORTS, PMASK, pinName, pinIdx, ALL_PINS, AN_PINS, PCFG, RTErr };
})();
export default PICM;
