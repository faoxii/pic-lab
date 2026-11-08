// ===================== Leçons / TP — code des TP de Mathis Bourguignon & Lucas Lefebvre (IG2I) =====================
// Câblage par défaut = celui des TP (quartz 4 MHz)
const DEFAULT_WIRING = {
  // nappe PORTD -> 7 segments : RD7 = a ... RD1 = g, RD0 = DP
  seg7: { a: 'RD7', b: 'RD6', c: 'RD5', d: 'RD4', e: 'RD3', f: 'RD2', g: 'RD1', dp: 'RD0', dis0: 'RB5', dis1: 'RB4', dis2: 'RB3', dis3: 'RB2' },
  lcd: { d0: 'RD0', d1: 'RD1', d2: 'RD2', d3: 'RD3', d4: 'RD4', d5: 'RD5', d6: 'RD6', d7: 'RD7', rs: 'RB5', rw: 'RB4', e: 'RB3' },
  keypad: { r1: 'RA3', r2: 'RA2', r3: 'RA1', r4: 'RA0', c1: 'RE2', c2: 'RE1', c3: 'RE0', c4: null },
  buttons: { bp0: 'RB0', bp1: 'RB1', bp2: null, bp3: null },
  switches: { i0: 'RC4', i1: null, i2: null, i3: null },
  pots: { pot0: 'RA3', pot1: null, pot2: null, pot3: null },
  gbf: { out: 'RB0' },
  bnc: { ch1: 'RC0', ch2: null },
  buzzer: { buz: 'RC2' },
  dac: { cs: 'RC6', sck: 'RC3', sdi: 'RC5', ldac: 'RC7' },
};

// ---------- blocs de code communs (même style que les TP) ----------
const HEAD = (nom, desc, cablage, auteurs = 'Mathis Bourguignon / Lucas Lefebvre') => `/**
 *  nom:        ${nom}
 *  auteurs:    ${auteurs}
 *  descriptif: ${desc}
 *  cablage:    ${cablage.join('\n *              ')}
 */

/****************************************************************************/
/*      I N C L U D E S   E T   C O N F I G U R A T I O N                   */
/****************************************************************************/
#include <xc.h>
#pragma config OSC = XT     // quartz 4 MHz : Fcy = Fosc/4 = 1 MHz -> 1 instruction = 1 us
#pragma config WDT = OFF    // pas de chien de garde
`;

const SEG_DEFS = `
/****************************************************************************/
/*      C O N S T A N T E S   S Y M B O L I Q U E S                         */
/****************************************************************************/
// brochage de l'afficheur : la nappe PORTD arrive à l'envers (RD7 = segment a)
#define SEG_A  PORTDbits.RD7
#define SEG_B  PORTDbits.RD6
#define SEG_C  PORTDbits.RD5
#define SEG_D  PORTDbits.RD4
#define SEG_E  PORTDbits.RD3
#define SEG_F  PORTDbits.RD2
#define SEG_G  PORTDbits.RD1
#define SEG_DP PORTDbits.RD0

// un afficheur s'allume quand sa ligne Dis est à 0 (transistor PNP)
#define DIS0 PORTBbits.RB5
#define DIS1 PORTBbits.RB4
#define DIS2 PORTBbits.RB3
#define DIS3 PORTBbits.RB2

// segments a b c d e f g pour chaque chiffre : 0 = allumé (anode commune)
const unsigned char table7seg[10][7] = {
    {0,0,0,0,0,0,1}, // 0
    {1,0,0,1,1,1,1}, // 1
    {0,0,1,0,0,1,0}, // 2
    {0,0,0,0,1,1,0}, // 3
    {1,0,0,1,1,0,0}, // 4
    {0,1,0,0,1,0,0}, // 5
    {0,1,0,0,0,0,0}, // 6
    {0,0,0,1,1,1,1}, // 7
    {0,0,0,0,0,0,0}, // 8
    {0,0,0,0,1,0,0}  // 9
};
`;
const SEG_FUNCS = `
// prépare les segments d'un chiffre (n'allume aucun afficheur)
void afficher_chiffre(unsigned char valeur, unsigned char point)
{
    SEG_A = table7seg[valeur][0];
    SEG_B = table7seg[valeur][1];
    SEG_C = table7seg[valeur][2];
    SEG_D = table7seg[valeur][3];
    SEG_E = table7seg[valeur][4];
    SEG_F = table7seg[valeur][5];
    SEG_G = table7seg[valeur][6];
    SEG_DP = !point;            // 0 allume le point, donc on inverse
}

// éteint les 4 afficheurs (évite les "fantômes" quand on change de chiffre)
void eteindre_tout(void)
{
    DIS0 = 1; DIS1 = 1; DIS2 = 1; DIS3 = 1;
}

// segments en sortie, RB2..RB5 (Dis) en sortie, RB0/RB1 en entrée
void init_afficheur(void)
{
    TRISD = 0b00000000;
    TRISB = 0b00000011;
    eteindre_tout();
}

// petite attente pour laisser chaque afficheur allumé un moment
void wait_affichage(void)
{
    unsigned int temps;
    for (temps = 0; temps < 200; temps++)
        asm("NOP");
}

// affiche un nombre de 0 à 9999 par multiplexage (un afficheur à la fois)
// pos_point : numéro de l'afficheur qui porte le point (4 = aucun)
void refresh_afficheur(unsigned int nombre, unsigned char pos_point)
{
    unsigned char d0 = (nombre / 1000) % 10;   // milliers  -> Dis0
    unsigned char d1 = (nombre / 100) % 10;    // centaines -> Dis1
    unsigned char d2 = (nombre / 10) % 10;     // dizaines  -> Dis2
    unsigned char d3 = nombre % 10;            // unités    -> Dis3

    eteindre_tout(); afficher_chiffre(d0, pos_point == 0); DIS0 = 0; wait_affichage();
    eteindre_tout(); afficher_chiffre(d1, pos_point == 1); DIS1 = 0; wait_affichage();
    eteindre_tout(); afficher_chiffre(d2, pos_point == 2); DIS2 = 0; wait_affichage();
    eteindre_tout(); afficher_chiffre(d3, pos_point == 3); DIS3 = 0; wait_affichage();
    eteindre_tout();
}
`;
const TEMPO = `
// temporisation logicielle : environ 1 ms par tour à 4 MHz (à vérifier à l'oscilloscope)
void tempo_ms(unsigned int ms)
{
    unsigned char j;
    while (ms--)
        for (j = 0; j < 75; j++)
            asm("NOP");
}
`;
const LCD = `
/****************************************************************************/
/*      L C D   (D0..D7 = PORTD, RS = RB5, RW = RB4, E = RB3)               */
/****************************************************************************/
#define LCD_E         PORTBbits.RB3
#define LCD_RW        PORTBbits.RB4
#define LCD_RS        PORTBbits.RB5
#define LCD_DATA      PORTD        // bus de données
#define LCD_DATA_TRIS TRISD        // direction du bus

#define lcd_cmd(c)  lcd_write((c), 0)   // écrire une commande
#define lcd_char(c) lcd_write((c), 1)   // écrire un caractère

// lit l'octet d'état du LCD (bit 7 = busy flag)
unsigned char lcd_read(void)
{
    unsigned char octet;
    LCD_DATA_TRIS = 0b11111111;   // bus en entrée pour lire
    LCD_RS = 0;
    LCD_RW = 1;                   // lecture
    LCD_E = 1;
    asm("NOP");
    octet = LCD_DATA;             // on lit pendant que E = 1
    LCD_E = 0;
    LCD_RW = 0;
    LCD_DATA_TRIS = 0b00000000;   // bus de nouveau en sortie
    return octet;
}

// attend que le LCD soit libre (busy flag à 0)
void lcd_wait(void)
{
    while (lcd_read() & 0b10000000);
}

// envoie un octet : rs = 0 commande, rs = 1 caractère
void lcd_write(unsigned char octet, unsigned char rs)
{
    lcd_wait();
    LCD_RS = rs;
    LCD_RW = 0;
    LCD_DATA = octet;
    LCD_E = 1;                    // la donnée est prise au front descendant de E
    asm("NOP");
    LCD_E = 0;
}

// initialise le LCD : 8 bits, 2 lignes, curseur visible
void lcd_init(void)
{
    unsigned char i;
    tempo_ms(20);                 // attente après la mise sous tension (> 15 ms)
    for (i = 0; i < 3; i++)       // function set envoyé 3 fois, sans busy flag
    {
        LCD_RS = 0; LCD_RW = 0;
        LCD_DATA = 0b00111000;
        LCD_E = 1; asm("NOP"); LCD_E = 0;
        tempo_ms(5);
    }
    lcd_cmd(0b00111000);          // function set : 8 bits, 2 lignes, 5x8
    lcd_cmd(0b00001110);          // afficheur ON, curseur visible, sans clignotement
    lcd_cmd(0b00000001);          // effacer l'écran
    lcd_cmd(0b00000110);          // le curseur avance vers la droite
}

// affiche un texte à partir de la position du curseur
void lcd_string(const char *s)
{
    unsigned char i = 0;
    while (s[i] != '\\0')
    {
        lcd_char(s[i]);
        i++;
    }
}

// place le curseur : ligne 1 (adresses 0x00..0x0F) ou 2 (0x40..0x4F), col de 0 à 15
void lcd_placer_curseur(unsigned char ligne, unsigned char col)
{
    unsigned char adresse;
    if (ligne == 1) adresse = 0x00 + col;
    else            adresse = 0x40 + col;
    lcd_cmd(0b10000000 + adresse);   // commande "set DDRAM address"
}

// configure le bus LCD : données en sortie, RB3 (E), RB4 (RW), RB5 (RS) en sortie
void init_lcd_ports(void)
{
    LCD_DATA_TRIS = 0b00000000;
    TRISBbits.TRISB3 = 0; TRISBbits.TRISB4 = 0; TRISBbits.TRISB5 = 0;
    LCD_E = 0; LCD_RW = 0; LCD_RS = 0;
}
`;
const CLAVIER = `
/****************************************************************************/
/*      C L A V I E R   (lignes RA3..RA0 en sortie, colonnes RE2..RE0)      */
/****************************************************************************/
// touches[ligne][colonne]
const char touches[4][3] = {
    {'1','2','3'},   // ligne 0 : RA3
    {'4','5','6'},   // ligne 1 : RA2
    {'7','8','9'},   // ligne 2 : RA1
    {'*','0','#'}    // ligne 3 : RA0
};
// valeur à mettre sur PORTA pour activer chaque ligne
const unsigned char lignes[4] = {
    0b00001000,      // ligne 0 : RA3 à 1
    0b00000100,      // ligne 1 : RA2 à 1
    0b00000010,      // ligne 2 : RA1 à 1
    0b00000001       // ligne 3 : RA0 à 1
};

// lignes en sortie, colonnes en entrée (les colonnes ont une résistance vers la masse)
void init_clavier(void)
{
    ADCON1 = 0b00000111;   // PORTA et PORTE en numérique (analogiques au reset !)
    TRISA = 0b11110000;    // RA0..RA3 en sortie
    TRISE = 0b00000111;    // RE0..RE2 en entrée
}

// renvoie la touche appuyée, ou 0 si aucune
char scan_clavier(void)
{
    unsigned char i;
    for (i = 0; i < 4; i++)
    {
        PORTA = lignes[i];                           // une seule ligne à 1
        if (PORTEbits.RE2 == 1) return touches[i][0]; // colonne 0
        if (PORTEbits.RE1 == 1) return touches[i][1]; // colonne 1
        if (PORTEbits.RE0 == 1) return touches[i][2]; // colonne 2
    }
    return 0;
}

// attend un appui puis le relâchement, renvoie la touche
char lire_touche(void)
{
    char t;
    do { t = scan_clavier(); } while (t == 0);   // attente de l'appui
    while (scan_clavier() != 0);                  // attente du relâchement
    return t;
}
`;
const IT_VIDE = `
/****************************************************************************/
/*      I N T E R R U P T I O N S                                           */
/****************************************************************************/
void __interrupt(high_priority) myHighint(void)
{
    // pas d'interruption dans ce programme
}
`;
const MAIN_TITLE = `
/****************************************************************************/
/*      F O N C T I O N   P R I N C I P A L E                               */
/****************************************************************************/
`;
const SUB_TITLE = `
/****************************************************************************/
/*      S O U S   P R O G R A M M E S                                       */
/****************************************************************************/
`;
const SEG_CAB = ['PORT D -> nappe du module 7 segments', 'RB5 -> Dis0, RB4 -> Dis1, RB3 -> Dis2, RB2 -> Dis3'];
const LCD_CAB = ['PORT D -> nappe du module LCD', 'RB5 -> RS, RB4 -> RW, RB3 -> E'];

const LESSONS = [
  {
    id: 'seg1', title: 'Afficher un chiffre', icon: '8', modules: ['seg7'],
    goal: 'Comprendre TRIS / PORT et la logique inversée de la carte 7 segments.',
    notes: [
      'TRISx = 0 → broche en sortie, 1 → entrée. Au reset, tout est en entrée.',
      'Anode commune + transistors PNP : un segment s\'allume quand sa broche est à 0, un afficheur est choisi quand sa ligne Dis est à 0.',
      'La nappe PORTD arrive à l\'envers sur le module : RD7 = a … RD1 = g, RD0 = point.'
    ],
    defi: 'Affiche « 3 » sur Dis2 seulement, puis allume son point.',
    code: HEAD('afficher_chiffre.c', 'affiche le chiffre 7 sur l\'afficheur Dis0', SEG_CAB) + SEG_DEFS + SEG_FUNCS + IT_VIDE + MAIN_TITLE + `void main(void)
{
    init_afficheur();         // ports en sortie, tout éteint
    afficher_chiffre(7, 0);   // segments du 7, sans point
    DIS0 = 0;                 // on allume seulement Dis0

    while (1);                // le PIC n'a plus rien à faire
}
`
  },
  {
    id: 'seg2', title: 'Compteur 0 → 9', icon: '9', modules: ['seg7'],
    goal: 'Utiliser la table de conversion et une temporisation logicielle.',
    notes: [
      'table7seg[n] donne les 7 segments du chiffre n (0 = segment allumé).',
      'À 4 MHz, le PIC exécute 1 million d\'instructions par seconde : une boucle de NOP sert de temporisation.',
      'Mets la vitesse ×0,1 (en haut à gauche) pour voir le comptage au ralenti.'
    ],
    defi: 'Fais un décompteur 9 → 0 qui recommence, et allume le point quand on passe par 0.',
    code: HEAD('compteur_0_9.c', 'compte de 0 à 9 sur Dis0, un chiffre toutes les ~0,5 s', SEG_CAB) + SEG_DEFS + SEG_FUNCS + TEMPO + IT_VIDE + MAIN_TITLE + `void main(void)
{
    unsigned char n = 0;

    init_afficheur();
    DIS0 = 0;                     // un seul afficheur allumé en permanence

    while (1)
    {
        afficher_chiffre(n, 0);   // affiche n
        tempo_ms(500);            // ~0,5 s
        n++;
        if (n > 9) n = 0;         // on reboucle après 9
    }
}
`
  },
  {
    id: 'seg3', title: 'Multiplexage (1906)', icon: '⁴', modules: ['seg7'],
    goal: 'Afficher un nombre sur les 4 afficheurs en les allumant chacun à leur tour (affichage_nombre.c).',
    notes: [
      'Un seul afficheur est allumé à la fois ; en tournant assez vite (> 50 Hz pour l\'ensemble), l\'œil voit les 4.',
      'La luminosité dépend du temps passé allumé : sans wait_affichage() l\'affichage marche encore, mais plus faiblement.',
      'Éteindre tout avant de changer les segments évite les « fantômes ». Vitesse ×0,01 pour voir le balayage.'
    ],
    defi: 'Affiche un compteur qui s\'incrémente toutes les ~100 ms tout en restant multiplexé.',
    code: HEAD('affichage_nombre.c', 'affiche un nombre (1906) sur les 4 afficheurs 7 segments', SEG_CAB) + SEG_DEFS + SEG_FUNCS + IT_VIDE + MAIN_TITLE + `void main(void)
{
    init_afficheur();

    while (1)
    {
        refresh_afficheur(1906, 4);   // 4 = pas de point
    }
}
`
  },
  {
    id: 'bp', title: 'Boutons & interrupteurs', icon: '◉', modules: ['seg7', 'buttons', 'switches'],
    goal: 'Lire des entrées et détecter un appui (front) plutôt qu\'un niveau.',
    notes: [
      'BP0 sur RB0 : au repos la broche lit 1, appuyé elle lit 0. L\'interrupteur I0 est sur RC4.',
      'Pour compter les appuis, on mémorise l\'état précédent et on agit seulement sur le passage 1 → 0.'
    ],
    defi: 'BP1 (RB1) remet à zéro, et le compteur ne bouge pas si I0 est à 0.',
    code: HEAD('boutons.c', 'BP0 incrémente (I0 en haut) ou décrémente (I0 en bas) un chiffre', [...SEG_CAB, 'RB0 -> BP0, RC4 -> I0']) + `
#define BP0 PORTBbits.RB0     // 1 au repos, 0 appuyé
#define I0  PORTCbits.RC4     // 1 = levier en haut
` + SEG_DEFS + SEG_FUNCS + TEMPO + IT_VIDE + MAIN_TITLE + `void main(void)
{
    unsigned char n = 0;
    unsigned char avant = 1, maintenant;

    init_afficheur();        // RB0 et RB1 restent en entrée
    TRISC = 0xFF;            // port C en entrée (interrupteurs)
    DIS0 = 0;

    while (1)
    {
        maintenant = BP0;
        if (avant == 1 && maintenant == 0)   // front descendant = appui
        {
            if (I0) n++;                     // levier en haut : on monte
            else    n--;                     // levier en bas : on descend
            if (n == 10)  n = 0;
            if (n == 255) n = 9;             // 0 - 1 = 255 en unsigned char
        }
        avant = maintenant;
        afficher_chiffre(n, 0);
        tempo_ms(10);                        // anti-rebond simple
    }
}
`
  },
  {
    id: 'timer', title: 'Timer 10 ms', icon: '⧗', modules: ['seg7', 'bnc'],
    goal: 'Interruption Timer0 toutes les 10 ms, vérifiée à l\'oscilloscope sur RC0 (compteur_0_01s.c).',
    notes: [
      'Fcy = 4 MHz / 4 = 1 MHz : sans prédiviseur, le timer avance de 1 pas par µs. 10 ms = 10 000 pas → précharge 65 536 − 10 000 = 55 536 = 0xD8F0.',
      'RC0 est inversée à chaque interruption : à l\'oscillo on voit un carré de période 20 ms (2 × 10 ms) et de largeur haute 10 ms.',
      'Onglet INSTRUMENTS : mets 5 ms/div et regarde les mesures.'
    ],
    defi: 'Change la précharge pour obtenir une interruption toutes les 5 ms et vérifie-le à l\'oscillo.',
    code: HEAD('compteur_0_01s.c', 'compteur qui s\'incrémente toutes les 10 ms (interruption Timer0)', [...SEG_CAB, 'RC0 -> module BNC CH1 -> oscilloscope']) + SEG_DEFS + `
#define TEST_PIN PORTCbits.RC0   // pour vérifier le timer à l'oscilloscope

volatile unsigned int compteur = 0;   // modifié dans l'interruption -> volatile
` + SEG_FUNCS + `
/****************************************************************************/
/*      I N T E R R U P T I O N S                                           */
/****************************************************************************/
void __interrupt(high_priority) myHighint(void)
{
    if (INTCONbits.TMR0IF)
    {
        TEST_PIN ^= 1;            // on inverse RC0 à chaque interruption
        TMR0H = 0xD8;             // précharge : toujours TMR0H puis TMR0L
        TMR0L = 0xF0;
        INTCONbits.TMR0IF = 0;    // on remet le drapeau à 0
        compteur++;
        if (compteur > 9999) compteur = 0;
    }
}
` + SUB_TITLE + `
/* calcul du timer
 * on veut 1/100 s = 10 000 us, 1 pas = 1 us sans prédiviseur
 * 65 536 - 10 000 = 55 536 = 0xD8F0
 */
void init_timer0(void)
{
    T0CONbits.T0CS = 0;       // horloge interne Fosc/4
    T0CONbits.T08BIT = 0;     // mode 16 bits
    T0CONbits.PSA = 1;        // pas de prédiviseur
    TMR0H = 0xD8;
    TMR0L = 0xF0;
    T0CONbits.TMR0ON = 1;     // on lance le timer

    INTCONbits.TMR0IE = 1;    // autorise l'interruption du Timer0
    INTCONbits.GIE = 1;       // autorisation générale
}
` + MAIN_TITLE + `void main(void)
{
    TRISC = 0;                // RC0 en sortie
    TEST_PIN = 0;
    init_afficheur();
    init_timer0();

    while (1)
    {
        refresh_afficheur(compteur, 1);   // point après les secondes : SS.cc
    }
}
`
  },
  {
    id: 'chrono', title: 'TP1 · Chronomètre', icon: '⏱', modules: ['seg7', 'buttons', 'bnc'],
    goal: 'Chronomètre complet avec marche/pause et temps intermédiaire, par interruptions (chrono_finale.c).',
    notes: [
      'BP1 (RB1 = INT1) : marche / pause. BP0 (RB0 = INT0) : temps intermédiaire en marche, remise à zéro en pause.',
      'Une variable etat (machine à états) décide de ce que fait chaque bouton.',
      'Les interruptions INT0/INT1 se déclenchent par défaut sur front montant : au relâchement du bouton (actif à 0).'
    ],
    defi: 'Ajoute un compteur de tours affiché 1 s quand on prend un temps intermédiaire.',
    code: HEAD('chrono_finale.c', 'chronomètre avec marche, pause et temps intermédiaire', [...SEG_CAB, 'RB0 -> BP0, RB1 -> BP1', 'RC0 -> module BNC CH1 -> oscilloscope']) + SEG_DEFS + `
#define TEST_PIN PORTCbits.RC0

#define ETAT_INIT                0
#define ETAT_MARCHE              1
#define ETAT_PAUSE               2
#define ETAT_TEMPS_INTERMEDIAIRE 3

volatile unsigned int compteur = 0;           // centièmes de seconde (0 à 9999)
volatile unsigned char etat = ETAT_INIT;
volatile unsigned int temps_fige = 0;         // valeur affichée en temps intermédiaire
` + SEG_FUNCS + `
/****************************************************************************/
/*      I N T E R R U P T I O N S                                           */
/****************************************************************************/
void __interrupt(high_priority) myHighint(void)
{
    // Timer0 : toutes les 10 ms
    if (INTCONbits.TMR0IF)
    {
        TEST_PIN ^= 1;
        TMR0H = 0xD8;
        TMR0L = 0xF0;
        INTCONbits.TMR0IF = 0;
        if (etat == ETAT_MARCHE || etat == ETAT_TEMPS_INTERMEDIAIRE)
        {
            compteur++;
            if (compteur > 9999) compteur = 0;
        }
    }

    // BP1 (INT1) : marche / pause
    if (INTCON3bits.INT1IF)
    {
        INTCON3bits.INT1IF = 0;
        if (etat == ETAT_INIT || etat == ETAT_PAUSE) etat = ETAT_MARCHE;
        else if (etat == ETAT_MARCHE)                etat = ETAT_PAUSE;
    }

    // BP0 (INT0) : temps intermédiaire ou remise à zéro
    if (INTCONbits.INT0IF)
    {
        INTCONbits.INT0IF = 0;
        if (etat == ETAT_MARCHE) { etat = ETAT_TEMPS_INTERMEDIAIRE; temps_fige = compteur; }
        else if (etat == ETAT_TEMPS_INTERMEDIAIRE) etat = ETAT_MARCHE;
        else if (etat == ETAT_PAUSE) { etat = ETAT_INIT; compteur = 0; }
    }
}
` + SUB_TITLE + `
// Timer0 : 10 ms (voir leçon "Timer 10 ms")
void init_timer0(void)
{
    T0CONbits.T0CS = 0;
    T0CONbits.T08BIT = 0;
    T0CONbits.PSA = 1;
    TMR0H = 0xD8;
    TMR0L = 0xF0;
    T0CONbits.TMR0ON = 1;
    INTCONbits.TMR0IE = 1;
    INTCONbits.GIE = 1;
}

// boutons sur INT0 (RB0) et INT1 (RB1)
void init_boutons(void)
{
    TRISBbits.TRISB0 = 1;
    TRISBbits.TRISB1 = 1;
    INTCONbits.INT0IF = 0;  INTCONbits.INT0IE = 1;
    INTCON3bits.INT1IF = 0; INTCON3bits.INT1IE = 1;
}
` + MAIN_TITLE + `void main(void)
{
    unsigned int valeur;

    TRISC = 0;
    TEST_PIN = 0;
    init_afficheur();
    init_boutons();
    init_timer0();

    while (1)
    {
        if (etat == ETAT_TEMPS_INTERMEDIAIRE) valeur = temps_fige;
        else                                  valeur = compteur;
        refresh_afficheur(valeur, 1);
    }
}
`
  },
  {
    id: 'adc', title: 'TP2 · Voltmètre ADC', icon: '∿', modules: ['seg7', 'pots', 'bnc'],
    wiring: { bnc: { ch1: null, ch2: 'RA3' } },
    goal: 'Mesurer la tension du potentiomètre sur 10 bits toutes les 0,86 s et l\'afficher en mV (etape_4_conversion_adc.c).',
    notes: [
      'POT0 est sur RA3 = AN3. ADCON1 = 0b10000000 : résultat justifié à droite (10 bits), toutes les broches AN analogiques.',
      'ADCON0 = 0b10011001 : horloge Fosc/32, canal AN3, ADON = 1. GO/DONE = 1 lance la conversion.',
      'Timer0 avec prédiviseur 1:16 : 0,86 s = 53 750 pas → précharge 65 536 − 53 750 = 0x2E0A.',
      'Le calcul en mV utilise unsigned long (UL) : 1023 × 5090 dépasse un int 16 bits.'
    ],
    defi: 'Affiche la valeur brute (0…1023) tant que BP0 est appuyé.',
    code: HEAD('etape_4_conversion_adc.c', 'voltmètre 10 bits : affiche en mV la tension de POT0', [...SEG_CAB, 'RA3 -> POT0 -> module BNC CH2']) + SEG_DEFS + `
volatile unsigned int tension_mv = 0;   // mise à jour toutes les 0,86 s
` + SEG_FUNCS + `
// lance une conversion 10 bits et renvoie le résultat (0 à 1023)
unsigned int lire_adc_10bits(void)
{
    ADCON0bits.GODONE = 1;            // on démarre la conversion
    while (ADCON0bits.GODONE);        // le PIC remet GODONE à 0 à la fin
    return ((unsigned int)ADRESH << 8) + ADRESL;   // 2 bits de poids fort + 8 bits
}

// conversion en mV (5090 mV = tension mesurée de l'alimentation)
unsigned int convertir_en_mv(unsigned int valeur_adc)
{
    return (unsigned int)(((unsigned long)valeur_adc * 5090UL) / 1023UL);
}

/****************************************************************************/
/*      I N T E R R U P T I O N S                                           */
/****************************************************************************/
void __interrupt(high_priority) myHighint(void)
{
    if (INTCONbits.TMR0IF)
    {
        TMR0H = 0x2E;                 // précharge 0x2E0A
        TMR0L = 0x0A;
        INTCONbits.TMR0IF = 0;
        tension_mv = convertir_en_mv(lire_adc_10bits());
    }
}
` + SUB_TITLE + `
/* calcul du timer
 * on veut 0,86 s = 860 000 us, ça dépasse 65 536 -> prédiviseur >= 13,12 -> 1:16
 * 860 000 / 16 = 53 750 ; 65 536 - 53 750 = 11 786 = 0x2E0A
 */
void init_timer0(void)
{
    T0CONbits.T0CS = 0;       // Fosc/4
    T0CONbits.T08BIT = 0;     // 16 bits
    T0CONbits.PSA = 0;        // on utilise le prédiviseur
    T0CONbits.T0PS = 0b011;   // prédiviseur 1:16
    TMR0H = 0x2E;
    TMR0L = 0x0A;
    T0CONbits.TMR0ON = 1;
    INTCONbits.TMR0IE = 1;
    INTCONbits.GIE = 1;
}

void init_adc(void)
{
    TRISAbits.TRISA3 = 1;     // AN3 en entrée
    ADCON1 = 0b10000000;      // ADFM = 1 (justifié à droite), PCFG = 0000 : AN0..AN7 analogiques
    ADCON0 = 0b10011001;      // Fosc/32, canal AN3 (CHS = 011), ADON = 1
}
` + MAIN_TITLE + `void main(void)
{
    init_afficheur();
    init_adc();
    init_timer0();

    while (1)
    {
        refresh_afficheur(tension_mv, 0);   // X.XXX V
    }
}
`
  },
  {
    id: 'lcd', title: 'Écran LCD', icon: 'Aa', modules: ['lcd'],
    goal: 'Initialiser le LCD et écrire sur les deux lignes, avec lecture du busy flag (etape2.c).',
    notes: [
      'RS = 0 : commande, RS = 1 : caractère. La donnée est prise au front descendant de E.',
      'lcd_read() met RW = 1 et lit le bit 7 (busy flag) : on attend qu\'il passe à 0 avant chaque écriture.',
      'Ligne 1 : adresses 0x00 à 0x0F, ligne 2 : 0x40 à 0x4F. Commande « adresse » = 0x80 + adresse.'
    ],
    defi: 'Fais défiler « IG2I » sur la ligne 2 avec la commande de décalage 0x1C.',
    code: HEAD('etape2.c', 'écrit un texte sur chaque ligne du LCD', LCD_CAB) + TEMPO + LCD + IT_VIDE + MAIN_TITLE + `void main(void)
{
    init_lcd_ports();
    lcd_init();

    lcd_placer_curseur(1, 0);     // ligne 1, tout à gauche
    lcd_string("TEST LIGNE 1");
    lcd_placer_curseur(2, 0);     // ligne 2, tout à gauche
    lcd_string("TEST LIGNE 2");

    while (1);
}
`
  },
  {
    id: 'clavier', title: 'Clavier → LCD', icon: '#', modules: ['lcd', 'keypad'],
    goal: 'Lire le clavier matriciel par balayage et afficher la touche sur le LCD (etape3.c).',
    notes: [
      'On met UNE ligne à 1 (RA3, RA2, RA1 ou RA0) et on regarde quelle colonne (RE2, RE1, RE0) passe à 1.',
      'Ne pas oublier ADCON1 = 0x07 : RA et RE sont analogiques au reset et liraient toujours 0.',
      'Clique (et maintiens) les touches du clavier 3D.'
    ],
    defi: 'Affiche les 16 dernières touches à la suite sur la ligne 2.',
    code: HEAD('etape3.c', 'affiche sur le LCD la touche tapée au clavier', [...LCD_CAB, 'clavier : lignes RA3 RA2 RA1 RA0, colonnes RE2 RE1 RE0']) + TEMPO + LCD + CLAVIER + IT_VIDE + MAIN_TITLE + `void main(void)
{
    char t;

    init_lcd_ports();
    init_clavier();
    lcd_init();
    lcd_placer_curseur(1, 0);
    lcd_string("Touche :");

    while (1)
    {
        t = lire_touche();          // attend appui + relâchement
        lcd_placer_curseur(1, 9);
        lcd_char(t);                // affiche la touche
    }
}
`
  },
  {
    id: 'serrure', title: 'TP3 · Serrure codée', icon: '⌗', modules: ['lcd', 'keypad'],
    goal: 'Saisir un code à 4 chiffres, le comparer au code secret, avec effacement (etape5.c).',
    notes: [
      'Code secret : 0000. # efface tout, * efface le dernier chiffre.',
      'saisir_code() remplit un tableau de 4 caractères ; code_ok() compare case par case.',
      'Un tableau passé en paramètre (char saisie[4]) est en fait un pointeur : la fonction modifie le tableau du main.'
    ],
    defi: 'Bloque la serrure 5 s après 3 erreurs et affiche des étoiles au lieu des chiffres.',
    code: HEAD('etape5.c', 'saisie d\'un code à 4 chiffres, comparaison au code secret (0000)', [...LCD_CAB, 'clavier : lignes RA3 RA2 RA1 RA0, colonnes RE2 RE1 RE0']) + `
const char secret[4] = {'0','0','0','0'};
` + TEMPO + LCD + CLAVIER + `
// saisit 4 chiffres et les affiche ; # efface tout, * efface le dernier
void saisir_code(char saisie[4])
{
    unsigned char compteur = 0;
    char t;

    lcd_cmd(0b00000001);            // effacer l'écran
    lcd_string("Code : ");
    while (compteur < 4)
    {
        t = lire_touche();
        if (t == '#')                // tout effacer
        {
            lcd_cmd(0b00000001);
            lcd_string("Code : ");
            compteur = 0;
        }
        else if (t == '*')           // effacer le dernier chiffre
        {
            if (compteur > 0)
            {
                compteur--;
                lcd_placer_curseur(1, 7 + compteur);   // case du dernier chiffre
                lcd_char(' ');                          // on l'efface (le curseur avance)
                lcd_placer_curseur(1, 7 + compteur);   // on revient sur la case vide
            }
        }
        else                         // un chiffre
        {
            saisie[compteur] = t;
            lcd_char(t);
            compteur++;
        }
    }
}

// renvoie 1 si les 4 chiffres sont bons, 0 sinon
unsigned char code_ok(char saisie[4])
{
    unsigned char i;
    for (i = 0; i < 4; i++)
        if (saisie[i] != secret[i]) return 0;
    return 1;
}

void afficher_resultat(unsigned char ok)
{
    lcd_placer_curseur(2, 0);
    if (ok == 1) lcd_string("CODE BON");
    else         lcd_string("CODE MAUVAIS");
    tempo_ms(1000);
}
` + IT_VIDE + MAIN_TITLE + `void main(void)
{
    char saisie[4];

    init_lcd_ports();
    init_clavier();
    lcd_init();

    while (1)
    {
        saisir_code(saisie);                  // on tape le code
        afficher_resultat(code_ok(saisie));   // on compare et on affiche
    }
}
`
  },
  {
    id: 'freq', title: 'TP4 · Fréquencemètre', icon: '≋', modules: ['lcd', 'gbf', 'bnc'],
    wiring: { bnc: { ch1: 'RB0' } },
    goal: 'Compter les fronts du GBF sur INT0 (RB0) pendant 1 s (base de temps Timer0) et afficher « 0008 Hertz ».',
    notes: [
      'Chaque front montant du GBF déclenche INT0 : on incrémente un compteur dans l\'interruption.',
      'Timer0 avec prédiviseur 1:16 : 1 s = 62 500 pas → précharge 65 536 − 62 500 = 3 036 = 0x0BDC. À chaque débordement on recopie le compteur et on le remet à 0.',
      'Pourquoi un timer et pas une tempo ? Chaque interruption INT0 vole du temps à la boucle de tempo : la « seconde » s\'allonge et la mesure est fausse (+3 % à 2,6 kHz).',
      'Règle le GBF dans l\'onglet INSTRUMENTS ; CH1 de l\'oscillo est sur RB0.'
    ],
    defi: 'Mode périodemètre : compter des pas de 10 µs (Timer2) entre deux fronts et afficher « 00108 Microsec ».',
    code: HEAD('frequencemetre.c', 'mesure la fréquence du GBF (fronts sur INT0 comptés pendant 1 s)', [...LCD_CAB, 'GBF (TTL) -> RB0 (INT0) et module BNC CH1']) + `
volatile unsigned int impulsions = 0;     // fronts comptés pendant la seconde en cours
volatile unsigned int frequence = 0;      // résultat de la dernière seconde
volatile unsigned char nouvelle_mesure = 0;
` + TEMPO + LCD + `
/****************************************************************************/
/*      I N T E R R U P T I O N S                                           */
/****************************************************************************/
void __interrupt(high_priority) myHighint(void)
{
    // front montant du GBF sur RB0
    if (INTCONbits.INT0IF)
    {
        INTCONbits.INT0IF = 0;
        impulsions++;
    }
    // Timer0 : une seconde est passée
    if (INTCONbits.TMR0IF)
    {
        TMR0H = 0x0B;             // précharge 0x0BDC
        TMR0L = 0xDC;
        INTCONbits.TMR0IF = 0;
        frequence = impulsions;   // nombre de fronts en 1 s = fréquence en Hz
        impulsions = 0;
        nouvelle_mesure = 1;
    }
}
` + SUB_TITLE + `
/* calcul du timer
 * on veut 1 s = 1 000 000 us -> prédiviseur >= 15,3 -> 1:16
 * 1 000 000 / 16 = 62 500 ; 65 536 - 62 500 = 3 036 = 0x0BDC
 */
void init_timer0(void)
{
    T0CONbits.T0CS = 0;
    T0CONbits.T08BIT = 0;
    T0CONbits.PSA = 0;
    T0CONbits.T0PS = 0b011;   // 1:16
    TMR0H = 0x0B;
    TMR0L = 0xDC;
    T0CONbits.TMR0ON = 1;
    INTCONbits.TMR0IE = 1;
}

// GBF sur INT0 (RB0), front montant
void init_int0(void)
{
    TRISBbits.TRISB0 = 1;
    INTCON2bits.INTEDG0 = 1;  // front montant
    INTCONbits.INT0IF = 0;
    INTCONbits.INT0IE = 1;
}

// affiche un nombre sur 5 chiffres
void lcd_nombre(unsigned int v)
{
    lcd_char('0' + (v / 10000) % 10);
    lcd_char('0' + (v / 1000) % 10);
    lcd_char('0' + (v / 100) % 10);
    lcd_char('0' + (v / 10) % 10);
    lcd_char('0' + v % 10);
}
` + MAIN_TITLE + `void main(void)
{
    ADCON1 = 0b00000111;      // ports A et E en numérique
    init_lcd_ports();
    lcd_init();
    lcd_cmd(0b00001100);      // curseur caché
    lcd_placer_curseur(2, 0);
    lcd_string("Frequencemetre");

    init_int0();
    init_timer0();
    INTCONbits.GIE = 1;

    while (1)
    {
        if (nouvelle_mesure)  // une fois par seconde
        {
            nouvelle_mesure = 0;
            lcd_placer_curseur(1, 0);
            lcd_nombre(frequence);
            lcd_string(" Hertz");
        }
    }
}
`
  },
  {
    id: 'musique', title: 'TP5 · Musique (PWM)', icon: '♪', modules: ['keypad', 'buzzer', 'bnc'],
    wiring: { bnc: { ch1: 'RC2' } },
    goal: 'Jouer la gamme puis la note de la touche appuyée, avec la sortie PWM CCP1 (RC2) et le Timer2.',
    notes: [
      'Période PWM : T = (PR2 + 1) × 4 × Tosc × prédiviseur. À 4 MHz avec un prédiviseur de 16 : T = (PR2 + 1) × 16 µs, donc PR2 = 1 000 000 / (16 × f) − 1.',
      'Niveau haut sur 10 bits (CCPR1L:DC1B) : pour un carré (Th = T/2) il vaut 2 × (PR2 + 1).',
      'Clique sur le gros bouton « Activer le son » pour entendre le buzzer (à la vitesse ×1).',
      'Touches 1 à 9, *, 0, # : les 12 premières notes de la gamme.'
    ],
    defi: 'Enregistrer une mélodie (touches + durées) puis la rejouer en entier.',
    code: HEAD('musique.c', 'joue la gamme (1/2 s par note) puis la note de la touche appuyée', ['RC2 (CCP1) -> module buzzer et module BNC CH1', 'clavier : lignes RA3 RA2 RA1 RA0, colonnes RE2 RE1 RE0']) + `
// PR2 pour Do Do# Ré Ré# Mi Fa Fa# Sol Sol# La Sib Si do (prédiviseur 16)
const unsigned char pr2_note[13] = {238, 225, 212, 200, 188, 178, 168, 158, 150, 141, 133, 126, 118};
` + TEMPO + CLAVIER + `
// lance le PWM : Timer2 avec prédiviseur 16, CCP1 en mode PWM sur RC2
void init_pwm(void)
{
    TRISCbits.TRISC2 = 0;     // RC2 en sortie
    T2CON = 0b00000111;       // TMR2ON = 1, prédiviseur 1:16
    CCP1CON = 0b00001100;     // CCP1 en mode PWM
}

// joue une note : PR2 fixe la période, CCPR1L:DC1B la moitié de la période
void jouer_note(unsigned char pr2)
{
    unsigned int th = 2 * ((unsigned int)pr2 + 1);   // largeur du niveau haut sur 10 bits
    PR2 = pr2;
    CCPR1L = th >> 2;             // 8 bits de poids fort
    CCP1CONbits.DC1B = th & 3;    // 2 bits de poids faible
}

// coupe le son (rapport cyclique à 0)
void silence(void)
{
    CCPR1L = 0;
    CCP1CONbits.DC1B = 0;
}

// numéro de note (0 à 11) de chaque touche, -1 si ce n'est pas une note
signed char note_de(char t)
{
    if (t >= '1' && t <= '9') return t - '1';   // 1..9 -> notes 0..8
    if (t == '*') return 9;
    if (t == '0') return 10;
    if (t == '#') return 11;
    return -1;
}
` + IT_VIDE + MAIN_TITLE + `void main(void)
{
    unsigned char n;
    char t;

    init_clavier();
    init_pwm();

    for (n = 0; n < 13; n++)      // 1) la gamme complète, 1/2 s par note
    {
        jouer_note(pr2_note[n]);
        tempo_ms(500);
    }
    silence();

    while (1)                     // 2) une note tant qu'une touche est appuyée
    {
        t = scan_clavier();
        if (t != 0) jouer_note(pr2_note[note_de(t)]);
        else        silence();
    }
}
`
  },
  {
    id: 'spi', title: 'TP6 · Bus SPI + CNA', icon: '⇄', modules: ['dac', 'bnc'],
    wiring: { bnc: { ch1: null } }, scope: { ch1: 'dac' },
    goal: 'Envoyer des valeurs 12 bits au convertisseur MCP4921 par le bus SPI et générer un triangle.',
    notes: [
      'MSSP en SPI maître : SCK = RC3, SDO = RC5 (SDI = RC4). Le MCP4921 reçoit aussi CS (RC6) et LDAC (RC7), actifs à 0.',
      'Un mot de 16 bits = 2 octets : 4 bits de configuration (0111 = voie A, buffer, gain ×1, actif) puis 12 bits de valeur. Vout = 5 V × valeur / 4096.',
      'Après chaque écriture dans SSPBUF, attendre SSPIF = 1 (fin de l\'octet) avant d\'écrire le suivant.',
      'CH1 de l\'oscillo affiche Vout du MCP4921 : mets 100 ms/div.'
    ],
    defi: 'Génère un sinus avec une table de 32 valeurs, puis règle sa fréquence avec le potentiomètre.',
    code: HEAD('tp6_spi.c', 'génère un triangle 0 -> 5 V sur Vout du MCP4921 (bus SPI)', ['RC3 (SCK) -> SCK, RC5 (SDO) -> SDI du MCP4921', 'RC6 -> CS, RC7 -> LDAC', 'Vout du MCP4921 -> oscilloscope CH1']) + `
#define CS   PORTCbits.RC6    // chip select du MCP4921 (actif à 0)
#define LDAC PORTCbits.RC7    // recopie vers la sortie (actif à 0)

unsigned int valeur = 0;
` + IT_VIDE + SUB_TITLE + `
// envoie une valeur 12 bits au MCP4921 (2 octets)
void mcp4921(unsigned int v)
{
    unsigned char haut, bas;

    PIR1bits.SSPIF = 0;
    CS = 0;                       // début de la trame

    haut = v / 256;               // 8 bits de poids fort
    haut = haut & 0x0F;           // on garde les 4 bits de la donnée
    haut = haut | 0x70;           // + 0111 : voie A, buffer, gain x1, actif
    SSPBUF = haut;
    while (PIR1bits.SSPIF == 0);  // attend la fin de l'envoi
    PIR1bits.SSPIF = 0;

    bas = v & 0x00FF;             // 8 bits de poids faible
    SSPBUF = bas;
    while (PIR1bits.SSPIF == 0);
    PIR1bits.SSPIF = 0;

    CS = 1;                       // fin de la trame
    LDAC = 0;                     // impulsion sur LDAC : Vout se met à jour
    LDAC = 1;
}

void init(void)
{
    TRISC = 0b00010000;           // RC4 (SDI) en entrée, le reste en sortie
    LDAC = 1;
    CS = 1;
    SSPSTATbits.CKE = 1;          // donnée valide sur le front montant de SCK
    SSPCON1 = 0x20;               // SSPEN = 1, SPI maître, horloge Fosc/4
}
` + MAIN_TITLE + `void main(void)
{
    init();
    while (1)                     // triangle : on monte puis on descend
    {
        while (valeur < 0x0FF0) { mcp4921(valeur); valeur += 16; }
        while (valeur > 0)      { mcp4921(valeur); valeur -= 16; }
    }
}
`
  },
  {
    id: 'libre', title: 'Banc libre', icon: '+', free: true, modules: ['seg7', 'lcd', 'keypad', 'buttons', 'switches', 'pots', 'buzzer', 'dac', 'gbf', 'bnc'],
    goal: 'Page blanche : ouvre tes propres fichiers .c (bouton ⇪), choisis tes modules et câble comme tu veux.',
    notes: [
      'Aucun câblage imposé : branche les fils et les nappes selon ton programme.',
      'Ajoute ou retire des modules avec le bouton + en bas à droite de la scène 3D.'
    ],
    defi: '',
    code: HEAD('mon_programme.c', 'à toi de jouer', ['à compléter'], 'ton nom') + IT_VIDE + MAIN_TITLE + `void main(void)
{
    TRISD = 0x00;      // exemple : PORTD en sortie

    while (1)
    {

    }
}
`
  },
];


// ---------- squelette (modèle de programme des TP) ----------
function squelette(L, sol) {
  const nom = sol ? ((/nom:\s+(.+)/.exec(sol) || [])[1] || 'programme.c').trim() : 'mon_programme.c';
  const m = sol ? /cablage:\s+([\s\S]*?)\n \*\//.exec(sol) : null;
  const cab = m ? m[1].split('\n').map(l => l.replace(/^\s*\*\s*/, '').trim()).filter(Boolean) : ['le fil rouge sur le bouton rouge, le fil vert sur le bouton vert'];
  const defs = sol ? sol.split('\n').filter(l => /^#define\s+\w+\s+(PORT|LAT|TRIS)[A-E]?(bits)?(\.\w+)?\b/.test(l)) : ['#define pot0   PORTAbits.RA0'];
  return `/**
 *  nom:        ${nom}
 *  auteurs:    Vous
 *  date:       
 *  version     0.1
 *
 *  descriptif: ${L.goal}
 *  cablage:    ${cab.join('\n *              ')}
 *  tests:      test1: .....     V ou NV
 *              test2: .....     V ou NV
 *  validation: non fonctionnelle, partielle ou totale
 */

/****************************************************************************/
/*      I N C L U D E S   S T A N D A R D S                                 */
/****************************************************************************/
#include <xc.h>

/****************************************************************************/
/*      C O N F I G U R A T I O N                                           */
/****************************************************************************/
#pragma config OSC = XT     // quartz 4 MHz (Fcy = 1 MHz)
#pragma config WDT = OFF    // pas de chien de garde

/****************************************************************************/
/*      C O N S T A N T E S   S Y M B O L I Q U E S                         */
/****************************************************************************/
${defs.join('\n')}

/****************************************************************************/
/*      P R O T O T Y P E S   D E   F O N C T I O N S                       */
/****************************************************************************/
void init(void);

/****************************************************************************/
/*      V A R I A B L E S   G L O B A L E S                                 */
/****************************************************************************/


/****************************************************************************/
/*      T R A I T E M E N T S   D ' I N T E R R U P T I O N                 */
/****************************************************************************/
void __interrupt(high_priority) myHighint(void)
{

}

/****************************************************************************/
/*      Z O N E   D E   S O U S   P R O G R A M M E S                       */
/****************************************************************************/
void init(void)
{
    // configurer ici les ports (TRISx), les timers, les interruptions...

}

/****************************************************************************/
/*      F O N C T I O N   P R I N C I P A L E                               */
/****************************************************************************/
void main(void)
{
    init();

    while (1)
    {
        // la suite du programme s'effectue en boucle

    }
}
`;
}
for (const L of LESSONS) {
  if (L.free) { L.solution = null; L.code = squelette(L, null); }
  else { L.solution = L.code; L.code = squelette(L, L.solution); }
}
LESSONS.unshift(...LESSONS.splice(LESSONS.findIndex(l => l.free), 1));

export { LESSONS, DEFAULT_WIRING };
