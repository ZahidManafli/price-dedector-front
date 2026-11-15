// Checkila Privacy Policy — single source for the public /privacy page and the
// mandatory in-app consent modal (components/PrivacyPolicyModal.jsx).
//
// IMPORTANT: bump PRIVACY_POLICY_VERSION whenever the text changes in a way users
// must re-accept. Every logged-in user whose stored version differs will see the
// consent modal again on their next visit.
export const PRIVACY_POLICY_VERSION = '2026-11-15';
export const PRIVACY_POLICY_EFFECTIVE = { en: 'November 15, 2026', az: '15 noyabr 2026' };

const CONTACT = {
  email: 'checkilanotify@gmail.com',
  phone: '+994 70 804 75 46',
  address: 'Ahmad Rajabli 225, Narimanov, Baku, AZ1075, Azerbaijan',
  addressAz: 'Əhməd Rəcəbli 225, Nərimanov, Bakı, AZ1075, Azərbaycan',
  taxId: '1807480082',
};

// Each section: { id, title, body: [ string | { list: string[] } | { sub: string, body: [...] } ] }
const en = [
  {
    id: 'intro',
    title: '1. Introduction and scope',
    body: [
      'This Privacy Policy explains how Checkila ("Checkila", "we", "us", "our") collects, uses, shares, stores and protects personal data when you use the checkila.com website, the Checkila web application, the Checkila mobile application, the Checkila Chrome extension, the Checkila Telegram bot and any related services (together, the "Services").',
      'By creating an account, logging in or otherwise using the Services you confirm that you have read and understood this Policy. Where we rely on your consent, we ask for it separately and you may withdraw it at any time.',
    ],
  },
  {
    id: 'controller',
    title: '2. Who we are',
    body: [
      `Checkila is operated from the Republic of Azerbaijan (taxpayer identification number / VÖEN ${CONTACT.taxId}; registered address: ${CONTACT.address}). For the personal data described in this Policy we act as the data controller, except where section 13 explains that we act on behalf of a seller.`,
      `You can contact us about any privacy matter at ${CONTACT.email} or ${CONTACT.phone}.`,
    ],
  },
  {
    id: 'collect',
    title: '3. Information we collect',
    body: [
      { sub: '3.1 Account and profile data', body: ['Name, surname, email address, phone number, date of birth, password (stored only as a one-way bcrypt hash — we never store or see your plain password), selected plan, language, theme and notification preferences.'] },
      { sub: '3.2 Marketplace and connected-account data', body: [
        'When you connect an eBay account we receive OAuth access and refresh tokens and, through the official eBay APIs, data such as your listings, orders, prices, stock levels, returns, cases, messages and feedback. Orders and messages contain personal data of your buyers (for example name, shipping address, username and message content).',
        'When you use Amazon-related features we process Amazon product information (ASIN, title, price, availability, images), and order, shipment and tracking numbers that you or the Chrome extension provide. Tracking numbers may be converted through our carrier partner (Aquiline) and uploaded to eBay on your instruction.',
      ] },
      { sub: '3.3 Payment data', body: [
        'Payments are processed by our licensed payment provider Epoint, including Google Pay and Apple Pay. Your full card number and CVV are entered on the provider\'s secure pages and are never stored on our servers. We store only what is needed to run your subscription: a masked card number (e.g. 4169 •••• 1234), the provider\'s card token, transaction identifiers, amounts, dates, plan details and receipts.',
      ] },
      { sub: '3.4 Usage, device and IP data', body: [
        'When you use the Services we automatically collect your IP address, an approximate location derived from it (country, region, city), browser and operating-system type, device type, login times, the features and pages you use, activity logs and technical error logs. See section 7 for how we handle IP addresses.',
      ] },
      { sub: '3.5 Chrome extension data', body: [
        'The extension works only on the sites listed in its permissions (eBay, Amazon, checkila.com and our tracking partner). It reads the pages needed for the features you start — for example eBay purchase-history pages, Amazon order and tracking pages — and sends the extracted results to your Checkila account. If you choose "Remember me", your login details are kept only in your own browser\'s extension storage so the extension can sign you in again. More detail is given on our Extension Privacy page.',
      ] },
      { sub: '3.6 Content you create', body: ['Products you track, notes, listing drafts, AI-generated titles and descriptions, design-studio images, uploaded files and settings you save.'] },
      { sub: '3.7 Communications', body: ['Messages you send to our support team, survey or review answers, and — if you connect the Telegram bot — your Telegram chat identifier and the notifications we send you.'] },
    ],
  },
  {
    id: 'use',
    title: '4. How we use your data and our legal bases',
    body: [
      { list: [
        'To provide the Services you request — price and stock tracking, profit calculation, listing, order and tracking management, market analysis, notifications (performance of a contract).',
        'To create and secure your account, verify your email, prevent fraud and abuse, and keep the Services available (performance of a contract and legitimate interests).',
        'To process payments, renewals and receipts and to keep accounting records (performance of a contract and legal obligation).',
        'To provide support and send service messages such as security alerts, plan expiry reminders and changes to these terms (performance of a contract).',
        'To improve and develop features, measure performance and fix errors (legitimate interests).',
        'To send marketing messages and to measure advertising on our public website, only where permitted by law and, where required, with your consent, which you can withdraw at any time.',
        'To comply with laws, respond to lawful requests from authorities and enforce our terms (legal obligation and legitimate interests).',
      ] },
      'We do not use automated decision-making that produces legal or similarly significant effects on you.',
    ],
  },
  {
    id: 'ai',
    title: '5. Artificial-intelligence features',
    body: [
      'Some features (for example AI listing titles and descriptions, item specifics, feedback and message replies, and image generation) send the minimum data needed for the task — such as product details, the buyer message you want to answer or the image prompt — to AI providers (OpenAI and Google Gemini) through their business APIs. Under those providers\' API terms this data is not used to train their public models. Please review AI output before publishing it; you remain responsible for content you publish.',
    ],
  },
  {
    id: 'cookies',
    title: '6. Cookies, local storage and similar technologies',
    body: [
      'The Checkila application stores a login token, your language and theme choices and similar preferences in your browser\'s local storage. These are strictly necessary for the Services to work.',
      'Our public marketing website uses the Meta Pixel to measure the effectiveness of our advertising. You can block these technologies through your browser settings, ad-blocking tools or the advertising settings of the relevant platform; blocking them does not affect the Checkila application.',
    ],
  },
  {
    id: 'ip',
    title: '7. IP address policy',
    body: [
      'Your IP address is personal data and we treat it as such. We collect it when you visit the website, sign in, call our APIs, make a payment or accept this Policy.',
      { list: [
        'Purposes: account security (detecting suspicious logins and sessions), fraud and abuse prevention, rate-limiting, troubleshooting, keeping evidence of your consent to this Policy, and estimating your country to show suitable language and currency.',
        'Approximate location: we derive only country, region and city from your IP address using an IP-geolocation service. We do not collect precise GPS location.',
        'Retention: security and activity logs containing IP addresses are kept for up to 12 months, unless a longer period is needed to investigate an incident or required by law. The IP address recorded with your Privacy Policy consent is kept for as long as your account exists, as proof of consent.',
        'Sharing: IP addresses are never sold. They may be visible to our hosting, security and payment providers as part of normal internet traffic, and may be disclosed to authorities only where required by law.',
      ] },
    ],
  },
  {
    id: 'sharing',
    title: '8. How we share data',
    body: [
      'We do not sell or rent your personal data. We share it only as described below:',
      { list: [
        'Service providers acting on our instructions: cloud hosting and database infrastructure, email delivery, payment processing (Epoint, Google Pay, Apple Pay), AI providers (OpenAI, Google), carrier/tracking partner (Aquiline), product-data and analytics providers, design tools, and messaging (Telegram).',
        'Marketplaces you connect: data you ask us to send to eBay (for example listings, prices, tracking numbers, messages and feedback replies) is sent through eBay\'s official APIs and is then governed by eBay\'s own privacy policy.',
        'Advertising measurement on the public website (Meta), as described in section 6.',
        'Authorities, courts or other parties when required by law, or to protect the rights, safety and property of Checkila, our users or others.',
        'A successor entity in a merger, acquisition or sale of assets, subject to this Policy.',
      ] },
      'Service providers may only use your data to provide services to us and must protect it with appropriate safeguards.',
    ],
  },
  {
    id: 'transfers',
    title: '9. International data transfers',
    body: [
      'Our servers and some of our providers are located outside the Republic of Azerbaijan (for example in the European Union and the United States). When data is transferred abroad we use providers that offer an adequate level of protection and contractual safeguards, in line with the Law of the Republic of Azerbaijan "On Personal Data" and, where applicable, the EU General Data Protection Regulation (GDPR).',
    ],
  },
  {
    id: 'retention',
    title: '10. How long we keep data',
    body: [
      { list: [
        'Account and service data: for as long as your account is active.',
        'After you delete your account: we delete or anonymise your data within 30 days, except data we must keep by law.',
        'Payment and accounting records: for the period required by tax and accounting legislation.',
        'Security and activity logs: up to 12 months (see section 7).',
        'Backups: overwritten on a rolling basis, normally within 30 days.',
      ] },
    ],
  },
  {
    id: 'security',
    title: '11. Security',
    body: [
      'We protect data with encrypted connections (HTTPS/TLS), hashed passwords, token-based authentication, access controls that limit staff access to what is necessary, and regular monitoring. Payment card data is handled by our payment provider and never touches our servers. No system is completely secure; if a breach affects your personal data, we will notify you and the competent authorities as required by law.',
      'Please keep your password and any API tokens confidential and never share them with anyone, including people who claim to represent Checkila.',
    ],
  },
  {
    id: 'rights',
    title: '12. Your rights',
    body: [
      'Subject to applicable law, you have the right to:',
      { list: [
        'access the personal data we hold about you and receive a copy;',
        'correct inaccurate or incomplete data;',
        'request deletion of your data;',
        'restrict or object to certain processing, including direct marketing;',
        'receive your data in a portable format;',
        'withdraw consent at any time, without affecting earlier processing;',
        'lodge a complaint with the competent personal-data supervisory authority.',
      ] },
      `To exercise these rights, email ${CONTACT.email} from the address linked to your account. We may need to verify your identity and will respond within 30 days.`,
    ],
  },
  {
    id: 'buyers',
    title: '13. Data of your buyers',
    body: [
      'When you use Checkila to manage your eBay store, the personal data of your buyers (such as names, addresses, messages and feedback) is processed on your behalf and according to your instructions. In this case you are the controller of that data and Checkila acts as a processor. You are responsible for having a lawful basis to process your buyers\' data and for complying with eBay\'s rules and applicable law. We use your buyers\' data only to provide the Services to you.',
    ],
  },
  {
    id: 'children',
    title: '14. Children',
    body: [
      'The Services are business tools intended for adults and are not directed at children. We do not knowingly collect personal data of anyone under 18. If you believe a child has provided us with personal data, please contact us and we will delete it.',
    ],
  },
  {
    id: 'ip-rights',
    title: '15. Intellectual property',
    body: [
      'The Checkila name, logo, software, website, designs, texts, templates and other materials of the Services are owned by Checkila or its licensors and are protected by intellectual-property laws. You may not copy, modify, distribute, reverse-engineer or create derivative works from them without our written permission.',
      'Content you upload or create (for example product data, images and listings) remains yours. You grant Checkila a limited, non-exclusive licence to store and process that content only as needed to provide the Services to you.',
      'eBay, Amazon, Google Pay, Apple Pay, Telegram and other third-party names and logos are trademarks of their respective owners. Checkila is an independent service and is not affiliated with, endorsed or sponsored by these companies.',
    ],
  },
  {
    id: 'marketing',
    title: '16. Marketing communications',
    body: [
      'You can stop receiving marketing messages at any time using the unsubscribe link in the email or by contacting us. We will still send service messages that are necessary for your account, such as security, payment and plan notifications.',
    ],
  },
  {
    id: 'changes',
    title: '17. Changes to this Policy',
    body: [
      'We may update this Policy from time to time. The date and version at the top show when it was last changed. If the changes are material, we will notify you in the application and ask you to read and accept the updated Policy before continuing to use the Services.',
    ],
  },
  {
    id: 'contact',
    title: '18. Contact us',
    body: [
      `Email: ${CONTACT.email}`,
      `Phone: ${CONTACT.phone}`,
      `Address: ${CONTACT.address}`,
      `VÖEN (Tax ID): ${CONTACT.taxId}`,
    ],
  },
];

const az = [
  {
    id: 'intro',
    title: '1. Giriş və əhatə dairəsi',
    body: [
      'Bu Məxfilik Siyasəti Checkila ("Checkila", "biz") tərəfindən checkila.com saytı, Checkila veb tətbiqi, Checkila mobil tətbiqi, Checkila Chrome uzantısı, Checkila Telegram botu və əlaqəli xidmətlərdən (birlikdə "Xidmətlər") istifadə zamanı şəxsi məlumatların necə toplandığını, istifadə edildiyini, paylaşıldığını, saxlandığını və qorunduğunu izah edir.',
      'Hesab yaratmaqla, daxil olmaqla və ya Xidmətlərdən başqa şəkildə istifadə etməklə bu Siyasəti oxuduğunuzu və başa düşdüyünüzü təsdiq edirsiniz. Razılığınıza əsaslandığımız hallarda onu ayrıca istəyirik və siz onu istənilən vaxt geri götürə bilərsiniz.',
    ],
  },
  {
    id: 'controller',
    title: '2. Biz kimik',
    body: [
      `Checkila Azərbaycan Respublikasından idarə olunur (VÖEN ${CONTACT.taxId}; ünvan: ${CONTACT.addressAz}). Bu Siyasətdə təsvir olunan şəxsi məlumatlar üzrə biz məlumatların nəzarətçisiyik; 13-cü bölmədə izah olunan hal (satıcının adından emal) istisnadır.`,
      `Məxfiliklə bağlı istənilən sual üçün bizimlə ${CONTACT.email} və ya ${CONTACT.phone} vasitəsilə əlaqə saxlaya bilərsiniz.`,
    ],
  },
  {
    id: 'collect',
    title: '3. Topladığımız məlumatlar',
    body: [
      { sub: '3.1 Hesab və profil məlumatları', body: ['Ad, soyad, e-poçt, telefon nömrəsi, doğum tarixi, şifrə (yalnız birtərəfli bcrypt hash kimi saxlanılır — açıq şifrənizi heç vaxt saxlamırıq və görmürük), seçilmiş plan, dil, mövzu və bildiriş seçimləri.'] },
      { sub: '3.2 Marketplace və qoşulmuş hesab məlumatları', body: [
        'eBay hesabınızı qoşduqda OAuth giriş və yeniləmə tokenləri, eləcə də rəsmi eBay API-ləri vasitəsilə elanlarınız, sifarişləriniz, qiymətlər, stok, qaytarmalar, case-lər, mesajlar və rəylər kimi məlumatlar alırıq. Sifariş və mesajlarda alıcılarınızın şəxsi məlumatları (məsələn ad, çatdırılma ünvanı, istifadəçi adı və mesaj mətni) olur.',
        'Amazon ilə bağlı funksiyalardan istifadə etdikdə Amazon məhsul məlumatlarını (ASIN, başlıq, qiymət, mövcudluq, şəkillər), sizin və ya Chrome uzantısının təqdim etdiyi sifariş, göndərmə və tracking nömrələrini emal edirik. Tracking nömrələri daşıyıcı tərəfdaşımız (Aquiline) vasitəsilə çevrilə və sizin göstərişinizlə eBay-ə yüklənə bilər.',
      ] },
      { sub: '3.3 Ödəniş məlumatları', body: [
        'Ödənişlər, Google Pay və Apple Pay daxil olmaqla, lisenziyalı ödəniş provayderimiz Epoint tərəfindən emal olunur. Kartın tam nömrəsi və CVV kodu provayderin təhlükəsiz səhifəsində daxil edilir və heç vaxt bizim serverlərdə saxlanmır. Biz yalnız abunəliyi idarə etmək üçün lazım olanları saxlayırıq: maskalanmış kart nömrəsi (məs. 4169 •••• 1234), provayderin kart tokeni, əməliyyat identifikatorları, məbləğlər, tarixlər, plan məlumatları və qəbzlər.',
      ] },
      { sub: '3.4 İstifadə, cihaz və IP məlumatları', body: [
        'Xidmətlərdən istifadə etdikdə IP ünvanınızı, ondan təxmini müəyyən edilən yeri (ölkə, region, şəhər), brauzer və əməliyyat sistemi növünü, cihaz növünü, giriş vaxtlarını, istifadə etdiyiniz funksiya və səhifələri, fəaliyyət jurnallarını və texniki xəta jurnallarını avtomatik toplayırıq. IP ünvanları ilə necə davrandığımız 7-ci bölmədə izah olunur.',
      ] },
      { sub: '3.5 Chrome uzantısı məlumatları', body: [
        'Uzantı yalnız icazələrində göstərilən saytlarda (eBay, Amazon, checkila.com və tracking tərəfdaşımız) işləyir. Sizin başlatdığınız funksiyalar üçün lazım olan səhifələri — məsələn eBay alış tarixçəsi, Amazon sifariş və tracking səhifələri — oxuyur və nəticələri Checkila hesabınıza göndərir. "Remember me" seçsəniz, giriş məlumatlarınız yalnız öz brauzerinizin uzantı yaddaşında saxlanılır ki, uzantı sizi yenidən daxil edə bilsin. Ətraflı məlumat Uzantı Məxfilik səhifəmizdədir.',
      ] },
      { sub: '3.6 Yaratdığınız məzmun', body: ['İzlədiyiniz məhsullar, qeydlər, elan qaralamaları, Sİ ilə yaradılmış başlıq və təsvirlər, dizayn studiyası şəkilləri, yüklədiyiniz fayllar və saxladığınız ayarlar.'] },
      { sub: '3.7 Ünsiyyət', body: ['Dəstək komandamıza göndərdiyiniz mesajlar, sorğu və rəy cavabları, Telegram botunu qoşsanız — Telegram chat identifikatorunuz və sizə göndərdiyimiz bildirişlər.'] },
    ],
  },
  {
    id: 'use',
    title: '4. Məlumatlardan necə istifadə edirik və hüquqi əsaslar',
    body: [
      { list: [
        'İstədiyiniz Xidmətləri göstərmək — qiymət və stok izləmə, mənfəət hesablanması, elan, sifariş və tracking idarəetməsi, bazar analizi, bildirişlər (müqavilənin icrası).',
        'Hesabınızı yaratmaq və qorumaq, e-poçtu təsdiqləmək, fırıldaqçılıq və sui-istifadənin qarşısını almaq, Xidmətlərin fasiləsiz işləməsini təmin etmək (müqavilənin icrası və qanuni maraq).',
        'Ödənişləri, yeniləmələri və qəbzləri emal etmək, mühasibat qeydlərini aparmaq (müqavilənin icrası və hüquqi öhdəlik).',
        'Dəstək göstərmək və təhlükəsizlik xəbərdarlıqları, planın bitməsi xatırlatmaları, şərtlərdəki dəyişikliklər kimi xidməti mesajlar göndərmək (müqavilənin icrası).',
        'Funksiyaları təkmilləşdirmək, performansı ölçmək və xətaları düzəltmək (qanuni maraq).',
        'Marketinq mesajları göndərmək və ictimai saytımızda reklamın effektivliyini ölçmək — yalnız qanunla icazə verildikdə və tələb olunduqda razılığınızla; razılığı istənilən vaxt geri götürə bilərsiniz.',
        'Qanunlara əməl etmək, dövlət orqanlarının qanuni sorğularına cavab vermək və şərtlərimizi tətbiq etmək (hüquqi öhdəlik və qanuni maraq).',
      ] },
      'Sizin üçün hüquqi və ya oxşar əhəmiyyətli nəticələr doğuran avtomatlaşdırılmış qərarlar qəbul etmirik.',
    ],
  },
  {
    id: 'ai',
    title: '5. Süni intellekt funksiyaları',
    body: [
      'Bəzi funksiyalar (məsələn Sİ ilə elan başlığı və təsviri, item specifics, rəy və mesaj cavabları, şəkil yaradılması) tapşırıq üçün minimum lazım olan məlumatı — məhsul məlumatları, cavablandırmaq istədiyiniz alıcı mesajı və ya şəkil təsviri — biznes API-ləri vasitəsilə Sİ provayderlərinə (OpenAI və Google Gemini) göndərir. Bu provayderlərin API şərtlərinə əsasən həmin məlumatlar onların ümumi modellərinin öyrədilməsində istifadə edilmir. Sİ nəticəsini dərc etməzdən əvvəl yoxlayın; dərc etdiyiniz məzmuna görə məsuliyyət sizin üzərinizdədir.',
    ],
  },
  {
    id: 'cookies',
    title: '6. Cookie-lər, lokal yaddaş və oxşar texnologiyalar',
    body: [
      'Checkila tətbiqi giriş tokenini, dil və mövzu seçimlərinizi və oxşar ayarları brauzerinizin lokal yaddaşında (local storage) saxlayır. Bunlar Xidmətlərin işləməsi üçün mütləq zəruridir.',
      'İctimai marketinq saytımız reklamlarımızın effektivliyini ölçmək üçün Meta Pixel-dən istifadə edir. Bu texnologiyaları brauzer ayarları, reklam bloklayıcıları və ya müvafiq platformanın reklam ayarları ilə bloklaya bilərsiniz; bu, Checkila tətbiqinin işinə təsir etmir.',
    ],
  },
  {
    id: 'ip',
    title: '7. IP ünvanı siyasəti',
    body: [
      'IP ünvanınız şəxsi məlumatdır və biz ona belə yanaşırıq. Onu saytı ziyarət etdikdə, daxil olduqda, API-lərimizə müraciət etdikdə, ödəniş etdikdə və bu Siyasəti qəbul etdikdə toplayırıq.',
      { list: [
        'Məqsədlər: hesab təhlükəsizliyi (şübhəli giriş və sessiyaların aşkarlanması), fırıldaqçılıq və sui-istifadənin qarşısının alınması, sorğu limitləri, problemlərin aradan qaldırılması, bu Siyasətə verdiyiniz razılığın sübutunun saxlanması və uyğun dil və valyutanı göstərmək üçün ölkənizin təxmini müəyyən edilməsi.',
        'Təxmini yer: IP ünvanından IP-geolokasiya xidməti vasitəsilə yalnız ölkə, region və şəhər müəyyən edilir. Dəqiq GPS yerinizi toplamırıq.',
        'Saxlama müddəti: IP ünvanı olan təhlükəsizlik və fəaliyyət jurnalları 12 aya qədər saxlanılır, insidentin araşdırılması üçün daha uzun müddət lazım olduqda və ya qanun tələb etdikdə istisna olmaqla. Məxfilik Siyasətinə razılığınızla birlikdə qeyd olunan IP ünvanı razılığın sübutu kimi hesabınız mövcud olduğu müddətdə saxlanılır.',
        'Paylaşım: IP ünvanları heç vaxt satılmır. Adi internet trafikinin bir hissəsi kimi hostinq, təhlükəsizlik və ödəniş provayderlərimizə görünə bilər və yalnız qanun tələb etdikdə dövlət orqanlarına açıqlana bilər.',
      ] },
    ],
  },
  {
    id: 'sharing',
    title: '8. Məlumatları necə paylaşırıq',
    body: [
      'Şəxsi məlumatlarınızı satmır və icarəyə vermirik. Yalnız aşağıdakı hallarda paylaşırıq:',
      { list: [
        'Göstərişlərimizlə işləyən xidmət provayderləri: bulud hostinqi və verilənlər bazası infrastrukturu, e-poçt göndərişi, ödəniş emalı (Epoint, Google Pay, Apple Pay), Sİ provayderləri (OpenAI, Google), daşıyıcı/tracking tərəfdaşı (Aquiline), məhsul məlumatı və analitika provayderləri, dizayn alətləri və mesajlaşma (Telegram).',
        'Qoşduğunuz marketplace-lər: eBay-ə göndərməyimizi istədiyiniz məlumatlar (elanlar, qiymətlər, tracking nömrələri, mesaj və rəy cavabları) eBay-in rəsmi API-ləri ilə göndərilir və bundan sonra eBay-in öz məxfilik siyasəti ilə tənzimlənir.',
        'İctimai saytda reklamın ölçülməsi (Meta) — 6-cı bölmədə təsvir olunduğu kimi.',
        'Qanun tələb etdikdə və ya Checkila-nın, istifadəçilərimizin və başqalarının hüquq, təhlükəsizlik və əmlakını qorumaq üçün dövlət orqanları, məhkəmələr və digər tərəflər.',
        'Birləşmə, satınalma və ya aktivlərin satışı zamanı hüquqi varis — bu Siyasətə uyğun olaraq.',
      ] },
      'Xidmət provayderləri məlumatlarınızdan yalnız bizə xidmət göstərmək üçün istifadə edə bilər və onları müvafiq tədbirlərlə qorumalıdırlar.',
    ],
  },
  {
    id: 'transfers',
    title: '9. Məlumatların xaricə ötürülməsi',
    body: [
      'Serverlərimiz və bəzi provayderlərimiz Azərbaycan Respublikasından kənarda (məsələn Avropa İttifaqı və ABŞ) yerləşir. Məlumatlar xaricə ötürüldükdə "Fərdi məlumatlar haqqında" Azərbaycan Respublikasının Qanununa və tətbiq olunduğu hallarda Aİ-nin Ümumi Məlumatların Mühafizəsi Reqlamentinə (GDPR) uyğun olaraq adekvat qoruma səviyyəsi və müqavilə təminatları verən provayderlərdən istifadə edirik.',
    ],
  },
  {
    id: 'retention',
    title: '10. Məlumatları nə qədər saxlayırıq',
    body: [
      { list: [
        'Hesab və xidmət məlumatları: hesabınız aktiv olduğu müddətdə.',
        'Hesabı sildikdən sonra: qanunla saxlamalı olduğumuz məlumatlar istisna olmaqla, 30 gün ərzində silinir və ya anonimləşdirilir.',
        'Ödəniş və mühasibat qeydləri: vergi və mühasibat qanunvericiliyinin tələb etdiyi müddət ərzində.',
        'Təhlükəsizlik və fəaliyyət jurnalları: 12 aya qədər (7-ci bölməyə baxın).',
        'Ehtiyat nüsxələr: növbəli şəkildə yenilənir, adətən 30 gün ərzində.',
      ] },
    ],
  },
  {
    id: 'security',
    title: '11. Təhlükəsizlik',
    body: [
      'Məlumatları şifrələnmiş bağlantılar (HTTPS/TLS), hash-lənmiş şifrələr, token əsaslı autentifikasiya, əməkdaşların girişini zəruri olanla məhdudlaşdıran giriş nəzarəti və müntəzəm monitorinq ilə qoruyuruq. Ödəniş kartı məlumatları ödəniş provayderimiz tərəfindən emal olunur və serverlərimizə heç vaxt düşmür. Heç bir sistem tam təhlükəsiz deyil; şəxsi məlumatlarınıza təsir edən pozuntu baş verərsə, qanunun tələb etdiyi qaydada sizi və səlahiyyətli orqanları xəbərdar edəcəyik.',
      'Şifrənizi və istənilən API tokenlərini məxfi saxlayın və heç kimlə, o cümlədən özünü Checkila nümayəndəsi kimi təqdim edən şəxslərlə paylaşmayın.',
    ],
  },
  {
    id: 'rights',
    title: '12. Hüquqlarınız',
    body: [
      'Tətbiq olunan qanunvericiliyə uyğun olaraq aşağıdakı hüquqlarınız var:',
      { list: [
        'haqqınızda saxladığımız şəxsi məlumatlarla tanış olmaq və onların surətini almaq;',
        'yanlış və ya natamam məlumatları düzəltmək;',
        'məlumatlarınızın silinməsini tələb etmək;',
        'birbaşa marketinq daxil olmaqla müəyyən emala məhdudiyyət qoymaq və ya etiraz etmək;',
        'məlumatlarınızı ötürülə bilən formatda almaq;',
        'razılığı istənilən vaxt geri götürmək (bu, əvvəlki emalın qanuniliyinə təsir etmir);',
        'fərdi məlumatlar üzrə səlahiyyətli nəzarət orqanına şikayət etmək.',
      ] },
      `Bu hüquqlardan istifadə etmək üçün hesabınıza bağlı e-poçtdan ${CONTACT.email} ünvanına yazın. Şəxsiyyətinizi təsdiqləməyimiz lazım ola bilər; 30 gün ərzində cavab veririk.`,
    ],
  },
  {
    id: 'buyers',
    title: '13. Alıcılarınızın məlumatları',
    body: [
      'eBay mağazanızı Checkila ilə idarə etdikdə alıcılarınızın şəxsi məlumatları (ad, ünvan, mesajlar, rəylər və s.) sizin adınızdan və göstərişlərinizə uyğun emal olunur. Bu halda həmin məlumatların nəzarətçisi sizsiniz, Checkila isə emalçı kimi çıxış edir. Alıcılarınızın məlumatlarını emal etmək üçün qanuni əsasa malik olmağa, eBay qaydalarına və tətbiq olunan qanunlara əməl etməyə siz cavabdehsiniz. Alıcılarınızın məlumatlarından yalnız sizə Xidmət göstərmək üçün istifadə edirik.',
    ],
  },
  {
    id: 'children',
    title: '14. Uşaqlar',
    body: [
      'Xidmətlər böyüklər üçün nəzərdə tutulmuş biznes alətləridir və uşaqlara yönəlməyib. 18 yaşından kiçik şəxslərin şəxsi məlumatlarını bilərəkdən toplamırıq. Uşağın bizə şəxsi məlumat verdiyini düşünürsünüzsə, bizimlə əlaqə saxlayın — həmin məlumatları siləcəyik.',
    ],
  },
  {
    id: 'ip-rights',
    title: '15. Əqli mülkiyyət',
    body: [
      'Checkila adı, loqosu, proqram təminatı, saytı, dizaynları, mətnləri, şablonları və Xidmətlərin digər materialları Checkila-ya və ya onun lisenziarlarına məxsusdur və əqli mülkiyyət qanunları ilə qorunur. Yazılı icazəmiz olmadan onları kopyalamaq, dəyişdirmək, yaymaq, tərs mühəndislik etmək və ya onlardan törəmə əsərlər yaratmaq olmaz.',
      'Yüklədiyiniz və ya yaratdığınız məzmun (məsələn məhsul məlumatları, şəkillər və elanlar) sizə məxsus qalır. Siz Checkila-ya həmin məzmunu yalnız sizə Xidmət göstərmək üçün lazım olan həddə saxlamaq və emal etmək üçün məhdud, qeyri-eksklüziv lisenziya verirsiniz.',
      'eBay, Amazon, Google Pay, Apple Pay, Telegram və digər üçüncü tərəf adları və loqoları müvafiq sahiblərinin əmtəə nişanlarıdır. Checkila müstəqil xidmətdir və bu şirkətlərlə əlaqəli deyil, onlar tərəfindən təsdiqlənmir və ya sponsorluq edilmir.',
    ],
  },
  {
    id: 'marketing',
    title: '16. Marketinq mesajları',
    body: [
      'Marketinq mesajlarını e-poçtdakı abunəlikdən çıxma linki ilə və ya bizimlə əlaqə saxlayaraq istənilən vaxt dayandıra bilərsiniz. Hesabınız üçün zəruri olan xidməti mesajları — təhlükəsizlik, ödəniş və plan bildirişləri — göndərməyə davam edəcəyik.',
    ],
  },
  {
    id: 'changes',
    title: '17. Siyasətdəki dəyişikliklər',
    body: [
      'Bu Siyasəti vaxtaşırı yeniləyə bilərik. Yuxarıdakı tarix və versiya son dəyişikliyi göstərir. Dəyişikliklər əhəmiyyətlidirsə, sizi tətbiqdə xəbərdar edəcəyik və Xidmətlərdən istifadəyə davam etməzdən əvvəl yenilənmiş Siyasəti oxuyub qəbul etməyinizi xahiş edəcəyik.',
    ],
  },
  {
    id: 'contact',
    title: '18. Əlaqə',
    body: [
      `E-poçt: ${CONTACT.email}`,
      `Telefon: ${CONTACT.phone}`,
      `Ünvan: ${CONTACT.addressAz}`,
      `VÖEN: ${CONTACT.taxId}`,
    ],
  },
];

const UI = {
  en: { title: 'Privacy Policy', effective: 'Effective date', version: 'Version' },
  az: { title: 'Məxfilik Siyasəti', effective: 'Qüvvəyə minmə tarixi', version: 'Versiya' },
};

// az has its own text; every other language (en, ru, tr) uses English.
export function getPrivacyPolicy(lang) {
  const key = String(lang || '').toLowerCase().startsWith('az') ? 'az' : 'en';
  return {
    lang: key,
    sections: key === 'az' ? az : en,
    ui: UI[key],
    effective: PRIVACY_POLICY_EFFECTIVE[key],
    version: PRIVACY_POLICY_VERSION,
  };
}
