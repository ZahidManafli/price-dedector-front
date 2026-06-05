/**
 * titleChecker.js
 * Front-end only title safety checker.
 * Returns { veroMatches: string[], prohibitedMatches: string[] }
 */

const VERO_WORDS = [
  'Bestsun','Syston','Resqme','BiOptimizers','Rhino','Muddy','Ocuvite','Filson',
  'Piping Rock','Stomp Rocket','TruSkin','NutraChamps','Culturelle','Mucinex',
  'Flame King','BedShelfie','Flexzilla','Freshcut','Roku','Choking','Cafe la Llave',
  'Purina','Equate','Abdominal','Uota','RoyalBlaze','18650','Woolite','Seresto',
  'Bausch lomb','Nutramax','DVD','Carlyle','CoQ10','Xyzal','NativePath','Clorox',
  'Airwick','BorActin','Harness','BioAdvanced','Syringe','Terbinafine','Kitsch',
  'FSRTEP','Lumify','Airscent','Flitz','Goli','StellaLife','Xymogen',
  'Thread Protector','Pandora','neem','Prevagen','Kill','Kills','Heartburn',
  'Reflux','Gundry MD','Petarmor','O-Cedar','Police','Ocedar','Mop','Dermalogica',
  'Camco','TastePURE','Self Defense','Self-Defense',"Palmer's",'Startech','RODAN',
  'tarte','innisfree','LANEIGE','Karseell','Lune+Aster','KeaBabies','SUP-Now',
  'Remington','Cree','Abdominal Roller','Mederma','Greatever','Country Book',
  'Darn Tough','BonusLife','K-Y','Needle','Lab Dispensing','DreamWear','Ozium',
  'Angry Duck','OVEGA-3','Disinfectant Wipes','Michigan Motorsports','Zip-It',
  'Cap & Shield','Schumacher Electric','Darn Tough Vermont','SolarEnz','Vixen Air',
  'Srixon','Rosabella','AquaBliss','Grooveit','Shibumi Shade','EMPORIA','LEERLY',
  'Clorox Pool & Spa','Quincry','EPA','MuscleTech','Levocetirizine','Allergy Relief',
  'Disinfecting Wipes','patent','patented','Archer Watch','BLINK','MORA',
  'Cloudpoem',"Harry's",'Torriden','Rogue Iron Sports','Snap Supplements',
  'Victorinox','Lume','AquaDance','Mellanni','Biotrue','Avène','Sof Sole','Spenco',
  'PMD Beauty','baby wipes','Designs for Health','Hims','Toniiq','VEEKTOMX',
  'Hydro Flask','Rodent repellent','Horbäach','Xtremeclear','DUDE Wipes',
  'MFi Certified','Lysol','RAParts','Bohning','Laser Pointer','Isotonix',
  'Cockroach','Scoop Away','Eelhoe','FIÈRA','Carlson',"Stella & Chewy's",'VESA',
  'U.S. Polo Assn','Durvet','PQQ','PQQ Supplement',"L'ANGE",'Kaico','Wahbite',
  'Methylene','LAUNCH','Voyager','Best Pet Supplies','Hermony Essentials','Nutricost',
  'DERMAXGEN','CURT',"Good'n'Fun","Good'N'Tasty",'ubdyo','Joesoef','Taramps',
  'Whisker','Tetra','SUNGUY','UYODM','SKYJO','Red Cherry','Olaplex','Crizal',
  'SAVANA','Promescent','TALKING POINT CARDS','Sulwhasoo','VEGAMOUR','TATCHA',
  'Beauty of Joseon','URQT','René Furterer','Rene Furterer','PlayMonster',
  'GahsElec','Bio-Botanical Research','Biocidin','Righteous Roots','4Knines',
  'LubeLife','Genesis Holistic Health','Expert Hair','Selkirk Sport','Air Wick',
  'CRIMPIT','Velcro','Anua','Paint by numbers','Diamond painting',
  'Lost Boy Entertainment','Piles','Australian Gold','BASK & LATHER','SINCODA',
  'Beadnova','Divine','Sethe lord',"Kiehl's",'DiorSun','CGK Unlimited','Bloom',
  'Summer Fridays',"Paula's Choice",'Kerastase','Thrive Causemetics','Thrive',
  'MRYUESG','Redken','Spectrum','Curl Defining Brush','Curly Hair Brush',
  'PerioSciences','Saw Blade','ZZEM SCREW','DCNETWORK','BFIVEANTE','XIGRALUCK',
  'TSA Key','ZIYIZE','Suave','boveda','Gyro ball','JUNMEI','BuJinZeTui','pocrrmcb',
  'Elonbo','UMLIFE','Utopia','LifePro','Mercurydean','K9 Advantix','TALES',
  'Conservation Cards','Rechargeable','lunavia',"Nature's Choice Supplements",
  'rabbitgoo','OtterBox','Sports Research','NNQEKBUF',
  'LE SALICULTEUR DE GUERANDE','Brokeir','JOYIN','Strider','EHBELIF','Lucky Egg',
  'Omie','Royal Designs','nbpure','CARVENSEY','AmorArtSky','HARIO','TOPDON',
  'Battery Daddy','Ontel','Rubbermaid','United Solutions Inc.','Otdwsd','ZZLTAWS',
  'AIPPK','YOQ','True Legend','COSLUS','VCHOMY','Scrub Daddy','NIASSO',
  'Arm & Hammer','Bubble Skincare','YRYM HT','Alex Tech','WinCraft','ComStar',
  'Solomon','Pure Encapsulations','Good Breath Labs','IKEA','BEATBIT','Franco',
  'MAFONE','POP MART','YONGJUNG','Lidguni','Hohoky','SVPSNUMSI','HexClad',
  'Veteran Tire and Rubber','Otstar','SupKing','PUSHPEEL','Genexa','FALAN MULE',
  // Major brand names from vero list
  '3M','3M Company','Alessi','Amway','Arduino','Arturia','Axon','Taser',
  'Abercrombie & Fitch','ADT','American Eagle Outfitters',
  'Bose','Bridgestone','Brother International','Buck Knives','Burberry','Cartier',
  'Chanel','Coach','Crocs','Canon','Colnago','Dermalogica','Duracell','Dyson',
  'Ariat','Dansko','DeLorean','Digium','Funko','Funko Pop','Gucci',
  'Hilti','Honda','Hoover','Husqvarna','John Deere','Kawasaki',
  'Kitchenaid','Leatherman','Lego','Louis Vuitton','Marc Jacobs','Miele',
  'Milwaukee Tool','Nikon','Nike','Pandora','Patagonia','Philips',
  'Samsung','Sennheiser','Shimano','Shiseido','Snap-on','Sony',
  'Swarovski','Swiss Army','Tiffany','Tommy Hilfiger','Volkswagen',
  'Versace','Vitamix','Yamaha','Yeti','Zippo','Oakley','Ray-Ban','Rolex',
  'Tissot','Omega','Casio','Seiko','Tag Heuer','Montblanc','Hermes','Prada',
  'Dolce Gabbana','Armani','Calvin Klein','Ralph Lauren',
];

// ── Prohibited / restricted words ────────────────────────────────────────────
// These highlight inline in YELLOW (same style as VERO but yellow)
const PROHIBITED_WORDS = [
  // Common chemical ingredients found in product titles
  'acetone','chloroform','nitric acid','sulfuric acid','hydrochloric acid',
  'formaldehyde','benzene','toluene','cyanide','arsenic','mercury',
  'asbestos','ddt','phosgene','sarin','mustard gas',
  'ammonium nitrate','potassium nitrate','sodium azide','sodium cyanide',
  'potassium cyanide','phosphine','sodium chlorate','potassium chlorate',
  'perchlorate','nitrocellulose','rdx','hmx','petn','thermite','flash powder',
  'black powder','smokeless powder','gunpowder','gun powder',
  // Pharma / controlled substances
  'ephedrine','pseudoephedrine','phenylpropanolamine','methylamine',
  'safrole','piperonal','isosafrole','ketamine','fentanyl','morphine',
  'oxycodone','oxycontin','hydrocodone','vicodin','codeine','tramadol',
  'alprazolam','xanax','diazepam','valium','clonazepam','rohypnol','ghb',
  'methamphetamine','mdma','ecstasy','lsd','psilocybin','dmt','cocaine',
  'heroin','opium','thc','marijuana','cannabis','cbd oil',
  'anabolic steroid','testosterone injection','hgh','human growth hormone',
  'semaglutide','ozempic','wegovy','tirzepatide','mounjaro',
  // Weapon-adjacent
  'silencer','suppressor','auto sear','solvent trap','bump stock',
  'glock switch','ghost gun','zip gun','stun gun',
  // Counterfeit
  'replica','counterfeit','fake','bootleg','knockoff',
  // Hazardous product types
  'pipe bomb','explosive','blasting cap','detonator','napalm','molotov',
  // Regulated ingredients in product titles
  'sodium bromide','bromine','algaecide','rodenticide','pesticide',
  'insecticide','herbicide','fungicide','biocide',
  // Restricted product keywords
  'spy camera','hidden camera','covert camera','pinhole camera',
  'signal jammer','gps jammer','wifi jammer','radar detector','laser jammer',
  'skeleton key','bump key','lock pick','master key',
  'chloroquine','ivermectin','bleach injection','miracle mineral solution',
  // Wildlife / banned goods
  'ivory','rhino horn','shark fin','endangered species',
  // Age / safety
  'tobacco','nicotine','e-cigarette','vape juice','vaping liquid',
];

/**
 * Word-boundary-aware substring match.
 * A "boundary" here means the character before/after the word is NOT a-z or 0-9.
 * This handles spaces, |, %, +, -, etc. correctly.
 */
function matchesWordBoundary(haystack, needle) {
  let start = 0;
  while (start < haystack.length) {
    const idx = haystack.indexOf(needle, start);
    if (idx === -1) return false;
    const charBefore = idx === 0 ? '' : haystack[idx - 1];
    const charAfter = idx + needle.length >= haystack.length ? '' : haystack[idx + needle.length];
    const beforeOk = charBefore === '' || !/[a-z0-9]/.test(charBefore);
    const afterOk  = charAfter  === '' || !/[a-z0-9]/.test(charAfter);
    if (beforeOk && afterOk) return true;
    start = idx + 1;
  }
  return false;
}

/**
 * Check a product title against VERO and prohibited word lists.
 * @param {string} title
 * @returns {{ veroMatches: string[], prohibitedMatches: string[] }}
 */
export function checkTitle(title) {
  if (!title || typeof title !== 'string') {
    return { veroMatches: [], prohibitedMatches: [] };
  }

  const lower = title.toLowerCase();

  const veroMatches = VERO_WORDS.filter((word) =>
    matchesWordBoundary(lower, word.toLowerCase())
  );

  const prohibitedMatches = PROHIBITED_WORDS.filter((word) =>
    matchesWordBoundary(lower, word.toLowerCase())
  );

  return {
    veroMatches: [...new Set(veroMatches)],
    prohibitedMatches: [...new Set(prohibitedMatches)],
  };
}

export function getTitleWarnings(title) {
  const { veroMatches, prohibitedMatches } = checkTitle(title);
  if (!veroMatches.length && !prohibitedMatches.length) return null;
  return { veroMatches, prohibitedMatches };
}