import { useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { EditorView, Decoration, keymap } from '@codemirror/view';
import { StateField, StateEffect, Prec } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { useStore, SFR } from '../state.js';

const setMarks = StateEffect.define();
const marks = StateField.define({
  create: () => Decoration.none,
  update(v, tr) { v = v.map(tr.changes); for (const e of tr.effects) if (e.is(setMarks)) v = e.value; return v; },
  provide: f => EditorView.decorations.from(f),
});
const theme = EditorView.theme({
  '&': { backgroundColor: '#1c1b19', color: '#e8e2d4', height: '100%', fontSize: '12.5px' },
  '.cm-content': { fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace', caretColor: '#fff', fontVariantLigatures: 'none', fontFeatureSettings: '"liga" 0, "calt" 0' },
  '.cm-gutters': { backgroundColor: '#181715', color: '#6f6a5f', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.035)' }, '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,.05)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(127,209,196,.3) !important' },
  '.cm-errLine': { backgroundColor: 'rgba(214,51,51,.35)' }, '.cm-curLine': { backgroundColor: 'rgba(127,209,196,.25)' }, '.cm-warnLine': { backgroundColor: 'rgba(231,180,76,.15)' },
  '.cm-cursor': { borderLeftColor: '#fff' },
}, { dark: true });
const sfrSet = new Set([...Object.keys(SFR.regs), ...Object.keys(SFR.bits)]);
const hl = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.modifier], color: '#ff8f6b' },
  { tag: [t.typeName, t.standard(t.typeName)], color: '#7fd1c4' },
  { tag: [t.number, t.bool], color: '#e7b44c' },
  { tag: [t.string, t.character], color: '#a8d483' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#7b766a', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.meta], color: '#c49cf0' },
  { tag: [t.function(t.variableName)], color: '#f2e6c7' },
  { tag: t.macroName, color: '#c49cf0' },
]);
// coloration des registres du PIC
const sfrDeco = Decoration.mark({ class: 'cm-sfr' });
const sfrPlugin = EditorView.decorations.compute(['doc'], st => {
  const b = []; const txt = st.doc.toString(); const re = /\b[A-Z][A-Z0-9]+(bits)?\b/g; let m;
  while ((m = re.exec(txt))) if (sfrSet.has(m[0])) b.push(sfrDeco.range(m.index, m.index + m[0].length));
  return Decoration.set(b);
});
const sfrTheme = EditorView.theme({ '.cm-sfr, .cm-sfr *': { color: '#8ab4ff !important', fontWeight: '600' } });

export const editorRef = { view: null };
export function gotoLine(n) {
  const v = editorRef.view; if (!v || !n) return;
  const line = v.state.doc.line(Math.min(Math.max(1, n), v.state.doc.lines));
  v.dispatch({ selection: { anchor: line.from, head: line.to }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) }); v.focus();
}

export default function CodeEditor() {
  const code = useStore(s => s.code), setCode = useStore(s => s.setCode);
  const errLine = useStore(s => s.errLine), curLine = useStore(s => s.curLine), warnLines = useStore(s => s.warnLines);
  const exts = useMemo(() => [cpp(), theme, syntaxHighlighting(hl), marks, sfrPlugin, sfrTheme,
    Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => { useStore.getState().compileRun(); return true; } }]))], []);
  useEffect(() => {
    const v = editorRef.view; if (!v) return;
    const d = [], doc = v.state.doc;
    const add = (n, cls) => { if (n >= 1 && n <= doc.lines) d.push({ from: doc.line(n).from, cls }); };
    warnLines.forEach(n => add(n, 'cm-warnLine')); add(curLine, 'cm-curLine'); add(errLine, 'cm-errLine');
    d.sort((a, b) => a.from - b.from);
    const seen = new Set();
    const set = Decoration.set(d.filter(x => !seen.has(x.from) && seen.add(x.from)).map(x => Decoration.line({ class: x.cls }).range(x.from)));
    v.dispatch({ effects: setMarks.of(set) });
    if (errLine) gotoLine(errLine); else if (curLine) { const l = doc.line(Math.min(curLine, doc.lines)); v.dispatch({ effects: EditorView.scrollIntoView(l.from, { y: 'center' }) }); }
  }, [errLine, curLine, warnLines, code]);
  return <CodeMirror value={code} height="100%" style={{ height: '100%' }} theme="none" extensions={exts}
    basicSetup={{ foldGutter: false, highlightActiveLine: true, autocompletion: false, tabSize: 4 }}
    onChange={v => { if (v !== useStore.getState().code) setCode(v); }} onCreateEditor={v => editorRef.view = v} />;
}
