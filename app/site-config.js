export const SITE_CONFIG = {
  meta: {
    title: 'Celebration Cake',
  },
  event: {
    recipientName: 'Tati',
    congratsHeadline: 'CONGRATULATIONS!',
    revealTopText: 'It is now down to two',
    revealBottomText: 'March 28th, 2026',
    revealSelectableKeys: ['michigan', 'maryland'],
  },
};

export const CAKE_SCHOOLS = [
  { key: 'pennstate', name: 'Penn State', logo: 'logos/pennstate.png', aspect: 5.55, scale: 0.55, fallbackColor: '#041E42' },
  { key: 'rutgers', name: 'Rutgers', logo: 'logos/rutgers.png', aspect: 1.14, scale: 0.85, fallbackColor: '#CC0033' },
  { key: 'uconn', name: 'UConn', logo: 'logos/uconn.png', aspect: 4.63, scale: 0.55, fallbackColor: '#000E2F' },
  {
    key: 'michigan',
    name: 'Michigan',
    logo: 'logos/michigan.png',
    aspect: 1.0,
    scale: 1.725,
    fallbackColor: '#00274C',
    primary: 0x00274c,
    secondary: 0xffcb05,
    primaryCSS: '#00274C',
    secondaryCSS: '#FFCB05',
    goText: 'GO BLUE!',
    audio: 'michigan-fight.mp3',
    monument: 'cube',
    revealPlanePosition: { x: 0.85, y: 2.07, z: -0.15 },
    revealLabelX: 680,
  },
  { key: 'syracuse', name: 'Syracuse', logo: 'logos/syracuse.png', aspect: 0.74, scale: 0.85, fallbackColor: '#F76900' },
  { key: 'umass', name: 'UMass', logo: 'logos/umass.png', aspect: 1.22, scale: 0.85, fallbackColor: '#881C1C' },
  { key: 'boston', name: 'Boston U', logo: 'logos/boston.png', aspect: 1.37, scale: 0.85, fallbackColor: '#CC0000' },
  { key: 'loyola', name: 'LMU', logo: 'logos/loyola.png', aspect: 1.71, scale: 0.75, fallbackColor: '#B62B3A' },
  { key: 'delaware', name: 'Delaware', logo: 'logos/delaware.png', aspect: 3.69, scale: 0.55, fallbackColor: '#00539F' },
  {
    key: 'maryland',
    name: 'Maryland',
    logo: 'logos/maryland.png',
    aspect: 0.91,
    scale: 1.3225,
    fallbackColor: '#E03A3E',
    primary: 0xce1126,
    secondary: 0xfcd116,
    primaryCSS: '#CE1126',
    secondaryCSS: '#FCD116',
    goText: 'GO TERRAPINS!',
    audio: 'maryland-fight.mp3',
    monument: 'mLetter',
    revealPlanePosition: { x: -0.85, y: 2.07, z: -0.15 },
    revealLabelX: 344,
  },
  { key: 'vermont', name: 'Vermont', logo: 'logos/vermont.png', aspect: 1.02, scale: 0.85, fallbackColor: '#154734' },
  { key: 'hawaii', name: 'Hawaii', logo: 'logos/hawaii.png', aspect: 1.32, scale: 0.85, fallbackColor: '#024731' },
];

export const DEFAULT_SCHOOL_KEY = 'michigan';

export const SELECTABLE_SCHOOLS = Object.fromEntries(
  SITE_CONFIG.event.revealSelectableKeys.map((key) => {
    const school = CAKE_SCHOOLS.find((entry) => entry.key === key);
    return [key, school];
  })
);
