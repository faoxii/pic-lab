# PIC Lab

**Simulateur 3D du PIC18F452 et des cartes de TP Micro-info (IG2I – Centrale Lille).**
On pose les modules sur la table, on branche les fils et les nappes à la souris, on écrit son programme en C (style XC8 / MPLAB X) et on le voit tourner : afficheurs 7 segments, LCD, clavier, buzzer, oscilloscope…

Pas besoin de la carte ni de MPLAB pour s'entraîner : tout tourne dans le navigateur.

---

## Fonctionnalités

- **Banc 3D interactif** : carte PIC 18F452 et modules des TP (7 segments, LCD 16×2, clavier, boutons, interrupteurs, potentiomètres, buzzer, MCP4921, GBF, module BNC + oscilloscope).
- **Câblage réaliste** : clic sur une broche d'un module puis sur une broche du PIC pour poser un fil ; connecteurs blancs pour les nappes 8 fils. LED d'état sur chaque broche du PIC.
- **Compilateur C intégré** (sous-ensemble de XC8) : `PORTBbits.RB0`, `TRISx`, `__interrupt(high_priority)`, `asm("NOP")`, `int` 16 bits avec débordements, tableaux, pointeurs sur chaînes… Erreurs et avertissements en français avec le numéro de ligne.
- **Émulation du PIC18F452** à 4 MHz (Fcy = 1 MHz) : ports, Timer0/1/2, interruptions INT0/INT1/INT2/RB, ADC 10 bits, PWM (CCP1), SPI (MSSP).
- **Instruments** : oscilloscope 2 voies (déclenchement, V/div, mesures f, T, T/2, largeur haute/basse, rapport cyclique, Vmax/Vmin/Vcc/Vmoy) et GBF (carré TTL, sinus, triangle).
- **Leçons des TP** : chaque leçon part d'un squelette de programme, avec le câblage attendu et un bouton « Solution ».
  1. Afficher un chiffre · 2. Compteur · 3. Multiplexage · 4. Boutons
  5. Timer 10 ms · 6. TP1 Chronomètre · 7. TP2 Voltmètre ADC
  8. LCD · 9. Clavier · 10. TP3 Serrure codée
  11. TP4 Fréquencemètre · 12. TP5 Musique (PWM) · 13. TP6 Bus SPI + CNA
- **Banc libre** pour tester ses propres fichiers `.c` (bouton d'import).
- **Debug** : registres en binaire, variables globales en direct, pause, pas à pas de 1 ms, ralenti jusqu'à ×0,001.

## Câblage par défaut (cartes IG2I)

| Module | Branchement |
|---|---|
| 7 segments | nappe PORTD (RD7 = a … RD0 = point), Dis0 = RB5, Dis1 = RB4, Dis2 = RB3, Dis3 = RB2 |
| LCD | D0…D7 = PORTD, RS = RB5, RW = RB4, E = RB3 |
| Clavier | lignes RA3…RA0, colonnes RE2…RE0 |
| Boutons | BP0 = RB0 (INT0), BP1 = RB1 (INT1) |
| Potentiomètre | POT0 = RA3 (AN3) |
| Buzzer | RC2 (CCP1) |
| MCP4921 | SCK = RC3, SDI = RC5, CS = RC6, LDAC = RC7 |

## Lancer le projet

```bash
npm install
npm run dev      # serveur de développement
npm run build    # génère dist/index.html (un seul fichier autonome)
```

Le build produit **un unique fichier HTML** (via `vite-plugin-singlefile`) : il peut être hébergé n'importe où (Vercel, GitHub Pages, ou ouvert directement).

## Stack technique

- [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- [three.js](https://threejs.org/) via [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) et [drei](https://github.com/pmndrs/drei) pour la scène 3D
- [CodeMirror 6](https://codemirror.net/) pour l'éditeur, [Zustand](https://github.com/pmndrs/zustand) pour l'état

```
src/
├── engine/        # compilateur C → JS, émulation du PIC18F452, leçons
│   ├── compiler.js
│   ├── machine.js
│   └── lessons.js
├── scene/         # scène 3D : cartes, fils, nappes, caméra
├── ui/            # panneau latéral, éditeur, mémo
├── scope.js       # oscilloscope
├── layout.js      # position des cartes et des broches
└── state.js       # état global et pilotage de la simulation
```

## Limites

- Pas de `struct`, de `&variable` ni de `goto` ; UART, EEPROM et chien de garde non simulés.
- La durée des boucles de temporisation est approximative (à vérifier à l'oscilloscope sur la vraie carte). Les timers, le PWM et le SPI sont exacts.
- Ce n'est pas le vrai compilateur XC8 : un programme qui marche ici doit encore être compilé et testé sur MPLAB X.

## Auteur

Mathis Bourguignon — IG2I, Centrale Lille

Inspiré des sites d'apprentissage interactifs de [Dilum Sanjaya](https://x.com/DilumSanjaya).
