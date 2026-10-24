// Scheme Matcher — Production-Ready Client Logic
// Zero external libraries — Vanilla JavaScript ES6+

const API_URL = '';
let currentAdminToken = localStorage.getItem('admin_token') || null;
let currentStudentToken = localStorage.getItem('student_token') || null;
let currentUser = null;
let currentUserProfile = null;
let bookmarkedSchemeIds = [];
let domainsCache = [];
let statesCache = [];
let globalConfig = { googleClientId: '', hasGoogleAuth: false };

// ---------------------------------------------------------------------------
// DEVICE ID FOR ANONYMOUS SESSIONS
// ---------------------------------------------------------------------------
function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'DEV-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}
const DEVICE_ID = getDeviceId();

// Helper: API Request Headers
function getHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': DEVICE_ID,
    ...extraHeaders,
  };
  const token = currentStudentToken || currentAdminToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Helper: Escape HTML to protect against XSS
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ---------------------------------------------------------------------------
// INITIALIZATION ON DOM READY
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// INTERNATIONALIZATION (i18n) — English, Hindi, Marathi, Bengali, Telugu, Tamil, Gujarati
// ---------------------------------------------------------------------------
const I18N = {
  en: {
    navFind: 'Find Schemes', navBrowse: 'Browse All', navBookmarks: 'Bookmarks',
    formTitle: 'Find Schemes You Qualify For',
    formSubtitle: 'Fill out your eligibility details below. Our deterministic matching engine calculates score percentages and reasons.',
    lblState: 'State / UT', lblCategory: 'Social Category', lblGender: 'Gender',
    lblAge: 'Age (Years)', lblIncome: 'Annual Household Income (₹)',
    lblDisability: 'Specially-Abled (Disability 40%+)?',
    lblOccupation: 'Occupation', lblEducation: 'Highest Education Level',
    lblDomain: 'Domain of Interest (Optional)', btnSearch: 'Search Matching Schemes',
    gateHeading: 'Welcome! Please sign in to continue',
    gateSubtitle: "Discover government schemes and scholarships you're eligible for — free, personalised, and in seconds.",
    gateGoogle: 'Sign in with Google', gateDivider: 'OR CONTINUE WITH EMAIL',
    gateEmail: 'Email Address', gateName: 'Full Name',
    gateContinue: 'Continue to Scheme Matcher →',
    gateGuest: 'Continue as Guest (Explore Portal) →',
    gateFooter: '🔒 Your data is stored only on this device. No spam, no tracking.',
  },
  hi: {
    navFind: 'योजनाएँ खोजें', navBrowse: 'सभी देखें', navBookmarks: 'सहेजे गए',
    formTitle: 'वे योजनाएँ खोजें जिनके लिए आप पात्र हैं',
    formSubtitle: 'नीचे अपनी पात्रता विवरण भरें। हमारा मैचिंग इंजन स्कोर प्रतिशत और कारण बताता है।',
    lblState: 'राज्य / केंद्र शासित प्रदेश', lblCategory: 'सामाजिक वर्ग', lblGender: 'लिंग',
    lblAge: 'आयु (वर्ष)', lblIncome: 'वार्षिक पारिवारिक आय (₹)',
    lblDisability: 'दिव्यांग (40%+ विकलांगता)?',
    lblOccupation: 'व्यवसाय', lblEducation: 'उच्चतम शिक्षा स्तर',
    lblDomain: 'रुचि का क्षेत्र (वैकल्पिक)', btnSearch: 'मिलती-जुलती योजनाएँ खोजें',
    gateHeading: 'स्वागत है! जारी रखने के लिए साइन इन करें',
    gateSubtitle: 'सरकारी योजनाओं और छात्रवृत्तियों की खोज करें जिनके लिए आप पात्र हैं — मुफ़्त और सेकंडों में।',
    gateGoogle: 'Google से साइन इन करें', gateDivider: 'या ईमेल से जारी रखें',
    gateEmail: 'ईमेल पता', gateName: 'पूरा नाम',
    gateContinue: 'स्कीम मैचर पर जारी रखें →',
    gateGuest: 'अतिथि के रूप में जारी रखें →',
    gateFooter: '🔒 आपका डेटा केवल इस डिवाइस पर संग्रहीत है।',
  },
  mr: {
    navFind: 'योजना शोधा', navBrowse: 'सर्व पहा', navBookmarks: 'जतन केलेले',
    formTitle: 'तुम्ही पात्र असलेल्या योजना शोधा',
    formSubtitle: 'खाली तुमची पात्रता तपशील भरा. आमचे मॅचिंग इंजिन स्कोअर टक्केवारी आणि कारणे सांगते.',
    lblState: 'राज्य / केंद्रशासित प्रदेश', lblCategory: 'सामाजिक प्रवर्ग', lblGender: 'लिंग',
    lblAge: 'वय (वर्षे)', lblIncome: 'वार्षिक कौटुंबिक उत्पन्न (₹)',
    lblDisability: 'दिव्यांग (४०%+ अपंगत्व)?',
    lblOccupation: 'व्यवसाय', lblEducation: 'सर्वोच्च शिक्षण स्तर',
    lblDomain: 'आवडीचे क्षेत्र (ऐच्छिक)', btnSearch: 'जुळणाऱ्या योजना शोधा',
    gateHeading: 'स्वागत आहे! सुरू ठेवण्यासाठी साइन इन करा',
    gateSubtitle: 'तुम्ही पात्र असलेल्या सरकारी योजना आणि शिष्यवृत्ती शोधा — मोफत आणि सेकंदात.',
    gateGoogle: 'Google सह साइन इन करा', gateDivider: 'किंवा ईमेलसह सुरू ठेवा',
    gateEmail: 'ईमेल पत्ता', gateName: 'पूर्ण नाव',
    gateContinue: 'Scheme Matcher वर सुरू ठेवा →',
    gateGuest: 'अतिथी म्हणून सुरू ठेवा →',
    gateFooter: '🔒 तुमचा डेटा फक्त या डिव्हाइसवर साठवला आहे.',
  },
  bn: {
    navFind: 'প্রকল্প খুঁজুন', navBrowse: 'সব দেখুন', navBookmarks: 'সংরক্ষিত',
    formTitle: 'আপনি যেসব প্রকল্পের জন্য যোগ্য সেগুলি খুঁজুন',
    formSubtitle: 'নিচে আপনার যোগ্যতার বিবরণ দিন। আমাদের ম্যাচিং ইঞ্জিন স্কোর ও কারণ দেখায়।',
    lblState: 'রাজ্য / কেন্দ্রশাসিত অঞ্চল', lblCategory: 'সামাজিক শ্রেণি', lblGender: 'লিঙ্গ',
    lblAge: 'বয়স (বছর)', lblIncome: 'বার্ষিক পারিবারিক আয় (₹)',
    lblDisability: 'প্রতিবন্ধী (৪০%+)?',
    lblOccupation: 'পেশা', lblEducation: 'সর্বোচ্চ শিক্ষার স্তর',
    lblDomain: 'আগ্রহের ক্ষেত্র (ঐচ্ছিক)', btnSearch: 'মিলে যাওয়া প্রকল্প খুঁজুন',
    gateHeading: 'স্বাগতম! চালিয়ে যেতে সাইন ইন করুন',
    gateSubtitle: 'আপনি যেসব সরকারি প্রকল্প ও বৃত্তির জন্য যোগ্য তা আবিষ্কার করুন — বিনামূল্যে।',
    gateGoogle: 'Google দিয়ে সাইন ইন করুন', gateDivider: 'অথবা ইমেইল দিয়ে চালিয়ে যান',
    gateEmail: 'ইমেইল ঠিকানা', gateName: 'পূর্ণ নাম',
    gateContinue: 'Scheme Matcher এ চালিয়ে যান →', gateGuest: 'অতিথি হিসেবে চালিয়ে যান →',
    gateFooter: '🔒 আপনার ডেটা শুধুমাত্র এই ডিভাইসে সংরক্ষিত।',
  },
  te: {
    navFind: 'పథకాలను కనుగొనండి', navBrowse: 'అన్నీ చూడండి', navBookmarks: 'సేవ్ చేసినవి',
    formTitle: 'మీకు అర్హత ఉన్న పథకాలను కనుగొనండి',
    formSubtitle: 'క్రింద మీ అర్హత వివరాలను నింపండి. మా మ్యాచింగ్ ఇంజిన్ స్కోర్ శాతం మరియు కారణాలను చూపుతుంది.',
    lblState: 'రాష్ట్రం / కేంద్ర పాలిత ప్రాంతం', lblCategory: 'సామాజిక వర్గం', lblGender: 'లింగం',
    lblAge: 'వయస్సు (సంవత్సరాలు)', lblIncome: 'వార్షిక కుటుంబ ఆదాయం (₹)',
    lblDisability: 'వికలాంగత (40%+)?',
    lblOccupation: 'వృత్తి', lblEducation: 'అత్యున్నత విద్యా స్థాయి',
    lblDomain: 'ఆసక్తి రంగం (ఐచ్ఛికం)', btnSearch: 'సరిపోలే పథకాలను కనుగొనండి',
    gateHeading: 'స్వాగతం! కొనసాగడానికి సైన్ ఇన్ చేయండి',
    gateSubtitle: 'మీకు అర్హత ఉన్న ప్రభుత్వ పథకాలు మరియు స్కాలర్‌షిప్‌లను కనుగొనండి — ఉచితం.',
    gateGoogle: 'Googleతో సైన్ ఇన్ చేయండి', gateDivider: 'లేదా ఇమెయిల్‌తో కొనసాగండి',
    gateEmail: 'ఇమెయిల్ చిరునామా', gateName: 'పూర్తి పేరు',
    gateContinue: 'Scheme Matcherకి కొనసాగండి →', gateGuest: 'అతిథిగా కొనసాగండి →',
    gateFooter: '🔒 మీ డేటా ఈ డివైస్‌లో మాత్రమే నిల్వ చేయబడుతుంది.',
  },
  ta: {
    navFind: 'திட்டங்களைக் கண்டறியவும்', navBrowse: 'அனைத்தையும் பார்க்க', navBookmarks: 'சேமித்தவை',
    formTitle: 'நீங்கள் தகுதிபெறும் திட்டங்களைக் கண்டறியவும்',
    formSubtitle: 'உங்கள் தகுதி விவரங்களை கீழே நிரப்பவும். எங்கள் மேட்சிங் இன்ஜின் மதிப்பெண் சதவீதத்தைக் காட்டும்.',
    lblState: 'மாநிலம் / யூனியன் பிரதேசம்', lblCategory: 'சமூகப் பிரிவு', lblGender: 'பாலினம்',
    lblAge: 'வயது (ஆண்டுகள்)', lblIncome: 'ஆண்டு குடும்ப வருமானம் (₹)',
    lblDisability: 'மாற்றுத்திறனாளி (40%+)?',
    lblOccupation: 'தொழில்', lblEducation: 'உயர்ந்த கல்வி நிலை',
    lblDomain: 'ஆர்வத் துறை (விருப்பம்)', btnSearch: 'பொருந்தும் திட்டங்களைத் தேடு',
    gateHeading: 'வரவேற்கிறோம்! தொடர உள்நுழையவும்',
    gateSubtitle: 'தகுதியான அரசாங்க திட்டங்கள் மற்றும் உதவித்தொகைகளை கண்டறியவும் — இலவசம்.',
    gateGoogle: 'Google மூலம் உள்நுழையவும்', gateDivider: 'அல்லது மின்னஞ்சல் மூலம் தொடரவும்',
    gateEmail: 'மின்னஞ்சல் முகவரி', gateName: 'முழு பெயர்',
    gateContinue: 'Scheme Matcher தொடரவும் →', gateGuest: 'விருந்தினராக தொடரவும் →',
    gateFooter: '🔒 உங்கள் தரவு இந்த சாதனத்தில் மட்டுமே சேமிக்கப்படுகிறது.',
  },
  gu: {
    navFind: 'યોજનાઓ શોધો', navBrowse: 'બધું જુઓ', navBookmarks: 'સાચવેલા',
    formTitle: 'તમે પાત્ર છો તે યોજનાઓ શોધો',
    formSubtitle: 'નીચે તમારી પાત્રતાની વિગતો ભરો. અમારું મેચિંગ એન્જિન સ્કોર ટકાવારી અને કારણો બતાવે છે.',
    lblState: 'રાજ્ય / કેન્દ્રશાસિત પ્રદેશ', lblCategory: 'સામાજિક વર્ગ', lblGender: 'લિંગ',
    lblAge: 'ઉંમર (વર્ષ)', lblIncome: 'વાર્ષિક કૌટુંબિક આવક (₹)',
    lblDisability: 'દિવ્યાંગ (40%+)?',
    lblOccupation: 'વ્યવસાય', lblEducation: 'સર્વોચ્ચ શિક્ષણ સ્તર',
    lblDomain: 'રુચિનું ક્ષેત્ર (વૈકલ્પિક)', btnSearch: 'મેળ ખાતી યોજનાઓ શોધો',
    gateHeading: 'સ્વાગત છે! આગળ વધવા માટે સાઇન ઇન કરો',
    gateSubtitle: 'તમે પાત્ર છો તેવી સરકારી યોજનાઓ અને શિષ્યવૃત્તિ શોધો — મફત.',
    gateGoogle: 'Google સાથે સાઇન ઇન કરો', gateDivider: 'અથવા ઇમેઇલ સાથે ચાલુ રાખો',
    gateEmail: 'ઇમેઇલ સરનામું', gateName: 'પૂરું નામ',
    gateContinue: 'Scheme Matcher પર ચાલુ રાખો →', gateGuest: 'અતિથિ તરીકે ચાલુ રાખો →',
    gateFooter: '🔒 તમારો ડેટા ફક્ત આ ડિવાઇસ પર સંગ્રહિત છે.',
  },
};

// Extended UI strings (header, services, browse, bookmarks, footer, assistant)
const I18N_EXTRA = {
  en: {
    siteSubtitle: 'Government Scheme & Scholarship Matcher for India',
    navServices: '⚡ Services', navAdmin: 'Admin Portal',
    statsActive: '🟢 Live Active Schemes', statsDomains: '📂 Welfare Domains', statsReviewed: '🗓️ Last Reviewed',
    authSignIn: '👤 Student Sign In', authSignOut: 'Sign Out',
    svcQuickAccess: 'Quick Access', svcTagline: 'Your tools, all in one place',
    svcMatcher: 'Scholarship Matcher', svcTracker: 'Application Tracker', svcVault: 'Document Vault',
    svcNotifications: 'Notifications', svcProfile: 'My Profile', svcFeedback: 'Give Feedback',
    svcDonate: '❤️ Support & Donate', svcVolunteer: '🤝 Volunteer With Us',
    resultsTitle: 'Your Matches',
    resultsEmpty: 'Fill out the questionnaire and click search to view matching government schemes.',
    exportPrint: '📄 Export / Print',
    browseSearch: 'Search schemes by name, keyword, or ministry...',
    allDomains: 'All Domains', allLevels: 'All Levels', centralGovt: 'Central Govt', stateGovt: 'State Govt',
    sortDefault: 'Sort: Default', sortName: 'Name (A → Z)', sortDeadline: 'Deadline (Urgent First)', sortIncome: 'Lowest Income Limit',
    bookmarksTitle: 'Your Saved Schemes',
    bookmarksSubtitle: 'Bookmarked schemes are saved to your account or device.',
    bookmarksEmpty: "You haven't bookmarked any schemes yet.",
    footerCopyright: '© 2026 Government Scheme Matcher. All Rights Reserved.',
    footerDisclaimer: '⚠️ Disclaimer: Information provided here is compiled for public awareness and discovery. Always verify specific criteria and submission procedures on the official government portals before applying.',
    aiSubtitle: 'Voice & Scheme Guidance',
    aiChipTour: '🧭 Guided Tour', aiChipFind: '🎓 Find Scholarships', aiChipDocs: '📄 NSP Documents',
    aiChipServices: '⚡ Open Services', aiChipVault: '🔒 Document Vault',
    listening: 'Listening...',
  },
  hi: {
    siteSubtitle: 'भारत के लिए सरकारी योजना और छात्रवृत्ति मैचर',
    navServices: '⚡ सेवाएँ', navAdmin: 'एडमिन पोर्टल',
    statsActive: '🟢 सक्रिय योजनाएँ', statsDomains: '📂 कल्याण क्षेत्र', statsReviewed: '🗓️ अंतिम समीक्षा',
    authSignIn: '👤 छात्र साइन इन', authSignOut: 'साइन आउट',
    svcQuickAccess: 'त्वरित पहुँच', svcTagline: 'आपके सभी टूल एक जगह',
    svcMatcher: 'छात्रवृत्ति मैचर', svcTracker: 'आवेदन ट्रैकर', svcVault: 'दस्तावेज़ वॉल्ट',
    svcNotifications: 'सूचनाएँ', svcProfile: 'मेरी प्रोफ़ाइल', svcFeedback: 'प्रतिक्रिया दें',
    svcDonate: '❤️ सहायता और दान', svcVolunteer: '🤝 हमारे साथ स्वयंसेवा करें',
    resultsTitle: 'आपके मिलान',
    resultsEmpty: 'प्रश्नावली भरें और मिलती-जुलती सरकारी योजनाएँ देखने के लिए खोज पर क्लिक करें।',
    exportPrint: '📄 निर्यात / प्रिंट',
    browseSearch: 'नाम, कीवर्ड या मंत्रालय से योजनाएँ खोजें...',
    allDomains: 'सभी क्षेत्र', allLevels: 'सभी स्तर', centralGovt: 'केंद्र सरकार', stateGovt: 'राज्य सरकार',
    sortDefault: 'क्रम: डिफ़ॉल्ट', sortName: 'नाम (A → Z)', sortDeadline: 'समय सीमा (जल्दी पहले)', sortIncome: 'सबसे कम आय सीमा',
    bookmarksTitle: 'आपकी सहेजी गई योजनाएँ',
    bookmarksSubtitle: 'सहेजी गई योजनाएँ आपके खाते या डिवाइस में सुरक्षित हैं।',
    bookmarksEmpty: 'आपने अभी तक कोई योजना सहेजी नहीं है।',
    footerCopyright: '© 2026 सरकारी योजना मैचर। सर्वाधिकार सुरक्षित।',
    footerDisclaimer: '⚠️ अस्वीकरण: यहाँ दी गई जानकारी जन जागरूकता के लिए संकलित है। आवेदन करने से पहले आधिकारिक सरकारी पोर्टल पर विवरण सत्यापित करें।',
    aiSubtitle: 'आवाज़ और योजना मार्गदर्शन',
    aiChipTour: '🧭 गाइडेड टूर', aiChipFind: '🎓 छात्रवृत्ति खोजें', aiChipDocs: '📄 NSP दस्तावेज़',
    aiChipServices: '⚡ सेवाएँ खोलें', aiChipVault: '🔒 दस्तावेज़ वॉल्ट',
    listening: 'सुन रहा है...',
  },
  mr: {
    siteSubtitle: 'भारतासाठी सरकारी योजना आणि शिष्यवृत्ती मॅचर',
    navServices: '⚡ सेवा', navAdmin: 'अ‍ॅडमिन पोर्टल',
    statsActive: '🟢 सक्रिय योजना', statsDomains: '📂 कल्याण क्षेत्रे', statsReviewed: '🗓️ शेवटचे पुनरावलोकन',
    authSignIn: '👤 विद्यार्थी साइन इन', authSignOut: 'साइन आउट',
    svcQuickAccess: 'जलद प्रवेश', svcTagline: 'तुमची सर्व साधने एकाच ठिकाणी',
    svcMatcher: 'शिष्यवृत्ती मॅचर', svcTracker: 'अर्ज ट्रॅकर', svcVault: 'दस्तऐवज व्हॉल्ट',
    svcNotifications: 'सूचना', svcProfile: 'माझी प्रोफाइल', svcFeedback: 'अभिप्राय द्या',
    svcDonate: '❤️ मदत आणि देणगी', svcVolunteer: '🤝 आमच्यासोबत स्वयंसेवा करा',
    resultsTitle: 'तुमची जुळणी',
    resultsEmpty: 'प्रश्नावली भरा आणि जुळणाऱ्या सरकारी योजना पाहण्यासाठी शोधावर क्लिक करा.',
    exportPrint: '📄 निर्यात / प्रिंट',
    browseSearch: 'नाव, कीवर्ड किंवा मंत्रालयाने योजना शोधा...',
    allDomains: 'सर्व क्षेत्रे', allLevels: 'सर्व स्तर', centralGovt: 'केंद्र सरकार', stateGovt: 'राज्य सरकार',
    sortDefault: 'क्रम: डीफॉल्ट', sortName: 'नाव (A → Z)', sortDeadline: 'अंतिम तारीख (तातडीचे आधी)', sortIncome: 'सर्वात कमी उत्पन्न मर्यादा',
    bookmarksTitle: 'तुमच्या जतन केलेल्या योजना',
    bookmarksSubtitle: 'जतन केलेल्या योजना तुमच्या खाते किंवा डिव्हाइसवर साठवल्या जातात.',
    bookmarksEmpty: 'तुम्ही अजून कोणतीही योजना जतन केलेली नाही.',
    footerCopyright: '© 2026 सरकारी योजना मॅचर. सर्व हक्क राखीव.',
    footerDisclaimer: '⚠️ सूचना: येथे दिलेली माहिती जनजागृतीसाठी संकलित केली आहे. अर्ज करण्यापूर्वी अधिकृत सरकारी पोर्टलवर तपशील तपासा.',
    aiSubtitle: 'आवाज आणि योजना मार्गदर्शन',
    aiChipTour: '🧭 मार्गदर्शित फेरफटका', aiChipFind: '🎓 शिष्यवृत्ती शोधा', aiChipDocs: '📄 NSP दस्तऐवज',
    aiChipServices: '⚡ सेवा उघडा', aiChipVault: '🔒 दस्तऐवज व्हॉल्ट',
    listening: 'ऐकत आहे...',
  },
  bn: {
    siteSubtitle: 'ভারতের জন্য সরকারি প্রকল্প ও বৃত্তি ম্যাচার',
    navServices: '⚡ সেবা', navAdmin: 'অ্যাডমিন পোর্টাল',
    statsActive: '🟢 সক্রিয় প্রকল্প', statsDomains: '📂 কল্যাণ ক্ষেত্র', statsReviewed: '🗓️ সর্বশেষ পর্যালোচনা',
    authSignIn: '👤 শিক্ষার্থী সাইন ইন', authSignOut: 'সাইন আউট',
    svcQuickAccess: 'দ্রুত প্রবেশ', svcTagline: 'আপনার সব টুল এক জায়গায়',
    svcMatcher: 'বৃত্তি ম্যাচার', svcTracker: 'আবেদন ট্র্যাকার', svcVault: 'নথি ভান্ডার',
    svcNotifications: 'বিজ্ঞপ্তি', svcProfile: 'আমার প্রোফাইল', svcFeedback: 'মতামত দিন',
    svcDonate: '❤️ সহায়তা ও দান', svcVolunteer: '🤝 আমাদের সাথে স্বেচ্ছাসেবা করুন',
    resultsTitle: 'আপনার মিল',
    resultsEmpty: 'প্রশ্নাবলী পূরণ করুন এবং মিলে যাওয়া সরকারি প্রকল্প দেখতে অনুসন্ধানে ক্লিক করুন।',
    exportPrint: '📄 রপ্তানি / প্রিন্ট',
    browseSearch: 'নাম, কীওয়ার্ড বা মন্ত্রণালয় দিয়ে প্রকল্প খুঁজুন...',
    allDomains: 'সব ক্ষেত্র', allLevels: 'সব স্তর', centralGovt: 'কেন্দ্রীয় সরকার', stateGovt: 'রাজ্য সরকার',
    sortDefault: 'ক্রম: ডিফল্ট', sortName: 'নাম (A → Z)', sortDeadline: 'সময়সীমা (জরুরি আগে)', sortIncome: 'সর্বনিম্ন আয়সীমা',
    bookmarksTitle: 'আপনার সংরক্ষিত প্রকল্প',
    bookmarksSubtitle: 'সংরক্ষিত প্রকল্প আপনার অ্যাকাউন্ট বা ডিভাইসে রাখা হয়।',
    bookmarksEmpty: 'আপনি এখনও কোনো প্রকল্প সংরক্ষণ করেননি।',
    footerCopyright: '© 2026 সরকারি প্রকল্প ম্যাচার। সর্বস্বত্ব সংরক্ষিত।',
    footerDisclaimer: '⚠️ দাবিত্যাগ: এখানে দেওয়া তথ্য জনসচেতনতার জন্য সংকলিত। আবেদনের আগে অফিসিয়াল সরকারি পোর্টালে যাচাই করুন।',
    aiSubtitle: 'ভয়েস ও প্রকল্প নির্দেশনা',
    aiChipTour: '🧭 গাইডেড ট্যুর', aiChipFind: '🎓 বৃত্তি খুঁজুন', aiChipDocs: '📄 NSP নথি',
    aiChipServices: '⚡ সেবা খুলুন', aiChipVault: '🔒 নথি ভান্ডার',
    listening: 'শুনছে...',
  },
  te: {
    siteSubtitle: 'భారతదేశానికి ప్రభుత్వ పథకం & స్కాలర్‌షిప్ మ్యాచర్',
    navServices: '⚡ సేవలు', navAdmin: 'అడ్మిన్ పోర్టల్',
    statsActive: '🟢 క్రియాశీల పథకాలు', statsDomains: '📂 సంక్షేమ రంగాలు', statsReviewed: '🗓️ చివరి సమీక్ష',
    authSignIn: '👤 విద్యార్థి సైన్ ఇన్', authSignOut: 'సైన్ అవుట్',
    svcQuickAccess: 'త్వరిత ప్రవేశం', svcTagline: 'మీ అన్ని సాధనాలు ఒకే చోట',
    svcMatcher: 'స్కాలర్‌షిప్ మ్యాచర్', svcTracker: 'దరఖాస్తు ట్రాకర్', svcVault: 'పత్రాల వాల్ట్',
    svcNotifications: 'నోటిఫికేషన్లు', svcProfile: 'నా ప్రొఫైల్', svcFeedback: 'అభిప్రాయం ఇవ్వండి',
    svcDonate: '❤️ మద్దతు & విరాళం', svcVolunteer: '🤝 మాతో స్వచ్ఛంద సేవ చేయండి',
    resultsTitle: 'మీ మ్యాచ్‌లు',
    resultsEmpty: 'ప్రశ్నావళిని నింపి, సరిపోలే ప్రభుత్వ పథకాలను చూడటానికి వెతుకు నొక్కండి.',
    exportPrint: '📄 ఎగుమతి / ప్రింట్',
    browseSearch: 'పేరు, కీవర్డ్ లేదా మంత్రిత్వ శాఖ ద్వారా పథకాలను వెతకండి...',
    allDomains: 'అన్ని రంగాలు', allLevels: 'అన్ని స్థాయిలు', centralGovt: 'కేంద్ర ప్రభుత్వం', stateGovt: 'రాష్ట్ర ప్రభుత్వం',
    sortDefault: 'క్రమం: డిఫాల్ట్', sortName: 'పేరు (A → Z)', sortDeadline: 'గడువు (అత్యవసరమైనవి ముందు)', sortIncome: 'అత్యల్ప ఆదాయ పరిమితి',
    bookmarksTitle: 'మీ సేవ్ చేసిన పథకాలు',
    bookmarksSubtitle: 'సేవ్ చేసిన పథకాలు మీ ఖాతా లేదా పరికరంలో ఉంచబడతాయి.',
    bookmarksEmpty: 'మీరు ఇంకా ఏ పథకాన్ని సేవ్ చేయలేదు.',
    footerCopyright: '© 2026 ప్రభుత్వ పథకం మ్యాచర్. సర్వ హక్కులు రక్షితం.',
    footerDisclaimer: '⚠️ నిరాకరణ: ఇక్కడ ఇచ్చిన సమాచారం ప్రజల అవగాహన కోసం సేకరించబడింది. దరఖాస్తు చేయడానికి ముందు అధికారిక ప్రభుత్వ పోర్టల్‌లో ధృవీకరించండి.',
    aiSubtitle: 'వాయిస్ & పథక మార్గదర్శనం',
    aiChipTour: '🧭 గైడెడ్ టూర్', aiChipFind: '🎓 స్కాలర్‌షిప్‌లు వెతకండి', aiChipDocs: '📄 NSP పత్రాలు',
    aiChipServices: '⚡ సేవలు తెరవండి', aiChipVault: '🔒 పత్రాల వాల్ట్',
    listening: 'వింటోంది...',
  },
  ta: {
    siteSubtitle: 'இந்தியாவிற்கான அரசு திட்டம் & உதவித்தொகை மேட்சர்',
    navServices: '⚡ சேவைகள்', navAdmin: 'நிர்வாக போர்ட்டல்',
    statsActive: '🟢 செயலில் உள்ள திட்டங்கள்', statsDomains: '📂 நலத்துறைகள்', statsReviewed: '🗓️ கடைசி மதிப்பாய்வு',
    authSignIn: '👤 மாணவர் உள்நுழைவு', authSignOut: 'வெளியேறு',
    svcQuickAccess: 'விரைவு அணுகல்', svcTagline: 'உங்கள் அனைத்து கருவிகளும் ஒரே இடத்தில்',
    svcMatcher: 'உதவித்தொகை மேட்சர்', svcTracker: 'விண்ணப்ப டிராக்கர்', svcVault: 'ஆவண காப்பகம்',
    svcNotifications: 'அறிவிப்புகள்', svcProfile: 'என் சுயவிவரம்', svcFeedback: 'கருத்து தெரிவிக்கவும்',
    svcDonate: '❤️ ஆதரவு & நன்கொடை', svcVolunteer: '🤝 எங்களுடன் தன்னார்வலராக இணையுங்கள்',
    resultsTitle: 'உங்கள் பொருத்தங்கள்',
    resultsEmpty: 'கேள்வித்தாளை நிரப்பி, பொருந்தும் அரசு திட்டங்களைக் காண தேடலை அழுத்தவும்.',
    exportPrint: '📄 ஏற்றுமதி / அச்சிடு',
    browseSearch: 'பெயர், முக்கிய சொல் அல்லது அமைச்சகம் மூலம் திட்டங்களைத் தேடுங்கள்...',
    allDomains: 'அனைத்து துறைகள்', allLevels: 'அனைத்து நிலைகள்', centralGovt: 'மத்திய அரசு', stateGovt: 'மாநில அரசு',
    sortDefault: 'வரிசை: இயல்பு', sortName: 'பெயர் (A → Z)', sortDeadline: 'காலக்கெடு (அவசரமானவை முதலில்)', sortIncome: 'குறைந்த வருமான வரம்பு',
    bookmarksTitle: 'நீங்கள் சேமித்த திட்டங்கள்',
    bookmarksSubtitle: 'சேமித்த திட்டங்கள் உங்கள் கணக்கு அல்லது சாதனத்தில் வைக்கப்படும்.',
    bookmarksEmpty: 'நீங்கள் இன்னும் எந்த திட்டத்தையும் சேமிக்கவில்லை.',
    footerCopyright: '© 2026 அரசு திட்ட மேட்சர். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.',
    footerDisclaimer: '⚠️ பொறுப்புத் துறப்பு: இங்கு வழங்கப்பட்ட தகவல் பொது விழிப்புணர்வுக்காக தொகுக்கப்பட்டது. விண்ணப்பிக்கும் முன் அதிகாரப்பூர்வ அரசு போர்ட்டலில் சரிபார்க்கவும்.',
    aiSubtitle: 'குரல் & திட்ட வழிகாட்டல்',
    aiChipTour: '🧭 வழிகாட்டப்பட்ட சுற்றுலா', aiChipFind: '🎓 உதவித்தொகைகளைத் தேடு', aiChipDocs: '📄 NSP ஆவணங்கள்',
    aiChipServices: '⚡ சேவைகளைத் திற', aiChipVault: '🔒 ஆவண காப்பகம்',
    listening: 'கேட்கிறது...',
  },
  en: { navInternational: '✈️ International', intlBadge: '🌍 GLOBAL OPPORTUNITIES FOR INDIAN STUDENTS', intlTitle: 'Study Abroad & International Scholarships', intlSubtitle: 'Discover fully-funded and prestigious overseas fellowships, government scholarships, bilateral exchange programs, and study-abroad grants.', intlSearch: 'Search international scholarships by country, degree, or funding...', intlAll: 'All Destinations' },
  hi: { navInternational: '✈️ अंतर्राष्ट्रीय', intlBadge: '🌍 भारतीय छात्रों के लिए वैश्विक अवसर', intlTitle: 'विदेश में अध्ययन और अंतर्राष्ट्रीय छात्रवृत्तियाँ', intlSubtitle: 'पूर्ण वित्त पोषित और प्रतिष्ठित फेलोशिप, सरकारी छात्रवृत्तियाँ और अध्ययन-अबरोड अनुदान खोजें।', intlSearch: 'देश, डिग्री या फंडिंग से खोजें...', intlAll: 'सभी गंतव्य' },
  mr: { navInternational: '✈️ आंतरराष्ट्रीय', intlBadge: '🌍 भारतीय विद्यार्थ्यांसाठी जागतिक संधी', intlTitle: 'परदेशात शिक्षण आणि आंतरराष्ट्रीय शिष्यवृत्ती', intlSubtitle: 'पूर्ण अनुदानित आणि प्रतिष्ठित फेलोशिप शोधा.', intlSearch: 'देश, पदवी किंवा निधीद्वारे शोधा...', intlAll: 'सर्व ठिकाणे' },
  bn: { navInternational: '✈️ আন্তর্জাতিক', intlBadge: '🌍 ভারতীয় শিক্ষার্থীদের জন্য বৈশ্বিক সুযোগ', intlTitle: 'বিদেশে পড়াশোনা ও আন্তর্জাতিক বৃত্তি', intlSubtitle: 'পূর্ণ অর্থায়িত ফেলোশিপ এবং বৃত্তি আবিষ্কার করুন।', intlSearch: 'দেশ, ডিগ্রি বা তহবিল দ্বারা অনুসন্ধান...', intlAll: 'সকল গন্তব্য' },
  te: { navInternational: '✈️ అంతర్జాతీయ', intlBadge: '🌍 భారతీయ విద్యార్థులకు ప్రపంచ అవకాశాలు', intlTitle: 'విదేశాల్లో చదువు & అంతర్జాతీయ స్కాలర్‌షిప్‌లు', intlSubtitle: 'పూర్తిగా నిధులు పొందే ఫెలోషిప్‌లు మరియు స్కాలర్‌షిప్‌లను కనుగొనండి.', intlSearch: 'దేశం, డిగ్రీ లేదా నిధుల ద్వారా శోధించండి...', intlAll: 'అన్ని గమ్యస్థానాలు' },
  ta: { navInternational: '✈️ சர்வதேச', intlBadge: '🌍 இந்திய மாணவர்களுக்கான உலகளாவிய வாய்ப்புகள்', intlTitle: 'வெளிநாட்டு படிப்பு & சர்வதேச உதவித்தொகைகள்', intlSubtitle: 'முழு நிதியுதவியுடன் கூடிய உதவித்தொகைகளைக் கண்டறியவும்.', intlSearch: 'நாடு, பட்டம் அல்லது நிதி மூலம் தேடுங்கள்...', intlAll: 'அனைத்து இடங்கள்' },
  gu: { navInternational: '✈️ આંતરરાષ્ટ્રીય', intlBadge: '🌍 ભારતીય વિદ્યાર્થીઓ માટે વૈશ્વિક તકો', intlTitle: 'પરદેશમાં અભ્યાસ & આંતરરાષ્ટ્રીય શિષ્યવૃત્તિઓ', intlSubtitle: 'પૂર્ણ ભંડોળ સાથેની શિષ્યવૃત્તિઓ શોધો.', intlSearch: 'દેશ, ડિગ્રી અથવા ભંડોળ દ્વારા શોધો...', intlAll: 'બધા ગંતવ્ય' },
  gu: {
    siteSubtitle: 'ભારત માટે સરકારી યોજના અને શિષ્યવૃત્તિ મેચર',
    navServices: '⚡ સેવાઓ', navAdmin: 'એડમિન પોર્ટલ',
    statsActive: '🟢 સક્રિય યોજનાઓ', statsDomains: '📂 કલ્યાણ ક્ષેત્રો', statsReviewed: '🗓️ છેલ્લી સમીક્ષા',
    authSignIn: '👤 વિદ્યાર્થી સાઇન ઇન', authSignOut: 'સાઇન આઉટ',
    svcQuickAccess: 'ઝડપી પ્રવેશ', svcTagline: 'તમારા બધા સાધનો એક જ જગ્યાએ',
    svcMatcher: 'શિષ્યવૃત્તિ મેચર', svcTracker: 'અરજી ટ્રેકર', svcVault: 'દસ્તાવેજ વોલ્ટ',
    svcNotifications: 'સૂચનાઓ', svcProfile: 'મારી પ્રોફાઇલ', svcFeedback: 'પ્રતિસાદ આપો',
    svcDonate: '❤️ સહાય અને દાન', svcVolunteer: '🤝 અમારી સાથે સ્વયંસેવા કરો',
    resultsTitle: 'તમારા મેળ',
    resultsEmpty: 'પ્રશ્નાવલી ભરો અને મેળ ખાતી સરકારી યોજનાઓ જોવા શોધ પર ક્લિક કરો.',
    exportPrint: '📄 નિકાસ / પ્રિન્ટ',
    browseSearch: 'નામ, કીવર્ડ અથવા મંત્રાલય દ્વારા યોજનાઓ શોધો...',
    allDomains: 'બધા ક્ષેત્રો', allLevels: 'બધા સ્તરો', centralGovt: 'કેન્દ્ર સરકાર', stateGovt: 'રાજ્ય સરકાર',
    sortDefault: 'ક્રમ: ડિફોલ્ટ', sortName: 'નામ (A → Z)', sortDeadline: 'સમયમર્યાદા (તાત્કાલિક પહેલા)', sortIncome: 'સૌથી નીચી આવક મર્યાદા',
    bookmarksTitle: 'તમારી સાચવેલી યોજનાઓ',
    bookmarksSubtitle: 'સાચવેલી યોજનાઓ તમારા ખાતા અથવા ઉપકરણમાં રાખવામાં આવે છે.',
    bookmarksEmpty: 'તમે હજી કોઈ યોજના સાચવી નથી.',
    footerCopyright: '© 2026 સરકારી યોજના મેચર. સર્વ હક્ક સ્વાધીન.',
    footerDisclaimer: '⚠️ અસ્વીકરણ: અહીં આપેલી માહિતી જનજાગૃતિ માટે સંકલિત છે. અરજી કરતા પહેલા સત્તાવાર સરકારી પોર્ટલ પર ચકાસો.',
    aiSubtitle: 'અવાજ અને યોજના માર્ગદર્શન',
    aiChipTour: '🧭 માર્ગદર્શિત પ્રવાસ', aiChipFind: '🎓 શિષ્યવૃત્તિઓ શોધો', aiChipDocs: '📄 NSP દસ્તાવેજો',
    aiChipServices: '⚡ સેવાઓ ખોલો', aiChipVault: '🔒 દસ્તાવેજ વોલ્ટ',
    listening: 'સાંભળી રહ્યું છે...',
  },
};
Object.entries(I18N_EXTRA).forEach(([lang, dict]) => Object.assign(I18N[lang], dict));

// Map short code (select value) <-> BCP-47 locale (speech APIs)
const LANG_LOCALE = {
  en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN',
  te: 'te-IN', ta: 'ta-IN', gu: 'gu-IN',
};

function getLang() {
  return localStorage.getItem('app_lang') || 'en';
}

function t(key) {
  const dict = I18N[getLang()] || I18N.en;
  return dict[key] ?? I18N.en[key] ?? key;
}

function applyLanguage(lang) {
  localStorage.setItem('app_lang', lang);
  document.documentElement.lang = lang;

  // Translate every tagged element
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const txt = t(el.getAttribute('data-i18n'));
    if (txt) el.textContent = txt;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const txt = t(el.getAttribute('data-i18n-placeholder'));
    if (txt) el.setAttribute('placeholder', txt);
  });

  // Keep all language selects in sync
  ['gate-language-select', 'topbar-language-select'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = lang;
  });
  const aiSel = document.getElementById('ai-language-select');
  if (aiSel) aiSel.value = LANG_LOCALE[lang] || 'en-IN';
}

function initLanguageSelector() {
  const gateSel = document.getElementById('gate-language-select');
  const topSel = document.getElementById('topbar-language-select');
  const aiSel = document.getElementById('ai-language-select');

  const onChange = (lang) => applyLanguage(lang);

  if (gateSel) gateSel.addEventListener('change', (e) => onChange(e.target.value));
  if (topSel) topSel.addEventListener('change', (e) => onChange(e.target.value));
  if (aiSel) {
    aiSel.addEventListener('change', (e) => {
      // Reverse-map locale -> short code so the whole UI follows the AI dropdown too
      const short = Object.keys(LANG_LOCALE).find((k) => LANG_LOCALE[k] === e.target.value) || 'en';
      onChange(short);
    });
  }

  applyLanguage(getLang());
}

document.addEventListener('DOMContentLoaded', () => {
  initLanguageSelector();
  initTabs();
  initServicesDropdown();
  loadConfig();
  loadReferenceData();
  loadStats();
  initBookmarks();
  initAuth();

  // Questionnaire form submit
  document.getElementById('matcher-form').addEventListener('submit', handleMatchSubmit);

  // Auto-fill from profile and reset buttons
  document.getElementById('btn-autofill-profile').addEventListener('click', autoFillFromProfile);
  document.getElementById('btn-reset-match').addEventListener('click', resetMatcherForm);
  document.getElementById('btn-export-results').addEventListener('click', exportMatchesReport);

  // Browse tab search/filter/sort inputs
  document.getElementById('search-q').addEventListener('input', debounce(handleBrowseFilter, 250));
  document.getElementById('filter-domain').addEventListener('change', handleBrowseFilter);
  document.getElementById('filter-level').addEventListener('change', handleBrowseFilter);
  document.getElementById('browse-sort').addEventListener('change', handleBrowseFilter);

  // Admin login and sub-tabs
  document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);
  document.getElementById('btn-logout').addEventListener('click', handleAdminLogout);
  initAdminSubnav();

  // Scheme and Bulk Import forms (Admin)
  document.getElementById('btn-add-scheme').addEventListener('click', () => openSchemeModal());
  document.getElementById('btn-bulk-import').addEventListener('click', () => toggleModal('bulk-modal', true));
  document.getElementById('scheme-form').addEventListener('submit', handleSchemeFormSubmit);
  document.getElementById('bulk-import-form').addEventListener('submit', handleBulkImportSubmit);

  // Secondary Features Modals & Forms
  document.getElementById('btn-login-modal').addEventListener('click', () => toggleModal('auth-modal', true));
  document.getElementById('dev-login-form').addEventListener('submit', handleDevLoginSubmit);
  document.getElementById('btn-user-logout').addEventListener('click', handleStudentLogout);
  document.getElementById('btn-open-profile-pill').addEventListener('click', openProfileModal);
  document.getElementById('profile-form').addEventListener('submit', handleProfileFormSubmit);

  document.getElementById('btn-notif-bell').addEventListener('click', openNotificationsModal);
  document.getElementById('btn-mark-all-read').addEventListener('click', markAllNotificationsRead);

  document.getElementById('quick-app-form').addEventListener('submit', handleQuickAppSubmit);
  document.getElementById('vault-upload-form').addEventListener('submit', handleVaultUploadSubmit);
  document.getElementById('donation-form').addEventListener('submit', handleDonationSubmit);
  document.getElementById('volunteer-form').addEventListener('submit', handleVolunteerSubmit);
  document.getElementById('feedback-form').addEventListener('submit', handleFeedbackSubmit);

  // Modal close handlers
  const closeMappings = [
    ['modal-close', 'scheme-modal'],
    ['bulk-modal-close', 'bulk-modal'],
    ['auth-modal-close', 'auth-modal'],
    ['profile-modal-close', 'profile-modal'],
    ['tracker-modal-close', 'tracker-modal'],
    ['quick-app-close', 'quick-app-modal'],
    ['vault-modal-close', 'vault-modal'],
    ['notif-modal-close', 'notif-modal'],
    ['donation-modal-close', 'donation-modal'],
    ['volunteer-modal-close', 'volunteer-modal'],
    ['feedback-modal-close', 'feedback-modal'],
  ];
  closeMappings.forEach(([btnId, modalId]) => {
    const el = document.getElementById(btnId);
    if (el) el.addEventListener('click', () => toggleModal(modalId, false));
  });

  // Check admin state
  updateAdminView();

  // Login gate
  initLoginGate();

  // AI Chat & Voice Assistant
  initAIAssistant();
});

// ---------------------------------------------------------------------------
// NAVIGATION & TABS
// ---------------------------------------------------------------------------
function initTabs() {
  const buttons = document.querySelectorAll('.nav-btn:not(.services-btn)');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTabId = btn.getAttribute('data-tab');
      const tabs = document.querySelectorAll('.tab-content');
      tabs.forEach(t => t.classList.remove('active'));

      const targetTab = document.getElementById(targetTabId);
      if (targetTab) targetTab.classList.add('active');

      if (targetTabId === 'browse-tab') {
        loadAllSchemes();
      } else if (targetTabId === 'bookmarks-tab') {
        loadBookmarksTab();
      } else if (targetTabId === 'admin-tab' && currentAdminToken) {
        loadAdminDashboard();
      }
    });
  });
}

function switchToTab(tabId) {
  const targetBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (targetBtn) {
    targetBtn.click();
  } else {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
  }
}

// ---------------------------------------------------------------------------
// SERVICES POP-OUT MENU
// ---------------------------------------------------------------------------
function initServicesDropdown() {
  const trigger = document.getElementById('btn-services-menu');
  const menu = document.getElementById('services-menu');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !isHidden);
    trigger.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('svc-match')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    switchToTab('match-tab');
  });
  document.getElementById('svc-vault')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    openVaultModal();
  });
  document.getElementById('svc-tracker')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    openTrackerModal();
  });
  document.getElementById('svc-alerts')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    openNotificationsModal();
  });
  document.getElementById('svc-profile')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    openProfileModal();
  });
  document.getElementById('svc-donation')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    toggleModal('donation-modal', true);
  });
  document.getElementById('svc-volunteer')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    toggleModal('volunteer-modal', true);
  });
  document.getElementById('svc-feedback')?.addEventListener('click', () => {
    menu.classList.add('hidden');
    toggleModal('feedback-modal', true);
  });
}

// ---------------------------------------------------------------------------
// CONFIG & REFERENCE DATA
// ---------------------------------------------------------------------------
async function loadConfig() {
  try {
    const res = await fetch(`${API_URL}/api/config`);
    globalConfig = await res.json();
    initGoogleSignIn();
    initLoginGate(); // re-init gate now that config is loaded (renders Google button)
  } catch (err) {
    console.error('Failed to load server config:', err);
  }
}

function initGoogleSignIn() {
  const note = document.getElementById('google-config-note');
  const slot = document.getElementById('google-btn-slot');
  const modalGoogleBtn = document.getElementById('modal-google-fake-btn');

  if (modalGoogleBtn) {
    modalGoogleBtn.addEventListener('click', () => handleFakeGoogleLogin('modal'));
  }

  if (globalConfig.googleClientId && window.google && window.google.accounts) {
    if (note) note.classList.add('hidden');
    try {
      window.google.accounts.id.initialize({
        client_id: globalConfig.googleClientId,
        callback: handleGoogleCredentialResponse,
      });
      if (slot) {
        window.google.accounts.id.renderButton(slot, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          width: '320',
        });
      }
    } catch (e) {
      console.warn('Google Identity initialization notice:', e);
    }
  } else {
    if (note) note.classList.add('hidden');
  }
}

async function handleGoogleCredentialResponse(response) {
  try {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ credential: response.credential }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');

    currentStudentToken = data.token;
    localStorage.setItem('student_token', currentStudentToken);
    toggleModal('auth-modal', false);
    dismissLoginGate();
    await checkCurrentUser();
    await initBookmarks();
  } catch (err) {
    alert('Google Login: ' + err.message);
  }
}

async function loadReferenceData() {
  try {
    const [domainsRes, statesRes] = await Promise.all([
      fetch(`${API_URL}/api/domains`),
      fetch(`${API_URL}/api/states`),
    ]);
    domainsCache = await domainsRes.json();
    statesCache = await statesRes.json();

    populateDropdown('state', statesCache, true);
    populateDropdown('prof-state', statesCache, true);
    populateDropdown('domain', domainsCache, false, 'id', 'en');
    populateDropdown('prof-domain', domainsCache, false, 'id', 'en');
    populateDropdown('filter-domain', domainsCache, false, 'id', 'en');
    populateDropdown('f-domain', domainsCache, false, 'id', 'en');
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }
}

function populateDropdown(selectId, items, isStringArray, valueKey = '', labelKey = '') {
  const select = document.getElementById(selectId);
  if (!select) return;

  const firstOption = select.options[0];
  select.innerHTML = '';
  if (firstOption && !isStringArray) {
    select.appendChild(firstOption);
  }

  items.forEach(item => {
    const option = document.createElement('option');
    if (isStringArray) {
      option.value = item;
      option.textContent = item;
    } else {
      option.value = item[valueKey];
      option.textContent = item[labelKey];
    }
    select.appendChild(option);
  });
}

async function loadStats() {
  try {
    const res = await fetch(`${API_URL}/api/stats`);
    const data = await res.json();
    document.getElementById('stat-active-count').textContent = data.totalSchemes;
    document.getElementById('stat-domain-count').textContent = data.domains;
    document.getElementById('stat-last-reviewed').textContent = data.lastReviewed;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ---------------------------------------------------------------------------
// LOGIN GATE
// ---------------------------------------------------------------------------
function initLoginGate() {
  const gate = document.getElementById('login-gate');
  if (!gate) return;

  // Wire gate login form
  const gateForm = document.getElementById('gate-login-form');
  if (gateForm) {
    gateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('gate-email').value.trim();
      const name = document.getElementById('gate-name').value.trim();
      const errEl = document.getElementById('gate-login-error');
      const btn = document.getElementById('gate-login-btn');

      btn.disabled = true;
      btn.textContent = 'Signing in...';
      errEl.classList.add('hidden');

      try {
        const res = await fetch(`${API_URL}/api/auth/dev-login`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ email, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        currentStudentToken = data.token;
        localStorage.setItem('student_token', currentStudentToken);
        dismissLoginGate();
        await checkCurrentUser();
        await initBookmarks();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Continue to Scheme Matcher →';
      }
    });
  }

  // Setup Google Sign-In inside gate
  const gateGoogleBtn = document.getElementById('gate-google-fake-btn');
  if (gateGoogleBtn) {
    gateGoogleBtn.addEventListener('click', () => handleFakeGoogleLogin('gate'));
  }

  // Continue as Guest button
  const gateSkipBtn = document.getElementById('gate-skip-btn');
  if (gateSkipBtn) {
    gateSkipBtn.addEventListener('click', () => {
      dismissLoginGate();
      showToast('Exploring as guest! You can search schemes and chat with SchemeMitra AI.', 'info');
    });
  }

  const slot = document.getElementById('gate-google-btn-slot');
  const note = document.getElementById('gate-google-note');
  if (note) note.classList.add('hidden');

  if (globalConfig.googleClientId && window.google && window.google.accounts) {
    try {
      window.google.accounts.id.renderButton(slot, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: '376',
      });
    } catch(e) { /* already initialised */ }
  }
}

async function handleFakeGoogleLogin(source = 'gate') {
  if (globalConfig.googleClientId && window.google && window.google.accounts) {
    try {
      window.google.accounts.id.prompt();
      return;
    } catch(e) { /* fallback to instant demo sign-in */ }
  }

  // Realistic instant Google sign-in demo
  let email = '';
  let name = '';

  if (source === 'gate') {
    const emailEl = document.getElementById('gate-email');
    const nameEl = document.getElementById('gate-name');
    email = (emailEl && emailEl.value.trim()) || 'student.google@gmail.com';
    name = (nameEl && nameEl.value.trim()) || 'Demo Student (Google)';
  } else {
    const emailEl = document.getElementById('dev-email');
    const nameEl = document.getElementById('dev-name');
    email = (emailEl && emailEl.value.trim()) || 'student.google@gmail.com';
    name = (nameEl && nameEl.value.trim()) || 'Demo Student (Google)';
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');

    currentStudentToken = data.token;
    localStorage.setItem('student_token', currentStudentToken);
    dismissLoginGate();
    toggleModal('auth-modal', false);
    await checkCurrentUser();
    await initBookmarks();
    showToast(`Signed in with Google as ${name}!`, 'success');
  } catch (err) {
    alert('Google login failed: ' + err.message);
  }
}

function dismissLoginGate() {
  const gate = document.getElementById('login-gate');
  if (!gate) return;
  gate.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
  gate.style.opacity = '0';
  gate.style.transform = 'scale(0.97)';
  setTimeout(() => gate.classList.add('hidden'), 380);
}

// ---------------------------------------------------------------------------
// AUTHENTICATION & STUDENT ACCOUNT
// ---------------------------------------------------------------------------
async function initAuth() {
  if (currentStudentToken) {
    // Optimistically hide gate immediately to avoid flash while we validate token
    const gate = document.getElementById('login-gate');
    if (gate) gate.classList.add('hidden');
    await checkCurrentUser();
    // If token was invalid, checkCurrentUser clears it and calls updateStudentAuthUI(null)
    // which will re-show the gate
    if (!currentUser) {
      if (gate) gate.classList.remove('hidden');
    }
  } else {
    updateStudentAuthUI(null);
  }
}

async function checkCurrentUser() {
  if (!currentStudentToken) {
    updateStudentAuthUI(null);
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/me`, {
      headers: { 'Authorization': `Bearer ${currentStudentToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      currentUserProfile = data.profile;
      updateStudentAuthUI(currentUser, data.unreadNotifications);
    } else {
      currentStudentToken = null;
      localStorage.removeItem('student_token');
      updateStudentAuthUI(null);
    }
  } catch (e) {
    console.warn('User status check offline:', e);
  }
}

function updateStudentAuthUI(user, unreadCount = 0) {
  const loggedOutBox = document.getElementById('auth-logged-out');
  const loggedInBox = document.getElementById('auth-logged-in');
  const displayName = document.getElementById('user-display-name');
  const avatarImg = document.getElementById('user-avatar-img');
  const avatarFallback = document.getElementById('user-avatar-fallback');
  const bellBadge = document.getElementById('bell-notif-badge');
  const menuBadge = document.getElementById('menu-notif-badge');
  const aiWidget = document.getElementById('ai-assistant-widget');

  if (user) {
    loggedOutBox.classList.add('hidden');
    loggedInBox.classList.remove('hidden');
    // Show AI widget only after login
    displayName.textContent = user.name || user.email.split('@')[0];

    if (user.picture) {
      avatarImg.src = user.picture;
      avatarImg.classList.remove('hidden');
      avatarFallback.classList.add('hidden');
    } else {
      avatarImg.classList.add('hidden');
      avatarFallback.classList.remove('hidden');
      avatarFallback.textContent = (user.name || 'U').charAt(0).toUpperCase();
    }

    if (unreadCount > 0) {
      bellBadge.textContent = unreadCount;
      bellBadge.classList.remove('hidden');
      menuBadge.textContent = unreadCount;
      menuBadge.classList.remove('hidden');
    } else {
      bellBadge.classList.add('hidden');
      menuBadge.classList.add('hidden');
    }
  } else {
    loggedOutBox.classList.remove('hidden');
    loggedInBox.classList.add('hidden');
    bellBadge.classList.add('hidden');
    menuBadge.classList.add('hidden');
  }
  // Ensure AI assistant widget is readily accessible
  if (aiWidget) aiWidget.style.display = '';
}

async function handleDevLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('dev-email').value;
  const name = document.getElementById('dev-name').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/dev-login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    currentStudentToken = data.token;
    localStorage.setItem('student_token', currentStudentToken);
    toggleModal('auth-modal', false);
    dismissLoginGate();
    await checkCurrentUser();
    await initBookmarks();
  } catch (err) {
    alert('Login Error: ' + err.message);
  }
}

function handleStudentLogout() {
  currentStudentToken = null;
  currentUser = null;
  currentUserProfile = null;
  localStorage.removeItem('student_token');
  updateStudentAuthUI(null);
  initBookmarks();
  // Re-show login gate on logout
  const gate = document.getElementById('login-gate');
  if (gate) {
    gate.style.opacity = '';
    gate.style.transform = '';
    gate.classList.remove('hidden');
  }
}

// ---------------------------------------------------------------------------
// PROFILE MANAGEMENT
// ---------------------------------------------------------------------------
async function openProfileModal() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  toggleModal('profile-modal', true);
  document.getElementById('profile-success').classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/api/profile`, { headers: getHeaders() });
    if (res.ok) {
      const prof = await res.json();
      currentUserProfile = prof;
      if (prof.state) document.getElementById('prof-state').value = prof.state;
      if (prof.category) document.getElementById('prof-category').value = prof.category;
      if (prof.gender) document.getElementById('prof-gender').value = prof.gender;
      if (prof.age) document.getElementById('prof-age').value = prof.age;
      if (prof.income) document.getElementById('prof-income').value = prof.income;
      if (prof.disability) document.getElementById('prof-disability').value = prof.disability;
      if (prof.occupation) document.getElementById('prof-occupation').value = prof.occupation;
      if (prof.education) document.getElementById('prof-education').value = prof.education;
      if (prof.domain) document.getElementById('prof-domain').value = prof.domain;
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

async function handleProfileFormSubmit(e) {
  e.preventDefault();
  const payload = {
    state: document.getElementById('prof-state').value,
    category: document.getElementById('prof-category').value,
    gender: document.getElementById('prof-gender').value,
    age: document.getElementById('prof-age').value,
    income: document.getElementById('prof-income').value,
    disability: document.getElementById('prof-disability').value,
    occupation: document.getElementById('prof-occupation').value,
    education: document.getElementById('prof-education').value,
    domain: document.getElementById('prof-domain').value,
  };

  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    currentUserProfile = await res.json();
    const succ = document.getElementById('profile-success');
    succ.classList.remove('hidden');
    setTimeout(() => succ.classList.add('hidden'), 2500);
  } catch (err) {
    alert('Error saving profile: ' + err.message);
  }
}

function autoFillFromProfile() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  if (!currentUserProfile) {
    openProfileModal();
    return;
  }
  const prof = currentUserProfile;
  if (prof.state) document.getElementById('state').value = prof.state;
  if (prof.category) document.getElementById('category').value = prof.category;
  if (prof.gender) document.getElementById('gender').value = prof.gender;
  if (prof.age) document.getElementById('age').value = prof.age;
  if (prof.income) document.getElementById('income').value = prof.income;
  if (prof.disability) {
    const rad = document.querySelector(`input[name="disability"][value="${prof.disability}"]`);
    if (rad) rad.checked = true;
  }
  if (prof.occupation) document.getElementById('occupation').value = prof.occupation;
  if (prof.education) document.getElementById('education').value = prof.education;
  if (prof.domain) document.getElementById('domain').value = prof.domain;
}

// ---------------------------------------------------------------------------
// BOOKMARKS
// ---------------------------------------------------------------------------
async function initBookmarks() {
  try {
    const res = await fetch(`${API_URL}/api/bookmarks`, { headers: getHeaders() });
    if (res.ok) {
      bookmarkedSchemeIds = await res.json();
      updateBookmarkCount();
    }
  } catch (err) {
    console.error('Failed to fetch bookmarks:', err);
  }
}

function updateBookmarkCount() {
  const el = document.getElementById('bookmark-count');
  if (el) el.textContent = bookmarkedSchemeIds.length;
}

async function toggleBookmark(schemeId, btnElement) {
  try {
    const res = await fetch(`${API_URL}/api/bookmarks/${schemeId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.bookmarked) {
        if (!bookmarkedSchemeIds.includes(schemeId)) bookmarkedSchemeIds.push(schemeId);
        btnElement.classList.add('saved');
        btnElement.innerHTML = `🔖 Saved`;
      } else {
        bookmarkedSchemeIds = bookmarkedSchemeIds.filter(id => id !== schemeId);
        btnElement.classList.remove('saved');
        btnElement.innerHTML = `🔖 Bookmark`;
      }
      updateBookmarkCount();
    }
  } catch (err) {
    console.error('Failed to toggle bookmark:', err);
  }
}

async function loadBookmarksTab() {
  const container = document.getElementById('bookmarks-list');
  container.innerHTML = '<div class="empty-state">⏳ Loading saved schemes...</div>';

  if (bookmarkedSchemeIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="icon">🔖</span>
        <p>You haven't bookmarked any schemes yet.</p>
      </div>`;
    return;
  }

  try {
    const promises = bookmarkedSchemeIds.map(id =>
      fetch(`${API_URL}/api/schemes/${id}`).then(res => res.ok ? res.json() : null)
    );
    const results = (await Promise.all(promises)).filter(Boolean);

    container.innerHTML = '';
    results.forEach(scheme => {
      const card = renderSchemeCard(scheme, false);
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<div class="empty-state">❌ Error loading bookmarked schemes.</div>';
  }
}

// ---------------------------------------------------------------------------
// MATCHING ENGINE FORM & RESULTS
// ---------------------------------------------------------------------------
let currentMatchResults = [];

async function handleMatchSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  const answers = {
    state: formData.get('state'),
    category: formData.get('category'),
    gender: formData.get('gender'),
    age: formData.get('age'),
    income: formData.get('income'),
    disability: formData.get('disability'),
    occupation: formData.get('occupation'),
    education: formData.get('education'),
    domain: formData.get('domain'),
  };

  const resultsList = document.getElementById('results-list');
  const exportBtn = document.getElementById('btn-export-results');
  resultsList.innerHTML = '<div class="empty-state">⏳ Calculating matches...</div>';

  try {
    const res = await fetch(`${API_URL}/api/match`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ answers }),
    });

    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    currentMatchResults = data.results || [];

    document.getElementById('results-count').textContent = `${data.count} scheme(s) found (${data.eligibleCount} fully eligible)`;
    resultsList.innerHTML = '';

    if (exportBtn) {
      if (currentMatchResults.length > 0) exportBtn.classList.remove('hidden');
      else exportBtn.classList.add('hidden');
    }

    if (data.results.length === 0) {
      resultsList.innerHTML = `
        <div class="empty-state">
          <span class="icon">💡</span>
          <p>No schemes matched your criteria. Try adjusting income thresholds or selection options.</p>
        </div>`;
      return;
    }

    data.results.forEach(scheme => {
      const card = renderSchemeCard(scheme, true);
      resultsList.appendChild(card);
    });
  } catch (err) {
    resultsList.innerHTML = '<div class="empty-state">❌ Failed to compute matches. Please try again.</div>';
  }
}

function resetMatcherForm() {
  const form = document.getElementById('matcher-form');
  if (form) form.reset();
  const resultsList = document.getElementById('results-list');
  if (resultsList) {
    resultsList.innerHTML = `
      <div class="empty-state">
        <span class="icon">🔍</span>
        <p>Fill out the questionnaire and click search to view matching government schemes.</p>
      </div>`;
  }
  const countEl = document.getElementById('results-count');
  if (countEl) countEl.textContent = '0 schemes found';
  const exportBtn = document.getElementById('btn-export-results');
  if (exportBtn) exportBtn.classList.add('hidden');
  currentMatchResults = [];
  showToast('Questionnaire reset.', 'info');
}

function exportMatchesReport() {
  if (!currentMatchResults || currentMatchResults.length === 0) {
    showToast('No matching schemes to export. Run the search first!', 'info');
    return;
  }
  window.print();
}

function shareSchemeLink(schemeId, schemeName) {
  const url = `${window.location.origin}/#scheme-${schemeId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast(`Link copied for "${schemeName}"! 📋`, 'success');
    }).catch(() => {
      showToast(`Scheme: ${url}`, 'info');
    });
  } else {
    showToast(`Scheme: ${url}`, 'info');
  }
}

// ---------------------------------------------------------------------------
// BROWSE SCHEMES
// ---------------------------------------------------------------------------
async function loadAllSchemes() {
  const container = document.getElementById('browse-list');
  container.innerHTML = '<div class="empty-state">⏳ Loading all schemes...</div>';
  await handleBrowseFilter();
}

async function handleBrowseFilter() {
  const q = document.getElementById('search-q').value;
  const domain = document.getElementById('filter-domain').value;
  const levelEl = document.getElementById('filter-level');
  const level = levelEl ? levelEl.value : '';
  const sortEl = document.getElementById('browse-sort');
  const sort = sortEl ? sortEl.value : 'default';
  const container = document.getElementById('browse-list');

  try {
    const url = new URL(`${window.location.origin}/api/schemes`);
    if (q) url.searchParams.append('q', q);
    if (domain) url.searchParams.append('domain', domain);

    const res = await fetch(url.toString(), { headers: getHeaders() });
    let schemes = await res.json();

    if (level) {
      schemes = schemes.filter(s => s.level === level);
    }

    if (sort === 'name-asc') {
      schemes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'deadline') {
      schemes.sort((a, b) => {
        if (a.deadline === 'Rolling') return 1;
        if (b.deadline === 'Rolling') return -1;
        return (a.deadline || '').localeCompare(b.deadline || '');
      });
    } else if (sort === 'income') {
      schemes.sort((a, b) => (a.incomeMax || Infinity) - (b.incomeMax || Infinity));
    }

    container.innerHTML = '';
    if (schemes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="icon">ℹ️</span>
          <p>No schemes found matching the filters.</p>
        </div>`;
      return;
    }

    schemes.forEach(scheme => {
      const card = renderSchemeCard(scheme, false);
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<div class="empty-state">❌ Error loading schemes.</div>';
  }
}

// ---------------------------------------------------------------------------
// SCHEME CARD RENDERING (FULL EXPLANATION & DETERMINISTIC REASONS)
// ---------------------------------------------------------------------------
function renderSchemeCard(scheme, hasScore) {
  const card = document.createElement('div');
  const isFullyEligible = scheme.isFullyEligible ?? true;
  card.className = `scheme-card ${hasScore ? (isFullyEligible ? 'full-match' : 'partial-match') : ''}`;

  const isSaved = bookmarkedSchemeIds.includes(scheme.id);
  const domainInfo = domainsCache.find(d => d.id === scheme.domain) || { en: scheme.domain };

  let scoreHtml = '';
  let reasonsHtml = '';
  let missingHtml = '';

  if (hasScore) {
    const badgeClass = isFullyEligible ? 'full' : 'partial';
    const label = isFullyEligible ? `⭐ ${scheme.score}% Match (Eligible)` : `⚡ ${scheme.score}% Match (Partial)`;
    scoreHtml = `<span class="score-badge ${badgeClass}">${label}</span>`;

    if (scheme.reasons && scheme.reasons.length > 0) {
      reasonsHtml = `
        <div class="reasons-list">
          <div class="reasons-title">Criteria Met:</div>
          <ul>
            ${scheme.reasons.map(r => `<li>✓ ${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>`;
    }

    if (scheme.missing && scheme.missing.length > 0) {
      missingHtml = `
        <div class="missing-list">
          <div class="missing-title">Missing / Unmet Requirements:</div>
          <ul>
            ${scheme.missing.map(m => `<li>⚠️ ${escapeHtml(m)}</li>`).join('')}
          </ul>
        </div>`;
    }
  }

  const cleanDesc = escapeHtml(scheme.shortDesc || '');
  const cleanMinistry = escapeHtml(scheme.ministry || '');
  const cleanBenefit = escapeHtml(scheme.benefit || '');
  const cleanBenefitType = escapeHtml(scheme.benefitType || 'Benefit');
  const cleanLevel = escapeHtml(scheme.level || 'Central');
  const cleanDomain = escapeHtml(domainInfo.en);
  const cleanDeadline = escapeHtml(scheme.deadline || 'Rolling');

  card.innerHTML = `
    <div class="scheme-card-header">
      <div>
        <div class="scheme-ministry">${cleanLevel} • ${cleanMinistry}</div>
        <h3 class="scheme-title">${escapeHtml(scheme.name)}</h3>
      </div>
      ${scoreHtml}
    </div>
    
    <p class="scheme-desc">${cleanDesc}</p>
    
    <div class="scheme-meta">
      <span class="meta-badge benefit-badge">${cleanBenefitType}: ${cleanBenefit}</span>
      <span class="meta-badge">${cleanDomain}</span>
      <span class="meta-badge">Deadline: ${cleanDeadline}</span>
    </div>

    ${reasonsHtml}
    ${missingHtml}

    <div class="scheme-actions">
      <button class="bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleBookmark('${scheme.id}', this)">
        ${isSaved ? '🔖 Saved' : '🔖 Bookmark'}
      </button>

      <button class="btn btn-secondary btn-sm" onclick="openQuickAppModal('${scheme.id}', '${escapeHtml(scheme.name).replace(/'/g, "\\'")}')">
        📝 Track Application
      </button>

      <button class="btn btn-secondary btn-sm" onclick="shareSchemeLink('${scheme.id}', '${escapeHtml(scheme.name).replace(/'/g, "\\'")}')" title="Copy shareable link">
        🔗 Share
      </button>
      
      <button class="collapsible-trigger" onclick="toggleDetailsCollapse(this)">Show Requirements ↓</button>
      
      <a href="${scheme.applyUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" title="Go directly to scheme page">Apply Now ↗</a>
    </div>

    <div class="scheme-details-content hidden">
      <div class="detail-section">
        <h4>📋 Eligibility Scope</h4>
        <p><strong>States:</strong> ${Array.isArray(scheme.states) ? scheme.states.join(', ') : scheme.states}</p>
        <p><strong>Social Category:</strong> ${Array.isArray(scheme.category) ? scheme.category.join(', ') : scheme.category}</p>
        <p><strong>Gender:</strong> ${scheme.gender}</p>
        <p><strong>Disability Constraint:</strong> ${scheme.disability === 'true' ? '40%+ Disability Required' : 'None'}</p>
        ${scheme.minAge || scheme.maxAge ? `<p><strong>Age Scope:</strong> ${scheme.minAge || 0} to ${scheme.maxAge || 'no limit'} years</p>` : ''}
        ${scheme.incomeMax ? `<p><strong>Income Cap:</strong> Under ₹${scheme.incomeMax.toLocaleString()}/year</p>` : ''}
        <p><strong>Education:</strong> ${Array.isArray(scheme.education) ? scheme.education.join(', ') : scheme.education}</p>
        <p><strong>Occupation:</strong> ${Array.isArray(scheme.occupation) ? scheme.occupation.join(', ') : scheme.occupation}</p>
      </div>
      
      ${scheme.documents && scheme.documents.length > 0 ? `
        <div class="detail-section">
          <h4>📂 Required Documents</h4>
          <ul>
            ${scheme.documents.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
          </ul>
        </div>` : ''}

      ${scheme.steps && scheme.steps.length > 0 ? `
        <div class="detail-section">
          <h4>🚶 Steps to Apply</h4>
          <ol>
            ${scheme.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>
        </div>` : ''}
      
      <div class="detail-section">
        <p style="font-size: 0.75rem; color: var(--text-muted);">
          <strong>Official Source:</strong> <a href="${scheme.applyUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(scheme.sourceUrl || scheme.applyUrl)}</a> (Verified: ${escapeHtml(scheme.lastVerified || '')})
        </p>
      </div>
    </div>
  `;

  return card;
}

function toggleDetailsCollapse(btn) {
  const card = btn.closest('.scheme-card');
  const details = card.querySelector('.scheme-details-content');
  if (details.classList.contains('hidden')) {
    details.classList.remove('hidden');
    btn.textContent = 'Hide Requirements ↑';
  } else {
    details.classList.add('hidden');
    btn.textContent = 'Show Requirements ↓';
  }
}

// ---------------------------------------------------------------------------
// APPLICATION TRACKER MODAL & OPERATIONS
// ---------------------------------------------------------------------------
async function openTrackerModal() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  toggleModal('tracker-modal', true);
  loadUserApplications();
}

async function loadUserApplications() {
  const tbody = document.getElementById('tracker-tbody');
  tbody.innerHTML = '<tr><td colspan="5">⏳ Loading your applications...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/applications`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load applications');
    const apps = await res.json();

    tbody.innerHTML = '';
    if (apps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No tracked applications yet. Click "📝 Track Application" on any scholarship to monitor progress!</td></tr>';
      return;
    }

    apps.forEach(app => {
      const tr = document.createElement('tr');
      const statusClass = 'status-' + (app.status || 'not-started').toLowerCase().replace(/\s+/g, '-');
      tr.innerHTML = `
        <td>
          <strong>${escapeHtml(app.scheme_name || 'Scholarship')}</strong>
          <br><span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(app.scheme_ministry || '')}</span>
        </td>
        <td>
          <select onchange="updateApplicationStatus('${app.id}', this.value)" style="font-size: 0.8rem; padding: 4px;">
            ${['Not Started', 'Preparing', 'Applied', 'Under Review', 'Approved', 'Rejected', 'Completed']
              .map(st => `<option value="${st}" ${app.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
          <br><span class="status-badge ${statusClass}">${escapeHtml(app.status)}</span>
        </td>
        <td style="font-size: 0.8rem;">${app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '—'}</td>
        <td style="font-size: 0.8rem;">${escapeHtml(app.notes || '—')}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteApplication('${app.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

function openQuickAppModal(schemeId, schemeName) {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  document.getElementById('quick-app-scheme-id').value = schemeId;
  document.getElementById('quick-app-id').value = '';
  document.getElementById('quick-app-scheme-name').textContent = schemeName;
  document.getElementById('quick-app-notes').value = '';
  document.getElementById('quick-app-status').value = 'Preparing';
  toggleModal('quick-app-modal', true);
}

async function handleQuickAppSubmit(e) {
  e.preventDefault();
  const schemeId = document.getElementById('quick-app-scheme-id').value;
  const status = document.getElementById('quick-app-status').value;
  const notes = document.getElementById('quick-app-notes').value;

  try {
    const res = await fetch(`${API_URL}/api/applications`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ scheme_id: schemeId, status, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create application record');
    }
    toggleModal('quick-app-modal', false);
    alert('Application added to your tracker!');
    checkCurrentUser();
  } catch (err) {
    alert('Tracker Error: ' + err.message);
  }
}

async function updateApplicationStatus(appId, newStatus) {
  try {
    const res = await fetch(`${API_URL}/api/applications/${appId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error('Failed to update status');
    loadUserApplications();
    checkCurrentUser();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deleteApplication(appId) {
  if (!confirm('Remove this application from your tracker?')) return;
  try {
    const res = await fetch(`${API_URL}/api/applications/${appId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Delete failed');
    loadUserApplications();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// DOCUMENT VAULT (GENUINE FILE STORAGE & METADATA)
// ---------------------------------------------------------------------------
async function openVaultModal() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  toggleModal('vault-modal', true);
  loadVaultDocuments();
}

async function loadVaultDocuments() {
  const tbody = document.getElementById('vault-tbody');
  tbody.innerHTML = '<tr><td colspan="5">⏳ Loading vault documents...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/documents`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load documents');
    const docs = await res.json();

    tbody.innerHTML = '';
    if (docs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No certificates or documents uploaded yet. Use the upload box above to store your verified files.</td></tr>';
      return;
    }

    docs.forEach(doc => {
      const tr = document.createElement('tr');
      const kb = (doc.file_size / 1024).toFixed(1);
      const date = new Date(doc.uploaded_at).toLocaleDateString();

      tr.innerHTML = `
        <td><strong>${escapeHtml(doc.doc_type)}</strong></td>
        <td>${escapeHtml(doc.file_name)}</td>
        <td>${kb} KB</td>
        <td>${date}</td>
        <td>
          <a href="${API_URL}/api/documents/${doc.id}/download" target="_blank" class="btn btn-secondary btn-sm">View / Download</a>
          <button class="btn btn-danger btn-sm" onclick="deleteVaultDocument('${doc.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function handleVaultUploadSubmit(e) {
  e.preventDefault();
  const fileInput = document.getElementById('doc-file-input');
  const typeSelect = document.getElementById('doc-type-select');
  const errDiv = document.getElementById('vault-error');
  const succDiv = document.getElementById('vault-success');

  errDiv.classList.add('hidden');
  succDiv.classList.add('hidden');

  if (!fileInput.files || fileInput.files.length === 0) {
    errDiv.textContent = 'Please choose a file to upload.';
    errDiv.classList.remove('hidden');
    return;
  }

  const file = fileInput.files[0];
  if (file.size > 5 * 1024 * 1024) {
    errDiv.textContent = 'File size exceeds maximum 5MB limit.';
    errDiv.classList.remove('hidden');
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    try {
      const res = await fetch(`${API_URL}/api/documents`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          docType: typeSelect.value,
          fileName: file.name,
          fileBase64: base64,
          mimeType: file.type || 'application/octet-stream',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      succDiv.textContent = `Document "${file.name}" safely stored in your vault!`;
      succDiv.classList.remove('hidden');
      fileInput.value = '';
      loadVaultDocuments();
      checkCurrentUser();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove('hidden');
    }
  };
  reader.onerror = () => {
    errDiv.textContent = 'Failed to read local file.';
    errDiv.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

async function deleteVaultDocument(docId) {
  if (!confirm('Permanently delete this document from your vault?')) return;
  try {
    const res = await fetch(`${API_URL}/api/documents/${docId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Delete failed');
    loadVaultDocuments();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------------
async function openNotificationsModal() {
  if (!currentStudentToken) {
    toggleModal('auth-modal', true);
    return;
  }
  toggleModal('notif-modal', true);
  loadNotifications();
}

async function loadNotifications() {
  const container = document.getElementById('notif-list');
  container.innerHTML = '<div class="empty-state">⏳ Loading alerts...</div>';

  try {
    const res = await fetch(`${API_URL}/api/notifications`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load notifications');
    const notifs = await res.json();

    container.innerHTML = '';
    if (notifs.length === 0) {
      container.innerHTML = '<div class="empty-state">No alerts or notifications at this time.</div>';
      return;
    }

    notifs.forEach(n => {
      const item = document.createElement('div');
      item.className = `notif-item ${n.is_read ? '' : 'unread'}`;
      const timeStr = new Date(n.created_at).toLocaleString();

      item.innerHTML = `
        <div>
          <div class="notif-item-title">${escapeHtml(n.title)}</div>
          <div class="notif-item-msg">${escapeHtml(n.message)}</div>
        </div>
        <div style="text-align: right;">
          <div class="notif-item-time">${timeStr}</div>
          ${!n.is_read ? `<button class="btn btn-secondary btn-sm" onclick="markNotificationRead('${n.id}', this)" style="margin-top: 4px; font-size: 0.7rem; padding: 2px 6px;">Mark Read</button>` : ''}
        </div>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state error-text">❌ ${err.message}</div>`;
  }
}

async function markNotificationRead(notifId, btn) {
  try {
    await fetch(`${API_URL}/api/notifications/${notifId}/read`, {
      method: 'POST',
      headers: getHeaders(),
    });
    btn.closest('.notif-item').classList.remove('unread');
    btn.remove();
    checkCurrentUser();
  } catch (e) {}
}

async function markAllNotificationsRead() {
  try {
    await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'POST',
      headers: getHeaders(),
    });
    loadNotifications();
    checkCurrentUser();
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// SERVICE REQUESTS (DONATION, VOLUNTEER, FEEDBACK)
// ---------------------------------------------------------------------------
async function handleDonationSubmit(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('donation-status');
  statusDiv.classList.add('hidden');

  const payload = {
    type: 'donation',
    amount: document.getElementById('don-amount').value,
    name: document.getElementById('don-name').value,
    email: document.getElementById('don-email').value,
    pan: document.getElementById('don-pan').value,
    message: document.getElementById('don-message').value,
  };

  try {
    const res = await fetch(`${API_URL}/api/service-requests`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submission failed');

    statusDiv.textContent = data.message;
    statusDiv.classList.remove('hidden');
    document.getElementById('donation-form').reset();
    setTimeout(() => toggleModal('donation-modal', false), 4000);
  } catch (err) {
    alert('Donation error: ' + err.message);
  }
}

async function handleVolunteerSubmit(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('volunteer-status');
  statusDiv.classList.add('hidden');

  const payload = {
    type: 'volunteer',
    name: document.getElementById('vol-name').value,
    email: document.getElementById('vol-email').value,
    interests: document.getElementById('vol-interests').value,
    availability: document.getElementById('vol-availability').value,
    message: document.getElementById('vol-message').value,
  };

  try {
    const res = await fetch(`${API_URL}/api/service-requests`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Volunteer registration failed');

    statusDiv.textContent = data.message;
    statusDiv.classList.remove('hidden');
    document.getElementById('volunteer-form').reset();
    setTimeout(() => toggleModal('volunteer-modal', false), 3500);
  } catch (err) {
    alert('Volunteer error: ' + err.message);
  }
}

async function handleFeedbackSubmit(e) {
  e.preventDefault();
  const statusDiv = document.getElementById('feedback-status');
  statusDiv.classList.add('hidden');

  const ratingEl = document.querySelector('input[name="rating"]:checked');
  const payload = {
    rating: ratingEl ? parseInt(ratingEl.value, 10) : 5,
    message: document.getElementById('fb-message').value,
  };

  try {
    const res = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send feedback');

    statusDiv.textContent = data.message;
    statusDiv.classList.remove('hidden');
    document.getElementById('feedback-form').reset();
    setTimeout(() => toggleModal('feedback-modal', false), 2500);
  } catch (err) {
    alert('Feedback error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// ADMIN PORTAL & SUB-TABS
// ---------------------------------------------------------------------------
function initAdminSubnav() {
  const btns = document.querySelectorAll('.admin-subnav-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.getAttribute('data-admin-panel');
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(targetId)?.classList.remove('hidden');

      if (targetId === 'panel-schemes') loadAdminSchemes();
      else if (targetId === 'panel-users') loadAdminUsers();
      else if (targetId === 'panel-apps') loadAdminApplications();
      else if (targetId === 'panel-requests') loadAdminServiceRequests();
      else if (targetId === 'panel-feedback') loadAdminFeedback();
      else if (targetId === 'panel-audit') loadAdminAuditLogs();
    });
  });
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('login-error');
  errorDiv.classList.add('hidden');

  try {
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (!res.ok) {
      errorDiv.textContent = data.error || 'Authentication failed.';
      errorDiv.classList.remove('hidden');
    } else {
      currentAdminToken = data.token;
      localStorage.setItem('admin_token', currentAdminToken);
      updateAdminView();
      loadAdminDashboard();
    }
  } catch (err) {
    errorDiv.textContent = 'Network or server error.';
    errorDiv.classList.remove('hidden');
  }
}

function handleAdminLogout() {
  currentAdminToken = null;
  localStorage.removeItem('admin_token');
  updateAdminView();
}

function updateAdminView() {
  const loginView = document.getElementById('admin-login-view');
  const dashboardView = document.getElementById('admin-dashboard-view');
  if (currentAdminToken) {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  } else {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }
}

async function loadAdminDashboard() {
  loadAdminSchemes();
  loadAdminUsers();
  loadAdminApplications();
  loadAdminServiceRequests();
  loadAdminFeedback();
}

async function loadAdminSchemes() {
  const tbody = document.getElementById('admin-schemes-tbody');
  tbody.innerHTML = '<tr><td colspan="7">⏳ Loading schemes...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/schemes`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to load schemes');
    const schemes = await res.json();

    document.getElementById('admin-schemes-count').textContent = schemes.length;
    tbody.innerHTML = '';
    if (schemes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No schemes in database.</td></tr>';
      return;
    }

    schemes.forEach(s => {
      const tr = document.createElement('tr');
      const domainInfo = domainsCache.find(d => d.id === s.domain) || { en: s.domain };

      tr.innerHTML = `
        <td><strong>${s.id}</strong></td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.ministry)} <br><span class="badge" style="font-size:0.7rem">${escapeHtml(s.level)}</span></td>
        <td>${escapeHtml(domainInfo.en)}</td>
        <td>${escapeHtml(s.benefit)}</td>
        <td>
          <label class="switch">
            <input type="checkbox" ${s.active ? 'checked' : ''} onchange="toggleSchemeActive('${s.id}')">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editScheme('${s.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteScheme('${s.id}', '${escapeHtml(s.name).replace(/'/g, "\\'")}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = '<tr><td colspan="8">⏳ Loading users...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    const users = await res.json();

    document.getElementById('admin-users-count').textContent = users.length;
    tbody.innerHTML = '';
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No registered students yet.</td></tr>';
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      const date = new Date(u.created_at).toLocaleDateString();
      tr.innerHTML = `
        <td><strong>${u.id}</strong></td>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge">${u.role}</span></td>
        <td>${escapeHtml(u.state || '—')} / ${escapeHtml(u.education || '—')}</td>
        <td>${u.app_count}</td>
        <td>${u.doc_count}</td>
        <td>${date}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminApplications() {
  const tbody = document.getElementById('admin-apps-tbody');
  tbody.innerHTML = '<tr><td colspan="7">⏳ Loading applications...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/applications`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch applications');
    const apps = await res.json();

    document.getElementById('admin-apps-count').textContent = apps.length;
    tbody.innerHTML = '';
    if (apps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">No tracked applications in the system.</td></tr>';
      return;
    }

    apps.forEach(a => {
      const tr = document.createElement('tr');
      const statusClass = 'status-' + (a.status || 'not-started').toLowerCase().replace(/\s+/g, '-');
      tr.innerHTML = `
        <td><strong>${a.id}</strong></td>
        <td>${escapeHtml(a.user_name || 'Student')} <br><span style="font-size:0.75rem; color: var(--text-muted);">${escapeHtml(a.user_email || '')}</span></td>
        <td>${escapeHtml(a.scheme_name || a.scheme_id)}</td>
        <td><span class="status-badge ${statusClass}">${escapeHtml(a.status)}</span></td>
        <td>${a.applied_at ? new Date(a.applied_at).toLocaleDateString() : '—'}</td>
        <td style="font-size: 0.8rem;">${escapeHtml(a.notes || '—')}</td>
        <td style="font-size: 0.75rem;">${new Date(a.updated_at).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminServiceRequests() {
  const tbody = document.getElementById('admin-requests-tbody');
  tbody.innerHTML = '<tr><td colspan="5">⏳ Loading service requests...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/service-requests`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch service requests');
    const rows = await res.json();

    document.getElementById('admin-requests-count').textContent = rows.length;
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No service or donation requests.</td></tr>';
      return;
    }

    rows.forEach(r => {
      const tr = document.createElement('tr');
      let details = '';
      try {
        const d = JSON.parse(r.data);
        if (r.type === 'donation') {
          details = `<strong>₹${parseInt(d.amount).toLocaleString()}</strong> by ${escapeHtml(d.name)} (${escapeHtml(d.email)}) ${d.pan ? `[PAN: ${escapeHtml(d.pan)}]` : ''}`;
        } else if (r.type === 'volunteer') {
          details = `${escapeHtml(d.name)} (${escapeHtml(d.email)}) - Areas: ${escapeHtml(d.interests)} [${escapeHtml(d.availability || '')}]`;
        } else {
          details = escapeHtml(r.data);
        }
      } catch (e) {
        details = escapeHtml(r.data);
      }

      tr.innerHTML = `
        <td><strong>${r.id}</strong></td>
        <td><span class="badge">${r.type.toUpperCase()}</span></td>
        <td><span class="status-badge status-applied">${r.status}</span></td>
        <td>${details}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminFeedback() {
  const tbody = document.getElementById('admin-feedback-tbody');
  tbody.innerHTML = '<tr><td colspan="5">⏳ Loading feedback...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/feedback`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch feedback');
    const fbs = await res.json();

    document.getElementById('admin-feedback-count').textContent = fbs.length;
    tbody.innerHTML = '';
    if (fbs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No feedback received yet.</td></tr>';
      return;
    }

    fbs.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.id}</td>
        <td>${escapeHtml(f.user_name || 'Anonymous')} ${f.user_email ? `(${escapeHtml(f.user_email)})` : ''}</td>
        <td>${'⭐'.repeat(f.rating)} (${f.rating}/5)</td>
        <td>${escapeHtml(f.message)}</td>
        <td>${new Date(f.created_at).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function loadAdminAuditLogs() {
  const tbody = document.getElementById('audit-logs-tbody');
  tbody.innerHTML = '<tr><td colspan="2">⏳ Loading logs...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/api/admin/audit-log`, {
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Failed to fetch audit log');
    const logs = await res.json();

    tbody.innerHTML = '';
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2">No admin actions logged yet.</td></tr>';
      return;
    }

    logs.forEach(log => {
      const tr = document.createElement('tr');
      const dateStr = new Date(log.ts).toLocaleString();
      tr.innerHTML = `
        <td style="white-space: nowrap; color: var(--text-muted);">${dateStr}</td>
        <td><strong>${escapeHtml(log.message)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="2" class="error-text">❌ ${err.message}</td></tr>`;
  }
}

async function toggleSchemeActive(schemeId) {
  try {
    const res = await fetch(`${API_URL}/api/schemes/${schemeId}/toggle`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Toggle failed');
    loadAdminSchemes();
    loadStats();
  } catch (err) {
    alert('Error toggling scheme status: ' + err.message);
    loadAdminSchemes();
  }
}

async function deleteScheme(schemeId, name) {
  if (!confirm(`Are you sure you want to permanently delete the scheme "${name}"?`)) return;

  try {
    const res = await fetch(`${API_URL}/api/schemes/${schemeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentAdminToken}` },
    });
    if (!res.ok) throw new Error('Delete failed');
    loadAdminSchemes();
    loadStats();
  } catch (err) {
    alert('Error deleting scheme: ' + err.message);
  }
}

function openSchemeModal(scheme = null) {
  const title = document.getElementById('modal-title');
  const form = document.getElementById('scheme-form');
  form.reset();

  if (scheme) {
    title.textContent = `Edit Scheme: ${scheme.name}`;
    document.getElementById('scheme-form-id').value = scheme.id;
    document.getElementById('f-name').value = scheme.name;
    document.getElementById('f-shortDesc').value = scheme.shortDesc || '';
    document.getElementById('f-ministry').value = scheme.ministry || '';
    document.getElementById('f-level').value = scheme.level || 'Central';
    document.getElementById('f-domain').value = scheme.domain || '';

    document.getElementById('f-states').value = Array.isArray(scheme.states) ? JSON.stringify(scheme.states) : scheme.states;
    document.getElementById('f-category').value = Array.isArray(scheme.category) ? JSON.stringify(scheme.category) : scheme.category;
    document.getElementById('f-gender').value = scheme.gender || 'Any';
    document.getElementById('f-disability').value = scheme.disability || 'either';
    document.getElementById('f-minAge').value = scheme.minAge ?? '';
    document.getElementById('f-maxAge').value = scheme.maxAge ?? '';
    document.getElementById('f-incomeMax').value = scheme.incomeMax ?? '';
    document.getElementById('f-education').value = Array.isArray(scheme.education) ? JSON.stringify(scheme.education) : scheme.education;
    document.getElementById('f-occupation').value = Array.isArray(scheme.occupation) ? JSON.stringify(scheme.occupation) : scheme.occupation;

    document.getElementById('f-benefitType').value = scheme.benefitType || '';
    document.getElementById('f-benefit').value = scheme.benefit || '';
    document.getElementById('f-applyUrl').value = scheme.applyUrl || '';
    document.getElementById('f-deadline').value = scheme.deadline || 'Rolling';
    document.getElementById('f-documents').value = JSON.stringify(scheme.documents || []);
    document.getElementById('f-steps').value = JSON.stringify(scheme.steps || []);
  } else {
    title.textContent = 'Add New Scheme';
    document.getElementById('scheme-form-id').value = '';
    document.getElementById('f-level').value = 'Central';
    document.getElementById('f-states').value = 'All';
    document.getElementById('f-category').value = 'All';
    document.getElementById('f-gender').value = 'Any';
    document.getElementById('f-disability').value = 'either';
    document.getElementById('f-education').value = 'Any';
    document.getElementById('f-occupation').value = 'Any';
    document.getElementById('f-deadline').value = 'Rolling';
    document.getElementById('f-documents').value = '[]';
    document.getElementById('f-steps').value = '[]';
  }

  toggleModal('scheme-modal', true);
}

async function editScheme(schemeId) {
  try {
    const res = await fetch(`${API_URL}/api/schemes/${schemeId}`);
    if (!res.ok) throw new Error('Failed to load scheme details');
    const scheme = await res.json();
    openSchemeModal(scheme);
  } catch (err) {
    alert('Error fetching scheme: ' + err.message);
  }
}

function parseFlexInput(val) {
  if (!val) return 'All';
  const trimmed = val.trim();
  if (trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'any') {
    return trimmed;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  if (trimmed.includes(',')) {
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }
  return trimmed;
}

async function handleSchemeFormSubmit(e) {
  e.preventDefault();
  const schemeId = document.getElementById('scheme-form-id').value;

  const payload = {
    name: document.getElementById('f-name').value,
    shortDesc: document.getElementById('f-shortDesc').value,
    ministry: document.getElementById('f-ministry').value,
    level: document.getElementById('f-level').value,
    domain: document.getElementById('f-domain').value,
    states: parseFlexInput(document.getElementById('f-states').value),
    category: parseFlexInput(document.getElementById('f-category').value),
    gender: document.getElementById('f-gender').value,
    disability: document.getElementById('f-disability').value,
    minAge: parseInt(document.getElementById('f-minAge').value) || null,
    maxAge: parseInt(document.getElementById('f-maxAge').value) || null,
    incomeMax: parseInt(document.getElementById('f-incomeMax').value) || null,
    education: parseFlexInput(document.getElementById('f-education').value),
    occupation: parseFlexInput(document.getElementById('f-occupation').value),
    benefitType: document.getElementById('f-benefitType').value,
    benefit: document.getElementById('f-benefit').value,
    applyUrl: document.getElementById('f-applyUrl').value,
    deadline: document.getElementById('f-deadline').value,
    documents: JSON.parse(document.getElementById('f-documents').value || '[]'),
    steps: JSON.parse(document.getElementById('f-steps').value || '[]'),
  };

  const method = schemeId ? 'PUT' : 'POST';
  const url = schemeId ? `${API_URL}/api/schemes/${schemeId}` : `${API_URL}/api/schemes`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save scheme');
    }

    toggleModal('scheme-modal', false);
    loadAdminSchemes();
    loadStats();
  } catch (err) {
    alert('Error saving scheme: ' + err.message);
  }
}

async function handleBulkImportSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('bulk-json-input').value;
  const errorDiv = document.getElementById('bulk-error');
  const successDiv = document.getElementById('bulk-success');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    errorDiv.textContent = 'Invalid JSON: ' + err.message;
    errorDiv.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/schemes/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentAdminToken}`,
      },
      body: JSON.stringify(parsed),
    });

    const data = await res.json();
    if (!res.ok) {
      errorDiv.textContent = data.error || 'Bulk import failed.';
      errorDiv.classList.remove('hidden');
    } else {
      successDiv.textContent = `Successfully imported ${data.imported} schemes.`;
      successDiv.classList.remove('hidden');
      document.getElementById('bulk-json-input').value = '';
      setTimeout(() => {
        toggleModal('bulk-modal', false);
        successDiv.classList.add('hidden');
      }, 1500);
      loadAdminSchemes();
      loadStats();
    }
  } catch (err) {
    errorDiv.textContent = 'Server error: ' + err.message;
    errorDiv.classList.remove('hidden');
  }
}

// ---------------------------------------------------------------------------
// MODAL HELPER
// ---------------------------------------------------------------------------
function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  if (show) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

// ===========================================================================
// AI CHAT ASSISTANT & VOICE GUIDANCE (SCHEMEMITRA AI)
// ===========================================================================
let aiVoiceEnabled = true;
let aiSpeechRecognition = null;
let isVoiceListening = false;

function initAIAssistant() {
  const toggleBtn = document.getElementById('ai-assistant-toggle');
  const container = document.getElementById('ai-assistant-container');
  const closeBtn = document.getElementById('ai-close-btn');
  const clearBtn = document.getElementById('ai-clear-btn');
  const voiceToggle = document.getElementById('ai-voice-toggle');
  const form = document.getElementById('ai-chat-form');
  const input = document.getElementById('ai-chat-input');
  const micBtn = document.getElementById('ai-mic-btn');
  const cancelSpeechBtn = document.getElementById('ai-speech-cancel');
  const chipsContainer = document.getElementById('ai-suggestion-chips');

  if (!toggleBtn || !container) return;

  // Toggle open/close
  toggleBtn.addEventListener('click', () => {
    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
      container.classList.remove('hidden');
      input?.focus();
    } else {
      container.classList.add('hidden');
      stopVoiceRecognition();
    }
  });

  closeBtn?.addEventListener('click', () => {
    container.classList.add('hidden');
    stopVoiceRecognition();
  });

  // Clear chat
  clearBtn?.addEventListener('click', () => {
    const messagesEl = document.getElementById('ai-chat-messages');
    if (!messagesEl) return;
    messagesEl.innerHTML = `
      <div class="ai-msg ai-msg-bot">
        <div class="ai-msg-bubble">
          <strong>Chat cleared! ✨</strong> How can I assist you with Indian scholarships or website guidance today?
        </div>
      </div>
    `;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  });

  // Voice narration toggle (Mute / Unmute)
  voiceToggle?.addEventListener('click', () => {
    aiVoiceEnabled = !aiVoiceEnabled;
    if (aiVoiceEnabled) {
      voiceToggle.classList.add('active');
      voiceToggle.textContent = '🔊';
      voiceToggle.title = 'Voice Output: Enabled (Click to Mute)';
      showToast('AI Voice guidance enabled 🔊', 'info');
    } else {
      voiceToggle.classList.remove('active');
      voiceToggle.textContent = '🔇';
      voiceToggle.title = 'Voice Output: Muted (Click to Unmute)';
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      showToast('AI Voice output muted 🔇', 'info');
    }
  });

  // Form submit
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    input.value = '';
    sendAIMessage(query);
  });

  // Suggestion chips
  chipsContainer?.addEventListener('click', (e) => {
    const chip = e.target.closest('.ai-chip');
    if (!chip) return;
    const prompt = chip.getAttribute('data-prompt') || chip.textContent.trim();
    sendAIMessage(prompt);
  });

  // Voice recognition mic button
  micBtn?.addEventListener('click', toggleVoiceRecognition);
  cancelSpeechBtn?.addEventListener('click', stopVoiceRecognition);
}

async function sendAIMessage(query) {
  const messagesEl = document.getElementById('ai-chat-messages');
  if (!messagesEl) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Render User bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg ai-msg-user';
  userMsg.innerHTML = `
    <div class="ai-msg-bubble">${escapeHtml(query)}</div>
    <div class="ai-msg-footer" style="justify-content: flex-end;">
      <span class="ai-msg-time">${timeStr}</span>
    </div>
  `;
  messagesEl.appendChild(userMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Render Typing indicator
  const typingMsg = document.createElement('div');
  typingMsg.className = 'ai-msg ai-msg-bot';
  typingMsg.innerHTML = `
    <div class="ai-msg-bubble">
      <div class="ai-typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesEl.appendChild(typingMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await fetch(`${API_URL}/api/ai-chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message: query }),
    });
    const data = await res.json();
    typingMsg.remove();

    if (!res.ok) throw new Error(data.error || 'Unable to get response');

    // Render Bot bubble with markdown-like parsing
    const botMsg = document.createElement('div');
    botMsg.className = 'ai-msg ai-msg-bot';

    let formatted = formatAIMarkdown(data.reply || 'Here is what I found for you.');

    // If scheme recommendation cards are returned
    let schemesCardsHtml = '';
    if (Array.isArray(data.schemes) && data.schemes.length > 0) {
      schemesCardsHtml = `
        <div class="ai-scheme-cards-box">
          ${data.schemes.map(s => `
            <div class="ai-mini-scheme-card">
              <div class="ai-mini-card-head">
                <span class="ai-mini-domain-tag">${escapeHtml(s.domain || 'Welfare')}</span>
                <span class="ai-mini-deadline">⏳ ${escapeHtml(s.deadline || 'Rolling')}</span>
              </div>
              <h5 class="ai-mini-scheme-title">${escapeHtml(s.name)}</h5>
              <p class="ai-mini-scheme-benefit">💰 ${escapeHtml(s.benefit || 'Financial Support')}</p>
              <div class="ai-mini-actions">
                ${s.applyUrl ? `<a href="${escapeHtml(s.applyUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-light">Apply ↗</a>` : ''}
                <button type="button" class="btn btn-sm btn-secondary" onclick="trackSchemeFromAI('${escapeHtml(s.id)}', '${escapeHtml(s.name).replace(/'/g, "\\'")}')">Track 📋</button>
                <button type="button" class="btn btn-sm btn-secondary" onclick="bookmarkSchemeFromAI('${escapeHtml(s.id)}')">Save 🔖</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // If an action button is recommended
    let actionBtnHtml = '';
    if (data.action) {
      if (data.action === 'START_TOUR') {
        actionBtnHtml = `<br><button type="button" class="ai-action-btn-bubble" onclick="startWebsiteTour()">🧭 Start Interactive Tour</button>`;
      } else if (data.action === 'OPEN_SERVICES') {
        actionBtnHtml = `<br><button type="button" class="ai-action-btn-bubble" onclick="openServicesFromAI()">⚡ Open Services Menu</button>`;
      } else if (data.action === 'OPEN_MODAL' && data.target) {
        actionBtnHtml = `<br><button type="button" class="ai-action-btn-bubble" onclick="toggleModal('${data.target}', true)">🚀 Open Now</button>`;
      } else if (data.action === 'SCROLL_TO_MATCH') {
        actionBtnHtml = `<br><button type="button" class="ai-action-btn-bubble" onclick="scrollToMatcherFromAI()">🎯 Go to Matcher</button>`;
      }
    }

    botMsg.innerHTML = `
      <div class="ai-msg-bubble">
        ${formatted}
        ${actionBtnHtml}
        ${schemesCardsHtml}
      </div>
      <div class="ai-msg-footer">
        <span class="ai-msg-time">${timeStr}</span>
        <button type="button" class="ai-msg-copy-btn" onclick="copyAIMessage(this)" title="Copy assistant answer">📋 Copy</button>
      </div>
    `;
    messagesEl.appendChild(botMsg);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Execute direct UI action automatically if appropriate
    if (data.action) {
      executeAssistantAction(data.action, data.target);
    }

    // Update suggestion chips
    if (Array.isArray(data.chips) && data.chips.length > 0) {
      updateSuggestionChips(data.chips);
    }

    // Voice narration
    if (aiVoiceEnabled && data.voiceText) {
      speakAIText(data.voiceText);
    }
  } catch (err) {
    typingMsg.remove();
    const errorMsg = document.createElement('div');
    errorMsg.className = 'ai-msg ai-msg-bot';
    errorMsg.innerHTML = `
      <div class="ai-msg-bubble" style="color:#ef4444;">⚠️ <strong>Notice:</strong> ${escapeHtml(err.message)}</div>
      <div class="ai-msg-footer">
        <span class="ai-msg-time">${timeStr}</span>
      </div>
    `;
    messagesEl.appendChild(errorMsg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

function copyAIMessage(btn) {
  const bubble = btn.closest('.ai-msg').querySelector('.ai-msg-bubble');
  if (!bubble) return;
  const text = bubble.innerText.replace(/Apply ↗|Track 📋|Save 🔖/g, '').trim();
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  }).catch(() => {
    showToast('Failed to copy message to clipboard', 'error');
  });
}

function trackSchemeFromAI(schemeId, schemeName) {
  if (!currentStudentToken) {
    showToast('Sign in or continue as student to track applications!', 'info');
    toggleModal('auth-modal', true);
    return;
  }
  openQuickAppModal(schemeId, schemeName);
}

async function bookmarkSchemeFromAI(schemeId) {
  await toggleBookmark(schemeId);
}

function updateSuggestionChips(chips) {
  const container = document.getElementById('ai-suggestion-chips');
  if (!container) return;
  container.innerHTML = chips.map(c => `<button type="button" class="ai-chip" data-prompt="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
}

function formatAIMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1 ↗</a>');
  html = html.replace(/^###\s+(.+)$/gm, '<h4 style="margin:4px 0 6px 0;font-size:0.95rem;color:#0f172a;">$1</h4>');
  html = html.replace(/^\s*[•\-]\s+(.+)$/gm, '<div style="margin-left:8px;padding-left:6px;border-left:2px solid #cbd5e1;margin-bottom:4px;">• $1</div>');
  html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  return html;
}

// ---------------------------------------------------------------------------
// VOICE SYNTHESIS (TEXT-TO-SPEECH)
// ---------------------------------------------------------------------------
function speakAIText(text) {
  if (!('speechSynthesis' in window) || !aiVoiceEnabled) return;

  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#_`\[\]()•]/g, ' ').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;

  const locale = LANG_LOCALE[getLang()] || 'en-IN';
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = locale;
  utterance.rate = 1.0;
  utterance.pitch = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang === locale) ||
                voices.find(v => v.lang.split('-')[0] === locale.split('-')[0]) ||
                voices.find(v => v.name.includes('India'));
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// SPEECH RECOGNITION (VOICE-TO-TEXT)
// ---------------------------------------------------------------------------
function toggleVoiceRecognition() {
  if (isVoiceListening) {
    stopVoiceRecognition();
  } else {
    startVoiceRecognition();
  }
}

function startVoiceRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showToast('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.', 'error');
    return;
  }

  try {
    const locale = LANG_LOCALE[getLang()] || 'en-IN';
    aiSpeechRecognition = new SpeechRec();
    aiSpeechRecognition.lang = locale;
    aiSpeechRecognition.continuous = false;
    aiSpeechRecognition.interimResults = false;

    const micBtn = document.getElementById('ai-mic-btn');
    const speechBar = document.getElementById('ai-speech-indicator');

    aiSpeechRecognition.onstart = () => {
      isVoiceListening = true;
      micBtn?.classList.add('listening');
      speechBar?.classList.remove('hidden');
      const speechText = speechBar?.querySelector('.ai-speech-text');
      if (speechText) {
        const short = (locale || 'en-IN').split('-')[0].toUpperCase();
        speechText.textContent = `${t('listening')} (${short})`;
      }
    };

    aiSpeechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        const input = document.getElementById('ai-chat-input');
        if (input) input.value = transcript;
        sendAIMessage(transcript);
      }
    };

    aiSpeechRecognition.onerror = (e) => {
      console.warn('Voice recognition error:', e.error);
      stopVoiceRecognition();
      if (e.error === 'not-allowed') {
        showToast('Microphone access blocked. Please allow mic permissions in your browser.', 'error');
      }
    };

    aiSpeechRecognition.onend = () => {
      stopVoiceRecognition();
    };

    aiSpeechRecognition.start();
  } catch (err) {
    console.error('Failed to start speech recognition:', err);
    stopVoiceRecognition();
  }
}

function stopVoiceRecognition() {
  isVoiceListening = false;
  const micBtn = document.getElementById('ai-mic-btn');
  const speechBar = document.getElementById('ai-speech-indicator');
  micBtn?.classList.remove('listening');
  speechBar?.classList.add('hidden');
  if (aiSpeechRecognition) {
    try { aiSpeechRecognition.stop(); } catch(e) {}
    aiSpeechRecognition = null;
  }
}

// ---------------------------------------------------------------------------
// ASSISTANT GUIDANCE & PAGE ACTIONS
// ---------------------------------------------------------------------------
function executeAssistantAction(action, target) {
  if (action === 'OPEN_SERVICES') {
    openServicesFromAI();
  } else if (action === 'OPEN_MODAL' && target) {
    toggleModal(target, true);
  } else if (action === 'SCROLL_TO_MATCH') {
    scrollToMatcherFromAI();
  }
}

function openServicesFromAI() {
  const menu = document.getElementById('services-menu');
  const btn = document.getElementById('btn-services-menu');
  if (menu) {
    menu.classList.remove('hidden');
    btn?.setAttribute('aria-expanded', 'true');
    menu.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function scrollToMatcherFromAI() {
  const form = document.getElementById('matcher-form');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const stateEl = document.getElementById('state');
    if (stateEl) stateEl.focus();
  }
}

function startWebsiteTour() {
  const messagesEl = document.getElementById('ai-chat-messages');
  if (!messagesEl) return;

  const tourMsg = document.createElement('div');
  tourMsg.className = 'ai-msg ai-msg-bot';
  tourMsg.innerHTML = `
    <div class="ai-msg-bubble">
      <strong>🚀 Starting Interactive Website Tour:</strong>
      <ol style="margin:8px 0 8px 18px;padding:0;line-height:1.6;">
        <li><strong>Eligibility Matcher</strong>: Uses our 9-criteria matching engine to recommend exact scholarships for your caste, income, and state.</li>
        <li><strong>⚡ Services Menu</strong>: Located in the top bar with quick access to your Application Tracker, Vault, and Alerts.</li>
        <li><strong>Document Vault</strong>: Safeguard your Income, Caste, and Marks certificates safely on your device.</li>
        <li><strong>Application Tracker</strong>: Never miss a deadline or scholarship status change!</li>
      </ol>
      <em>You can say "Open Tracker", "Open Vault", or "Show Services" anytime!</em>
    </div>
  `;
  messagesEl.appendChild(tourMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const speechText = "Welcome to the interactive tour! Step one: use our eligibility matcher form to find scholarships matching your profile. Step two: open the Services menu in the top bar for your Application Tracker and Document Vault. Step three: safely upload your certificates in the Document Vault. Enjoy exploring!";
  if (aiVoiceEnabled) speakAIText(speechText);
}

// Global hooks for inline onclick handlers
window.startWebsiteTour = startWebsiteTour;
window.openServicesFromAI = openServicesFromAI;
window.scrollToMatcherFromAI = scrollToMatcherFromAI;
window.copyAIMessage = copyAIMessage;
window.trackSchemeFromAI = trackSchemeFromAI;
window.bookmarkSchemeFromAI = bookmarkSchemeFromAI;
window.shareSchemeLink = shareSchemeLink;

