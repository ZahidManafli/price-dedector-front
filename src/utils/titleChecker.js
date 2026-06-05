/**
 * titleChecker.js
 * Front-end only title safety checker.
 * Returns { veroMatches: string[], prohibitedMatches: string[] }
 */

// ── VERO words (brand / IP owners that actively report listings) ──────────────
// Source: verolist-j1.txt line 1 (comma-separated phrases)
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
  'Camco','TastePURE','Self Defense','Self-Defense','Palmer\'s','Startech','RODAN',
  'tarte','innisfree','LANEIGE','Karseell','Lune+Aster','KeaBabies','SUP-Now',
  'Remington','Cree','Abdominal Roller','Mederma','Greatever','Country Book',
  'Darn Tough','BonusLife','K-Y','Needle','Lab Dispensing','DreamWear','Ozium',
  'Angry Duck','OVEGA-3','Disinfectant Wipes','Michigan Motorsports','Zip-It',
  'Cap & Shield','Schumacher Electric','Darn Tough Vermont','SolarEnz','Vixen Air',
  'Srixon','Rosabella','AquaBliss','Grooveit','Shibumi Shade','EMPORIA','LEERLY',
  'Clorox Pool & Spa','Quincry','EPA','MuscleTech','Levocetirizine','Allergy Relief',
  'Disinfecting Wipes','patent','patented','Archer Watch','BLINK','MORA',
  'Cloudpoem','Harry\'s','Torriden','Rogue Iron Sports','Snap Supplements',
  'Victorinox','Lume','AquaDance','Mellanni','Biotrue','Avène','Sof Sole','Spenco',
  'PMD Beauty','baby wipes','Designs for Health','Hims','Toniiq','VEEKTOMX',
  'Hydro Flask','Rodent repellent','Horbäach','Xtremeclear','DUDE Wipes',
  'MFi Certified','Lysol','RAParts','Bohning','Laser Pointer','Isotonix',
  'Cockroach','Scoop Away','Eelhoe','FIÈRA','Carlson','Stella & Chewy\'s','VESA',
  'U.S. Polo Assn','Durvet','PQQ','PQQ Supplement','L\'ANGE','Kaico','Wahbite',
  'Methylene','LAUNCH','Voyager','Best Pet Supplies','Hermony Essentials','Nutricost',
  'DERMAXGEN','CURT','Good\'n\'Fun','Good\'N\'Tasty','ubdyo','Joesoef','Taramps',
  'Whisker','Tetra','SUNGUY','UYODM','SKYJO','Red Cherry','Olaplex','Crizal',
  'SAVANA','Promescent','TALKING POINT CARDS','Sulwhasoo','VEGAMOUR','TATCHA',
  'Beauty of Joseon','URQT','René Furterer','Rene Furterer','PlayMonster',
  'GahsElec','Bio-Botanical Research','Biocidin','Righteous Roots','4Knines',
  'LubeLife','Genesis Holistic Health','Expert Hair','Selkirk Sport','Air Wick',
  'CRIMPIT','Velcro','Anua','Paint by numbers','Diamond painting',
  'Lost Boy Entertainment','Piles','Australian Gold','BASK & LATHER','SINCODA',
  'Beadnova','Divine','Sethe lord','Kiehl\'s','DiorSun','CGK Unlimited','Bloom',
  'Summer Fridays','Paula\'s Choice','Kerastase','Thrive Causemetics','Thrive',
  'MRYUESG','Redken','Spectrum','Curl Defining Brush','Curly Hair Brush',
  'PerioSciences','Saw Blade','ZZEM SCREW','DCNETWORK','BFIVEANTE','XIGRALUCK',
  'TSA Key','ZIYIZE','Suave','boveda','Gyro ball','JUNMEI','BuJinZeTui','pocrrmcb',
  'Elonbo','UMLIFE','Utopia','LifePro','Mercurydean','K9 Advantix','TALES',
  'Conservation Cards','Rechargeable','lunavia','Nature\'s Choice Supplements',
  'rabbitgoo','OtterBox','Sports Research','NNQEKBUF',
  'LE SALICULTEUR DE GUERANDE','Brokeir','JOYIN','Strider','EHBELIF','Lucky Egg',
  'Omie','Royal Designs','nbpure','CARVENSEY','AmorArtSky','HARIO','TOPDON',
  'Battery Daddy','Ontel','Rubbermaid','United Solutions Inc.','Otdwsd','ZZLTAWS',
  'AIPPK','YOQ','True Legend','COSLUS','VCHOMY','Scrub Daddy','NIASSO',
  'Arm & Hammer','Bubble Skincare','YRYM HT','Alex Tech','WinCraft','ComStar',
  'Solomon','Pure Encapsulations','Good Breath Labs','IKEA','BEATBIT','Franco',
  'MAFONE','POP MART','YONGJUNG','Lidguni','Hohoky','SVPSNUMSI','HexClad',
  'Veteran Tire and Rubber','Otstar','SupKing','PUSHPEEL','Genexa','FALAN MULE',
  // Also include all company names from the vero list (lines 2+)
  '3M','3M Company','3Skulls Paintball','665 Inc','Alessi','Amway','Arduino',
  'Arturia','Axon','Taser','Abercrombie & Fitch','ADT','American Eagle Outfitters',
  'Bose','Bridgestone','Brother International','Buck Knives','Burberry','Cartier',
  'Chanel','Coach','Crocs','Canon','Colnago','Dermalogica','Duracell','Dyson',
  'Ariat','Dansko','Defiant','DeLorean','Digium','Funko','Funko Pop','Gucci',
  'HexClad','Hilti','Honda','Hoover','Husqvarna','IKEA','John Deere','Kawasaki',
  'Kitchenaid','Leatherman','Lego','Louis Vuitton','Marc Jacobs','Miele',
  'Milwaukee Tool','Nikon','Nike','OtterBox','Pandora','Patagonia','Philips',
  'Remington','Samsung','Sennheiser','Shimano','Shiseido','Snap-on','Sony',
  'Swarovski','Swiss Army','Tiffany','Tommy Hilfiger','Victorinox','Volkswagen',
  'Velcro','Versace','Vitamix','Yamaha','Yeti','Zippo','Oakley','Ray-Ban','Rolex',
  'Tissot','Omega','Casio','Seiko','Tag Heuer','Montblanc','Hermes','Prada',
  'Versace','Dolce Gabbana','Armani','Calvin Klein','Ralph Lauren',
];

// ── Prohibited words: ingredients / components / restricted terms ─────────────
// Covers chemicals, regulated substances, weapon-adjacent, medical claims, etc.
const PROHIBITED_WORDS = [
  // Chemical / hazmat
  'chloroform','acetone','nitric acid','sulfuric acid','hydrochloric acid',
  'formaldehyde','benzene','toluene','cyanide','arsenic','mercury','lead',
  'asbestos','pcb','ddt','chlorine gas','phosgene','sarin','vx nerve',
  'mustard gas','hydrogen peroxide 35%','hydrogen peroxide 50%',
  'ammonium nitrate','potassium nitrate','sodium azide','sodium cyanide',
  'potassium cyanide','phosphine','sodium chlorate','potassium chlorate',
  'perchlorate','nitrocellulose','rdx','hmx','petn','thermite','flash powder',
  'black powder','smokeless powder','gun powder','gunpowder',
  // Pharma / controlled
  'ephedrine','pseudoephedrine','phenylpropanolamine','methylamine',
  'safrole','piperonal','isosafrole','ketamine','fentanyl','morphine',
  'oxycodone','oxycontin','hydrocodone','vicodin','codeine','tramadol',
  'alprazolam','xanax','diazepam','valium','clonazepam','rohypnol','ghb',
  'methamphetamine','mdma','ecstasy','lsd','psilocybin','dmt','cocaine',
  'heroin','opium','thc','cbd oil for sale','marijuana','cannabis',
  'anabolic steroid','testosterone injection','hgh','human growth hormone',
  'semaglutide','ozempic','wegovy','tirzepatide','mounjaro',
  // Weapon-adjacent
  'silencer','suppressor','auto sear','solvent trap kit','solvent trap',
  'bump stock','switch','glock switch','full auto','machine gun',
  'illegal conversion','undetectable firearm','ghost gun','80% lower',
  '80 percent lower','untraceable','zip gun',
  'stun gun','taser gun','shock device','cattle prod for humans',
  // Counterfeit / trademark abuse
  'replica','counterfeit','fake','unauthorized copy','bootleg',
  'knockoff','imitation brand','inspired by brand',
  // Medical claims (regulated)
  'cures cancer','treats cancer','cancer cure','cure diabetes',
  'covid cure','treats covid','prevents covid','antiviral claim',
  'fda approved claim','clinically proven','guaranteed weight loss',
  'permanent weight loss','erectile dysfunction cure',
  // Age-restricted
  'tobacco','cigarette','e-cigarette','vape','vaping liquid','nicotine',
  // Other restricted
  'spy camera','hidden camera','covert camera','pinhole camera',
  'signal jammer','signal blocker','gps jammer','wifi jammer',
  'radar detector','laser jammer','traffic light controller',
  'skeleton key','bump key','lock pick','lock picking set',
  'water utility key','sillcock key','master key system',
  'chloroquine','ivermectin human','bleach injection','miracle mineral',
  'colloidal silver cure','ozone therapy cure',
  // Dangerous items
  'thermite','pipe bomb','explosive','blasting cap','detonator',
  'napalm','incendiary','molotov','flamethrower fuel',
  // Animals / wildlife
  'ivory','rhino horn','shark fin','sea turtle','endangered species',
  'protected wildlife','exotic animal','live animal',
  // Regulated ingredients
  'epoxide','bromate','nitrosamine','dioxin','polychlorinated',
  'per- and polyfluoroalkyl','pfas','ptfe fumes',
];

/**
 * Check a product title against VERO and prohibited word lists.
 * Matching is case-insensitive and whole-word aware.
 *
 * @param {string} title
 * @returns {{ veroMatches: string[], prohibitedMatches: string[] }}
 */
export function checkTitle(title) {
  if (!title || typeof title !== 'string') {
    return { veroMatches: [], prohibitedMatches: [] };
  }

  const lower = title.toLowerCase();

  const veroMatches = VERO_WORDS.filter((word) => {
    const w = word.toLowerCase();
    // Use word-boundary-aware check: preceded/followed by non-alpha or start/end
    const idx = lower.indexOf(w);
    if (idx === -1) return false;
    const before = idx === 0 || !/[a-z0-9]/.test(lower[idx - 1]);
    const after = idx + w.length >= lower.length || !/[a-z0-9]/.test(lower[idx + w.length]);
    return before && after;
  });

  const prohibitedMatches = PROHIBITED_WORDS.filter((word) => {
    const w = word.toLowerCase();
    const idx = lower.indexOf(w);
    if (idx === -1) return false;
    const before = idx === 0 || !/[a-z0-9]/.test(lower[idx - 1]);
    const after = idx + w.length >= lower.length || !/[a-z0-9]/.test(lower[idx + w.length]);
    return before && after;
  });

  return {
    veroMatches: [...new Set(veroMatches)],
    prohibitedMatches: [...new Set(prohibitedMatches)],
  };
}

/**
 * Renders warning badge JSX-style data for use in components.
 * Returns null if no matches.
 */
export function getTitleWarnings(title) {
  const { veroMatches, prohibitedMatches } = checkTitle(title);
  if (!veroMatches.length && !prohibitedMatches.length) return null;
  return { veroMatches, prohibitedMatches };
}
