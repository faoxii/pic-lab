// Aide-mémoire PIC18F452 (cartes Micro-info IG2I, quartz 4 MHz)
export const MEMO = `<div class="mgrid">

<div class="mc"><h4>Horloge</h4>
<p>Quartz <b>Fosc = 4 MHz</b> (<code>#pragma config OSC = XT</code>). Le PIC fait une instruction tous les 4 coups d'horloge :</p>
<p><b>Fcy = Fosc / 4 = 1 MHz → 1 instruction = 1 µs</b></p>
<p>Timer sans prédiviseur : 1 pas = 1 µs. Avec un prédiviseur de 16 : 1 pas = 16 µs.</p></div>

<div class="mc"><h4>Ports</h4>
<ul>
<li><b>TRISx</b> : 1 = entrée, 0 = sortie. Au reset tout est en entrée (1).</li>
<li><b>PORTx</b> : lire l'état des broches, ou écrire une sortie. <code>PORTBbits.RB5 = 0;</code></li>
<li>Ports <b>A et E analogiques au reset</b> : ils se lisent toujours 0 tant qu'on n'a pas mis <code>ADCON1 = 0b00000111;</code></li>
</ul></div>

<div class="mc"><h4>Afficheur 7 segments</h4>
<p>Nappe PORTD à l'envers : <b>RD7 = a, RD6 = b … RD1 = g, RD0 = point</b>. Dis0 = RB5, Dis1 = RB4, Dis2 = RB3, Dis3 = RB2.</p>
<p>Anode commune + PNP : <b>segment allumé à 0</b>, <b>afficheur choisi quand Dis = 0</b>.</p>
<table><tr><th>chiffre</th><th>a</th><th>b</th><th>c</th><th>d</th><th>e</th><th>f</th><th>g</th></tr>
<tr><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>1</td></tr>
<tr><td>1</td><td>1</td><td>0</td><td>0</td><td>1</td><td>1</td><td>1</td><td>1</td></tr>
<tr><td>2</td><td>0</td><td>0</td><td>1</td><td>0</td><td>0</td><td>1</td><td>0</td></tr>
<tr><td>3</td><td>0</td><td>0</td><td>0</td><td>0</td><td>1</td><td>1</td><td>0</td></tr>
<tr><td>4</td><td>1</td><td>0</td><td>0</td><td>1</td><td>1</td><td>0</td><td>0</td></tr>
<tr><td>5</td><td>0</td><td>1</td><td>0</td><td>0</td><td>1</td><td>0</td><td>0</td></tr>
<tr><td>6</td><td>0</td><td>1</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
<tr><td>7</td><td>0</td><td>0</td><td>0</td><td>1</td><td>1</td><td>1</td><td>1</td></tr>
<tr><td>8</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
<tr><td>9</td><td>0</td><td>0</td><td>0</td><td>0</td><td>1</td><td>0</td><td>0</td></tr></table>
<p>Multiplexage : <b>tout éteindre</b> → mettre les segments → allumer un seul Dis → petite attente → afficheur suivant.</p></div>

<div class="mc"><h4>Timer0 · T0CON</h4>
<table><tr><th>7</th><th>6</th><th>5</th><th>4</th><th>3</th><th>2-0</th></tr>
<tr><td>TMR0ON</td><td>T08BIT<br>1 = 8 bits</td><td>T0CS<br>0 = Fosc/4</td><td>T0SE</td><td>PSA<br>0 = prédiv.</td><td>T0PS<br>011 = 1:16</td></tr></table>
<p><b>Précharge = 65 536 − durée / (1 µs × prédiviseur)</b> (mode 16 bits). Écrire <b>TMR0H puis TMR0L</b>.</p>
<ul><li>10 ms, sans prédiviseur → 65 536 − 10 000 = <b>0xD8F0</b></li>
<li>0,86 s, 1:16 → 65 536 − 53 750 = <b>0x2E0A</b></li>
<li>1 s, 1:16 → 65 536 − 62 500 = <b>0x0BDC</b></li></ul>
<p>À l'oscillo, si la broche est inversée à chaque interruption : <b>intervalle du timer = T / 2</b>.</p></div>

<div class="mc"><h4>Interruptions · INTCON</h4>
<table><tr><th>7</th><th>6</th><th>5</th><th>4</th><th>3</th><th>2</th><th>1</th><th>0</th></tr>
<tr><td>GIE</td><td>PEIE</td><td>TMR0IE</td><td>INT0IE</td><td>RBIE</td><td>TMR0IF</td><td>INT0IF</td><td>RBIF</td></tr></table>
<pre>void __interrupt(high_priority) myHighint(void)
{
    if (INTCONbits.TMR0IF) {
        TMR0H = 0xD8; TMR0L = 0xF0;   // recharger
        INTCONbits.TMR0IF = 0;        // acquitter
    }
    if (INTCON3bits.INT1IF) {         // bouton sur RB1
        INTCON3bits.INT1IF = 0;
    }
}</pre>
<ul><li>INT0 = RB0, INT1 = RB1 (INTCON3), INT2 = RB2. Front montant par défaut (INTEDGx = 1).</li>
<li>Variables modifiées dans l'interruption : <code>volatile</code>.</li>
<li>Timer1, Timer2, ADC, SPI : drapeaux dans PIR1/PIE1 + <b>PEIE = 1</b>.</li></ul></div>

<div class="mc"><h4>Convertisseur ADC (10 bits)</h4>
<table><tr><th></th><th>7</th><th>6</th><th>5-3</th><th>2</th><th>0</th></tr>
<tr><td>ADCON0</td><td colspan="2">ADCS1:0 (horloge)</td><td>CHS (canal)</td><td>GO/DONE</td><td>ADON</td></tr>
<tr><td>ADCON1</td><td>ADFM<br>1 = droite</td><td>ADCS2</td><td colspan="3">PCFG (bits 3-0) : broches analogiques</td></tr></table>
<ul><li><code>ADCON1 = 0b10000000;</code> droite, AN0…AN7 analogiques · <code>0b00000111</code> tout numérique.</li>
<li><code>ADCON0 = 0b10011001;</code> Fosc/32 (TAD = 8 µs à 4 MHz), canal AN3, ADON.</li>
<li><code>GODONE = 1;</code> puis <code>while(GODONE);</code> → résultat <code>(ADRESH &lt;&lt; 8) + ADRESL</code> (0…1023).</li>
<li>mV = valeur × 5000 / 1023 → calcul en <code>unsigned long</code> (UL) pour ne pas déborder.</li></ul></div>

<div class="mc"><h4>Écran LCD (HD44780)</h4>
<p>D0…D7 = PORTD, <b>RS = RB5</b> (0 commande, 1 caractère), <b>RW = RB4</b> (0 écriture, 1 lecture), <b>E = RB3</b> (donnée prise au front descendant).</p>
<table><tr><td>0x01 effacer</td><td>0x06 incrément</td><td>0x0C ON sans curseur</td><td>0x0E curseur</td></tr>
<tr><td>0x38 8 bits 2 lignes</td><td>0x80 + col ligne 1</td><td>0xC0 + col ligne 2</td><td>0x1C décalage</td></tr></table>
<p>Avant chaque écriture : lire le <b>busy flag</b> (RW = 1, bit 7 de PORTD) et attendre qu'il passe à 0.</p></div>

<div class="mc"><h4>Clavier matriciel</h4>
<p>Lignes RA3, RA2, RA1, RA0 en <b>sortie</b> · colonnes RE2, RE1, RE0 en <b>entrée</b> (résistances vers la masse).</p>
<p>Mettre <b>une seule ligne à 1</b>, regarder quelle colonne passe à 1. Attendre le relâchement pour ne compter la touche qu'une fois.</p></div>

<div class="mc"><h4>PWM (CCP1 sur RC2) · TP5</h4>
<ul><li><code>T2CON = 0b00000111;</code> TMR2ON, prédiviseur 1:16 · <code>CCP1CON = 0b00001100;</code> mode PWM · RC2 en sortie.</li>
<li>Période : <b>T = (PR2 + 1) × 4 × Tosc × prédiv.</b> = (PR2 + 1) × 16 µs → <b>PR2 = 1 000 000 / (16 × f) − 1</b>.</li>
<li>Niveau haut sur 10 bits CCPR1L:DC1B = 2 × (PR2 + 1) pour un carré 50 %.</li></ul></div>

<div class="mc"><h4>Bus SPI + MCP4921 · TP6</h4>
<ul><li>SCK = RC3, SDO = RC5 (SDI = RC4 en entrée). <code>SSPCON1 = 0x20;</code> SPI maître Fosc/4, <code>SSPSTATbits.CKE = 1;</code></li>
<li>Envoi d'un octet : <code>SSPBUF = x;</code> puis attendre <code>PIR1bits.SSPIF == 1</code>.</li>
<li>MCP4921 : CS = 0, octet <b>0111 + 4 bits forts</b>, puis 8 bits faibles, CS = 1, impulsion sur LDAC. Vout = 5 V × valeur / 4096.</li></ul></div>

<div class="mc"><h4>Ce que le simulateur ne fait pas</h4>
<ul><li>Pas de <code>struct</code>, pas de <code>&amp;variable</code>, pas de <code>goto</code>.</li>
<li>Durées des boucles de tempo approximatives (à vérifier à l'oscillo sur la vraie carte) ; timers, PWM et SPI sont exacts.</li>
<li>UART, EEPROM et chien de garde non simulés.</li></ul></div>

</div>`;
