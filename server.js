// Scheme Matcher — backend API server
// Zero external dependencies: uses only Node's built-in http, node:sqlite and node:crypto.
// Requires Node.js v22.5+ (for the built-in node:sqlite module).
//
// Run:   node server.js
// Then:  open http://localhost:3000

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'scheme-matcher.db');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// DATABASE
// ---------------------------------------------------------------------------
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS schemes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_desc TEXT,
    ministry TEXT,
    level TEXT,
    domain TEXT,
    states TEXT DEFAULT '"All"',
    category TEXT DEFAULT '"All"',
    gender TEXT DEFAULT 'Any',
    min_age INTEGER,
    max_age INTEGER,
    income_max INTEGER,
    education TEXT DEFAULT '"Any"',
    occupation TEXT DEFAULT '"Any"',
    disability TEXT DEFAULT 'either',
    benefit_type TEXT,
    benefit TEXT,
    documents TEXT DEFAULT '[]',
    steps TEXT DEFAULT '[]',
    apply_url TEXT,
    source_url TEXT,
    last_verified TEXT,
    deadline TEXT DEFAULT 'Rolling',
    active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS admin_users (
    username TEXT PRIMARY KEY,
    salt TEXT NOT NULL,
    hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    message TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bookmarks (
    device_id TEXT NOT NULL,
    scheme_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (device_id, scheme_id)
  );
  CREATE TABLE IF NOT EXISTS secrets (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
  );
`);

// server secret used to sign auth tokens — generated once, persisted in DB
function getServerSecret() {
  const row = db.prepare('SELECT v FROM secrets WHERE k = ?').get('token_secret');
  if (row) return row.v;
  const secret = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO secrets (k, v) VALUES (?, ?)').run('token_secret', secret);
  return secret;
}
const SERVER_SECRET = getServerSecret();

// seed default admin user if none exists
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
if (!db.prepare('SELECT 1 FROM admin_users LIMIT 1').get()) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(DEFAULT_ADMIN_PASSWORD, salt);
  db.prepare('INSERT INTO admin_users (username, salt, hash) VALUES (?, ?, ?)').run('admin', salt, hash);
  console.log(`Seeded default admin user (username: admin, password: ${DEFAULT_ADMIN_PASSWORD})`);
}

// ---------------------------------------------------------------------------
// SEED SCHEME DATA (runs once — only if table is empty)
// ---------------------------------------------------------------------------
function mk(o) {
  const now = new Date().toISOString();
  return Object.assign({
    states: 'All', category: 'All', gender: 'Any', minAge: null, maxAge: null,
    incomeMax: null, education: 'Any', occupation: 'Any', disability: 'either',
    documents: [], steps: [], sourceUrl: '', lastVerified: 'Jul 2026', deadline: 'Rolling',
    active: 1, createdAt: now, updatedAt: now,
  }, o);
}

const SEED_SCHEMES = [
  mk({ id:'S001', name:"National Means-cum-Merit Scholarship (NMMS)", shortDesc:"Merit scholarship for economically weaker students to prevent drop-out at Class 9.", ministry:"Ministry of Education", level:"Central", domain:"education", category:"All", incomeMax:150000, education:["School"], minAge:13, maxAge:16, benefitType:"Scholarship", benefit:"₹12,000/year", applyUrl:"https://scholarships.gov.in", documents:["Income certificate","Caste certificate (if applicable)","Previous marksheet","Aadhaar","Bank passbook"], steps:["Register on National Scholarship Portal","Fill application with school details","Upload documents","Submit before deadline","Track status on NSP dashboard"], sourceUrl:"scholarships.gov.in", deadline:"31 Oct 2026" }),
  mk({ id:'S002', name:"Post-Matric Scholarship for SC Students", shortDesc:"Central assistance for Scheduled Caste students studying post-Class 10.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["SC"], incomeMax:250000, education:["UG","PG","Diploma","ITI","PhD"], benefitType:"Scholarship", benefit:"Tuition fee + maintenance allowance", applyUrl:"https://scholarships.gov.in", documents:["Caste certificate","Income certificate","Fee receipt","Bank passbook","Aadhaar"], steps:["Apply via NSP after institute verification","Institute forwards to district office","State releases scholarship in phases"], sourceUrl:"scholarships.gov.in", deadline:"15 Nov 2026" }),
  mk({ id:'S003', name:"Post-Matric Scholarship for OBC Students", shortDesc:"Tuition and maintenance support for OBC students in higher education.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["OBC"], incomeMax:100000, education:["UG","PG","Diploma","ITI"], benefitType:"Scholarship", benefit:"Tuition fee + maintenance allowance", applyUrl:"https://scholarships.gov.in", documents:["OBC certificate (non-creamy layer)","Income certificate","Fee receipt","Aadhaar"], steps:["Register on NSP","Institute verifies application","Amount disbursed to bank account"], sourceUrl:"scholarships.gov.in", deadline:"15 Nov 2026" }),
  mk({ id:'S004', name:"Pre-Matric Scholarship for Minorities", shortDesc:"Support for minority community students in Classes 1–10.", ministry:"Ministry of Minority Affairs", level:"Central", domain:"education", category:["Minority"], incomeMax:100000, education:["School"], benefitType:"Scholarship", benefit:"Up to ₹5,000/year", applyUrl:"https://scholarships.gov.in", documents:["Minority community certificate","Income certificate","School bonafide certificate"], steps:["Apply through school/NSP","School verifies enrolment","State releases funds"], sourceUrl:"scholarships.gov.in", deadline:"30 Nov 2026" }),
  mk({ id:'S005', name:"PM YASASVI Scholarship", shortDesc:"Merit-based scholarship for OBC, EBC and DNT students in Classes 9–12.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["OBC"], incomeMax:250000, education:["School"], minAge:13, maxAge:18, benefitType:"Scholarship", benefit:"Up to ₹1,25,000/year (hostel)", applyUrl:"https://yet.nta.ac.in", documents:["Category certificate","Income certificate","Entrance test admit card"], steps:["Register for YASASVI Entrance Test (YET)","Appear for test","Merit list decides award"], sourceUrl:"yet.nta.ac.in", deadline:"20 Sep 2026" }),
  mk({ id:'S006', name:"Central Sector Scheme of Scholarship (College/University)", shortDesc:"Merit scholarship for top-performing Class 12 students entering UG courses.", ministry:"Ministry of Education", level:"Central", domain:"education", category:"All", incomeMax:800000, education:["UG"], benefitType:"Scholarship", benefit:"₹10,000–₹20,000/year", applyUrl:"https://scholarships.gov.in", documents:["Class 12 marksheet","Income certificate","Bank passbook","Aadhaar"], steps:["Apply on NSP with Class 12 marks","College verification","Renewal each year on performance"], sourceUrl:"scholarships.gov.in", deadline:"31 Oct 2026" }),
  mk({ id:'S007', name:"Top Class Education Scheme for SC Students", shortDesc:"Full fee support for SC students admitted to India's top-tier institutions.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["SC"], incomeMax:800000, education:["UG","PG"], benefitType:"Scholarship", benefit:"Full tuition + living allowance", applyUrl:"https://scholarships.gov.in", documents:["Caste certificate","Income certificate","Admission letter from notified institute"], steps:["Get admission to a listed premier institute","Apply on NSP","Institute confirms enrolment"], sourceUrl:"scholarships.gov.in", deadline:"31 Dec 2026" }),
  mk({ id:'S008', name:"National Fellowship for OBC Students", shortDesc:"Fellowship supporting OBC scholars pursuing M.Phil/PhD.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["OBC"], education:["PhD"], benefitType:"Fellowship", benefit:"Monthly fellowship + contingency grant", applyUrl:"https://scholarships.gov.in", documents:["OBC certificate","Research enrolment proof","Income certificate"], steps:["Apply via NSP during enrolment window","University verifies research status","Monthly disbursal begins"], sourceUrl:"scholarships.gov.in", deadline:"Rolling" }),
  mk({ id:'S009', name:"AICTE Pragati Scholarship for Girls", shortDesc:"Scholarship for girl students in technical diploma/degree programmes.", ministry:"AICTE / Ministry of Education", level:"Central", domain:"education", category:"All", gender:"Female", incomeMax:800000, education:["UG","Diploma"], benefitType:"Scholarship", benefit:"₹50,000/year", applyUrl:"https://aicte-india.org", documents:["Admission proof in AICTE-approved institute","Income certificate","Aadhaar"], steps:["Apply on AICTE Pragati portal","Institute verification","Two girls per institute per branch selected"], sourceUrl:"aicte-india.org", deadline:"31 Dec 2026" }),
  mk({ id:'S010', name:"AICTE Saksham Scholarship for Specially-Abled Students", shortDesc:"Technical education scholarship for students with 40%+ disability.", ministry:"AICTE / Ministry of Education", level:"Central", domain:"education", category:"All", education:["UG","Diploma"], disability:'true', benefitType:"Scholarship", benefit:"₹50,000/year", applyUrl:"https://aicte-india.org", documents:["Disability certificate (40%+)","Admission proof","Income certificate"], steps:["Apply on AICTE Saksham portal","Institute verification","Disbursal each semester"], sourceUrl:"aicte-india.org", deadline:"31 Dec 2026" }),
  mk({ id:'S011', name:"Sukanya Samriddhi Yojana", shortDesc:"Small savings scheme for the education and marriage expenses of a girl child.", ministry:"Ministry of Finance", level:"Central", domain:"women_child", category:"All", gender:"Female", maxAge:10, benefitType:"Savings scheme", benefit:"High fixed interest, tax-free maturity", applyUrl:"https://www.india.gov.in/sukanya-samriddhi-yojana", documents:["Birth certificate of girl child","Guardian's ID proof","Address proof"], steps:["Open account at post office or authorised bank","Deposit minimum ₹250/year","Account matures 21 years from opening"], sourceUrl:"india.gov.in", deadline:"Rolling" }),
  mk({ id:'S012', name:"Beti Bachao Beti Padhao", shortDesc:"National campaign and local grants promoting survival, protection and education of the girl child.", ministry:"Ministry of Women & Child Development", level:"Central", domain:"women_child", category:"All", gender:"Female", benefitType:"Scheme/awareness grant", benefit:"District-level programme support", applyUrl:"https://wcd.nic.in", documents:["As specified by district programme"], steps:["Contact local Anganwadi/district office for active local activities"], sourceUrl:"wcd.nic.in", deadline:"Rolling" }),
  mk({ id:'S013', name:"PM Kisan Samman Nidhi", shortDesc:"Direct income support of ₹6,000/year to landholding farmer families.", ministry:"Ministry of Agriculture", level:"Central", domain:"agriculture", category:"All", occupation:["Farmer"], benefitType:"Direct benefit transfer", benefit:"₹6,000/year in 3 instalments", applyUrl:"https://pmkisan.gov.in", documents:["Land records","Aadhaar","Bank account linked to Aadhaar"], steps:["Register on PM-KISAN portal or via CSC","Land record verification by state","Instalments credited directly"], sourceUrl:"pmkisan.gov.in", deadline:"Rolling" }),
  mk({ id:'S014', name:"PM Fasal Bima Yojana", shortDesc:"Crop insurance scheme covering yield loss from natural calamities.", ministry:"Ministry of Agriculture", level:"Central", domain:"agriculture", category:"All", occupation:["Farmer"], benefitType:"Insurance", benefit:"Sum insured based on crop & area", applyUrl:"https://pmfby.gov.in", documents:["Land record / tenancy proof","Bank passbook","Sowing certificate"], steps:["Enrol before the crop season cut-off via bank/CSC/portal","Premium auto-deducted for loanee farmers","Claim assessed via crop-cutting experiments"], sourceUrl:"pmfby.gov.in", deadline:"Season-bound" }),
  mk({ id:'S015', name:"Kisan Credit Card", shortDesc:"Short-term credit for farmers' crop, animal husbandry and fishery needs.", ministry:"Ministry of Agriculture", level:"Central", domain:"agriculture", category:"All", occupation:["Farmer"], benefitType:"Credit / loan", benefit:"Revolving credit at subsidised interest", applyUrl:"https://www.myscheme.gov.in", documents:["Land records","Identity & address proof","Passport photo"], steps:["Apply at any nationalised or rural bank","Land verification","Card issued with credit limit"], sourceUrl:"myscheme.gov.in", deadline:"Rolling" }),
  mk({ id:'S016', name:"Pradhan Mantri Awas Yojana (Urban)", shortDesc:"Interest subsidy and assistance for first-time homebuyers in EWS/LIG/MIG categories.", ministry:"Ministry of Housing & Urban Affairs", level:"Central", domain:"housing", category:"All", incomeMax:1800000, benefitType:"Subsidy", benefit:"Interest subsidy up to ₹2.67 lakh", applyUrl:"https://pmaymis.gov.in", documents:["Income proof","Aadhaar","Property/agreement documents","Bank statement"], steps:["Check eligibility on PMAY portal","Apply through lending bank or CSC","Subsidy credited to home loan account"], sourceUrl:"pmaymis.gov.in", deadline:"Rolling" }),
  mk({ id:'S017', name:"Pradhan Mantri Ujjwala Yojana", shortDesc:"Free LPG connection for women from low-income households.", ministry:"Ministry of Petroleum & Natural Gas", level:"Central", domain:"women_child", category:"All", gender:"Female", incomeMax:200000, benefitType:"Subsidy", benefit:"Free LPG connection + first refill", applyUrl:"https://pmuy.gov.in", documents:["BPL/income proof","Aadhaar","Bank passbook","Address proof"], steps:["Apply at nearest LPG distributor or online","Submit KYC documents","Connection released after verification"], sourceUrl:"pmuy.gov.in", deadline:"Rolling" }),
  mk({ id:'S018', name:"Ayushman Bharat PM-JAY", shortDesc:"Health cover of ₹5 lakh/family/year for secondary and tertiary hospitalisation.", ministry:"Ministry of Health & Family Welfare", level:"Central", domain:"health", category:"All", incomeMax:250000, benefitType:"Health insurance", benefit:"₹5,00,000/family/year cashless cover", applyUrl:"https://pmjay.gov.in", documents:["Aadhaar","Ration card / SECC verification","Family ID"], steps:["Check eligibility on PM-JAY portal or Ayushman App","Get Ayushman Card issued at CSC/hospital","Cashless treatment at empanelled hospitals"], sourceUrl:"pmjay.gov.in", deadline:"Rolling" }),
  mk({ id:'S019', name:"Atal Pension Yojana", shortDesc:"Guaranteed monthly pension scheme for unorganised sector workers.", ministry:"Ministry of Finance / PFRDA", level:"Central", domain:"pension", category:"All", minAge:18, maxAge:40, occupation:["Unorganised worker","Self-employed"], benefitType:"Pension", benefit:"₹1,000–₹5,000/month after age 60", applyUrl:"https://npscra.nsdl.co.in", documents:["Aadhaar","Bank account","Mobile number"], steps:["Approach your bank or use net-banking APY option","Choose pension slab","Auto-debit contributions begin"], sourceUrl:"npscra.nsdl.co.in", deadline:"Rolling" }),
  mk({ id:'S020', name:"Indira Gandhi National Old Age Pension Scheme", shortDesc:"Monthly pension for senior citizens below the poverty line.", ministry:"Ministry of Rural Development", level:"Central", domain:"pension", category:"All", minAge:60, incomeMax:100000, benefitType:"Pension", benefit:"₹200–₹500+/month (state top-up varies)", applyUrl:"https://www.myscheme.gov.in", documents:["Age proof","BPL certificate","Bank passbook","Aadhaar"], steps:["Apply at Gram Panchayat / municipal office","Verification by local social welfare officer","Pension credited monthly"], sourceUrl:"myscheme.gov.in", deadline:"Rolling" }),
  mk({ id:'S021', name:"Indira Gandhi National Widow Pension Scheme", shortDesc:"Monthly pension support for BPL widows.", ministry:"Ministry of Rural Development", level:"Central", domain:"pension", category:"All", gender:"Female", minAge:40, maxAge:79, incomeMax:100000, benefitType:"Pension", benefit:"₹300+/month (state top-up varies)", applyUrl:"https://www.myscheme.gov.in", documents:["Husband's death certificate","BPL certificate","Age proof","Bank passbook"], steps:["Apply at Gram Panchayat / municipal office","Document verification","Pension credited monthly"], sourceUrl:"myscheme.gov.in", deadline:"Rolling" }),
  mk({ id:'S022', name:"Indira Gandhi National Disability Pension Scheme", shortDesc:"Monthly pension for BPL persons with 80%+ disability.", ministry:"Ministry of Rural Development", level:"Central", domain:"disability", category:"All", minAge:18, maxAge:79, incomeMax:100000, disability:'true', benefitType:"Pension", benefit:"₹300+/month (state top-up varies)", applyUrl:"https://www.myscheme.gov.in", documents:["Disability certificate (80%+)","BPL certificate","Age proof"], steps:["Apply at Gram Panchayat / municipal office","Medical board verification if required","Pension credited monthly"], sourceUrl:"myscheme.gov.in", deadline:"Rolling" }),
  mk({ id:'S023', name:"PM Employment Generation Programme (PMEGP)", shortDesc:"Credit-linked subsidy to set up new micro-enterprises and generate self-employment.", ministry:"Ministry of MSME", level:"Central", domain:"business", category:"All", minAge:18, education:["School","UG","PG","ITI","Diploma"], benefitType:"Subsidy + loan", benefit:"15–35% subsidy on project cost", applyUrl:"https://www.kviconline.gov.in/pmegpeportal", documents:["Project report","Identity & address proof","Educational certificate (min Class 8)"], steps:["Register on PMEGP e-portal","Submit project proposal","Bank sanctions loan; subsidy released after verification"], sourceUrl:"kviconline.gov.in", deadline:"Rolling" }),
  mk({ id:'S024', name:"Stand-Up India Scheme", shortDesc:"Bank loans of ₹10 lakh–₹1 crore for SC/ST and women entrepreneurs setting up a new enterprise.", ministry:"Ministry of Finance", level:"Central", domain:"business", category:["SC","ST"], minAge:18, benefitType:"Loan", benefit:"₹10 lakh – ₹1 crore", applyUrl:"https://standupmitra.in", documents:["Business plan","Identity & address proof","Category certificate (if applicable)"], steps:["Register on Stand-Up Mitra portal","Connect with nearest branch","Loan sanctioned after appraisal"], sourceUrl:"standupmitra.in", deadline:"Rolling" }),
  mk({ id:'S025', name:"Pradhan Mantri Mudra Yojana", shortDesc:"Collateral-free micro-loans up to ₹10 lakh for non-farm small businesses.", ministry:"Ministry of Finance", level:"Central", domain:"business", category:"All", minAge:18, benefitType:"Loan", benefit:"Up to ₹10 lakh (Shishu/Kishor/Tarun slabs)", applyUrl:"https://www.mudra.org.in", documents:["Business plan","Identity & address proof","Bank statements (if existing business)"], steps:["Approach any bank/NBFC/MFI","Submit Mudra loan application","Loan disbursed after appraisal, no collateral needed"], sourceUrl:"mudra.org.in", deadline:"Rolling" }),
  mk({ id:'S026', name:"Deen Dayal Upadhyaya Grameen Kaushalya Yojana (DDU-GKY)", shortDesc:"Free skill training and placement support for rural youth.", ministry:"Ministry of Rural Development", level:"Central", domain:"employment", category:"All", minAge:15, maxAge:35, occupation:["Unemployed","Student"], benefitType:"Skill training", benefit:"Free training, boarding, placement assistance", applyUrl:"https://ddugky.gov.in", documents:["Aadhaar","Address proof (rural)","Educational certificates"], steps:["Register at nearest Project Implementing Agency","Enrol in relevant trade","Complete training and get placement support"], sourceUrl:"ddugky.gov.in", deadline:"Rolling" }),
  mk({ id:'S027', name:"NHFDC Concessional Loan Scheme", shortDesc:"Low-interest loans for persons with disabilities to start self-employment ventures.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"disability", category:"All", disability:'true', minAge:18, benefitType:"Loan", benefit:"Concessional interest, up to ₹25 lakh", applyUrl:"https://nhfdc.nic.in", documents:["Disability certificate","Project report","Identity & address proof"], steps:["Apply through State Channelising Agency","Project appraisal","Loan disbursed in instalments"], sourceUrl:"nhfdc.nic.in", deadline:"Rolling" }),
  mk({ id:'S028', name:"Working Women Hostel Scheme", shortDesc:"Safe, affordable hostel accommodation for working women and trainees in cities.", ministry:"Ministry of Women & Child Development", level:"Central", domain:"women_child", category:"All", gender:"Female", occupation:["Employed","Student"], benefitType:"Accommodation subsidy", benefit:"Subsidised hostel accommodation", applyUrl:"https://wcd.nic.in", documents:["Employment/training proof","Identity proof","Passport photo"], steps:["Check nearby empanelled hostel run under the scheme","Apply directly to hostel management","Admission subject to availability"], sourceUrl:"wcd.nic.in", deadline:"Rolling" }),
  mk({ id:'S029', name:"One Stop Centre Scheme (Sakhi)", shortDesc:"Integrated support — medical, legal, police, counselling and shelter — for women affected by violence.", ministry:"Ministry of Women & Child Development", level:"Central", domain:"women_child", category:"All", gender:"Female", benefitType:"Support services", benefit:"Free integrated support & temporary shelter", applyUrl:"https://wcd.nic.in", documents:["None required for emergency support; ID helpful if available"], steps:["Visit or call nearest One Stop Centre (dial 181)","Receive medical/legal/police assistance as needed","Follow-up counselling and shelter if required"], sourceUrl:"wcd.nic.in", deadline:"Rolling" }),
  mk({ id:'S030', name:"PM Vishwakarma Yojana", shortDesc:"Recognition, skilling, toolkit support and collateral-free loans for traditional artisans and craftspeople.", ministry:"Ministry of MSME", level:"Central", domain:"business", category:"All", minAge:18, occupation:["Artisan / Craftsperson"], benefitType:"Loan + toolkit grant", benefit:"₹15,000 toolkit + loans up to ₹3 lakh", applyUrl:"https://pmvishwakarma.gov.in", documents:["Aadhaar","Trade proof / self-declaration","Bank passbook"], steps:["Register at CSC under one of 18 trades","Complete skill verification","Receive toolkit grant, then apply for loan tranche"], sourceUrl:"pmvishwakarma.gov.in", deadline:"Rolling" }),
];

const insertStmt = db.prepare(`
  INSERT INTO schemes (id,name,short_desc,ministry,level,domain,states,category,gender,min_age,max_age,income_max,education,occupation,disability,benefit_type,benefit,documents,steps,apply_url,source_url,last_verified,deadline,active,created_at,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
const countRow = db.prepare('SELECT COUNT(*) as c FROM schemes').get();
if (countRow.c === 0) {
  for (const s of SEED_SCHEMES) {
    insertStmt.run(
      s.id, s.name, s.shortDesc, s.ministry, s.level, s.domain,
      JSON.stringify(s.states), JSON.stringify(s.category), s.gender,
      s.minAge, s.maxAge, s.incomeMax,
      JSON.stringify(s.education), JSON.stringify(s.occupation), s.disability,
      s.benefitType, s.benefit, JSON.stringify(s.documents), JSON.stringify(s.steps),
      s.applyUrl, s.sourceUrl, s.lastVerified, s.deadline, s.active, s.createdAt, s.updatedAt
    );
  }
  console.log(`Seeded ${SEED_SCHEMES.length} schemes into the database.`);
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function rowToScheme(r) {
  return {
    id: r.id, name: r.name, shortDesc: r.short_desc, ministry: r.ministry, level: r.level, domain: r.domain,
    states: JSON.parse(r.states), category: JSON.parse(r.category), gender: r.gender,
    minAge: r.min_age, maxAge: r.max_age, incomeMax: r.income_max,
    education: JSON.parse(r.education), occupation: JSON.parse(r.occupation), disability: r.disability,
    benefitType: r.benefit_type, benefit: r.benefit,
    documents: JSON.parse(r.documents), steps: JSON.parse(r.steps),
    applyUrl: r.apply_url, sourceUrl: r.source_url, lastVerified: r.last_verified, deadline: r.deadline,
    active: !!r.active, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function getAllSchemeRows() {
  return db.prepare('SELECT * FROM schemes ORDER BY name ASC').all().map(rowToScheme);
}
function getSchemeById(id) {
  const r = db.prepare('SELECT * FROM schemes WHERE id = ?').get(id);
  return r ? rowToScheme(r) : null;
}
function logAudit(message) {
  db.prepare('INSERT INTO audit_log (ts, message) VALUES (?, ?)').run(new Date().toISOString(), message);
}

const DOMAINS = [
  { id: 'education', en: 'Education & Scholarships', hi: 'शिक्षा व छात्रवृत्ति' },
  { id: 'agriculture', en: 'Agriculture', hi: 'कृषि' },
  { id: 'health', en: 'Health', hi: 'स्वास्थ्य' },
  { id: 'housing', en: 'Housing', hi: 'आवास' },
  { id: 'employment', en: 'Employment & Skills', hi: 'रोजगार व कौशल' },
  { id: 'women_child', en: 'Women & Child', hi: 'महिला व बाल विकास' },
  { id: 'business', en: 'Business & MSME', hi: 'व्यवसाय व MSME' },
  { id: 'pension', en: 'Pension & Social Security', hi: 'पेंशन व सामाजिक सुरक्षा' },
  { id: 'disability', en: 'Disability Support', hi: 'दिव्यांग सहायता' },
];
const STATES = ["All India","Andhra Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Gujarat","Haryana","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal"];

// ---- matching engine (mirrors the client-side logic, now authoritative on the server) ----
function computeMatch(scheme, a) {
  if (scheme.states !== 'All' && a.state && Array.isArray(scheme.states) && !scheme.states.includes(a.state)) return null;
  if (scheme.category !== 'All' && a.category && Array.isArray(scheme.category) && !scheme.category.includes(a.category)) return null;
  if (scheme.gender !== 'Any' && a.gender && scheme.gender !== a.gender) return null;
  if (a.age) {
    const age = parseInt(a.age, 10);
    if (scheme.minAge != null && age < scheme.minAge) return null;
    if (scheme.maxAge != null && age > scheme.maxAge) return null;
  }
  if (a.income !== undefined && a.income !== '' && a.income != null && scheme.incomeMax != null) {
    if (parseInt(a.income, 10) > scheme.incomeMax) return null;
  }
  if (scheme.disability === 'true' && a.disability !== 'yes') return null;

  let total = 0, matched = 0;
  const reasons = [];
  function bump(cond, label) { total++; if (cond) { matched++; reasons.push(label); } }

  if (scheme.education !== 'Any' && Array.isArray(scheme.education) && a.education) {
    bump(scheme.education.includes(a.education), 'Education level matched');
  }
  if (scheme.occupation !== 'Any' && Array.isArray(scheme.occupation) && a.occupation) {
    bump(scheme.occupation.includes(a.occupation), 'Occupation matched');
  }
  if (a.domain) {
    bump(scheme.domain === a.domain, 'Domain of interest matched');
  }
  if (scheme.category !== 'All' && a.category) reasons.unshift(`Category: ${a.category} ✓`);
  if (scheme.states !== 'All' && a.state) reasons.unshift(`State: ${a.state} ✓`);
  if (scheme.incomeMax != null && a.income) reasons.unshift('Within income ceiling ✓');
  if (scheme.gender !== 'Any' && a.gender) reasons.unshift(`Gender: ${a.gender} ✓`);
  if (scheme.disability === 'true' && a.disability === 'yes') reasons.unshift('Disability criterion ✓');

  const score = total === 0 ? 100 : Math.round((matched / total) * 100);
  return { score, reasons };
}

// ---- token auth (stateless HMAC-signed tokens, ~express-JWT-lite) ----
function base64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac('sha256', SERVER_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = base64url(crypto.createHmac('sha256', SERVER_SECRET).update(`${header}.${body}`).digest());
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}
function requireAdmin(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

// ---------------------------------------------------------------------------
// HTTP SERVER
// ---------------------------------------------------------------------------
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size > 2_000_000) req.destroy(); chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}
function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const full = path.join(PUBLIC_DIR, filePath);
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) {
      // SPA fallback to index.html for non-file routes
      if (!path.extname(filePath)) {
        return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(d2);
        });
      }
      res.writeHead(404); return res.end('Not found');
    }
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') { return sendJSON(res, 204, {}); }

  if (!pathname.startsWith('/api/')) {
    return serveStatic(req, res, pathname);
  }

  try {
    // ---- public reference data ----
    if (pathname === '/api/domains' && method === 'GET') return sendJSON(res, 200, DOMAINS);
    if (pathname === '/api/states' && method === 'GET') return sendJSON(res, 200, STATES);

    if (pathname === '/api/stats' && method === 'GET') {
      const all = getAllSchemeRows();
      return sendJSON(res, 200, {
        totalSchemes: all.filter(s => s.active).length,
        domains: DOMAINS.length,
        lastReviewed: 'Aug 2026',
      });
    }

    // ---- schemes: list / detail ----
    if (pathname === '/api/schemes' && method === 'GET') {
      const isAdmin = !!requireAdmin(req);
      let data = getAllSchemeRows();
      if (!isAdmin) {
        data = data.filter(s => s.active);
      }
      const domain = url.searchParams.get('domain');
      const q = (url.searchParams.get('q') || '').toLowerCase();
      if (domain) data = data.filter(s => s.domain === domain);
      if (q) data = data.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.shortDesc || '').toLowerCase().includes(q) ||
        (s.ministry || '').toLowerCase().includes(q)
      );
      return sendJSON(res, 200, data);
    }

    let m;
    if ((m = pathname.match(/^\/api\/schemes\/([^/]+)$/)) && method === 'GET') {
      const s = getSchemeById(m[1]);
      if (!s) return sendJSON(res, 404, { error: 'Scheme not found' });
      return sendJSON(res, 200, s);
    }

    // ---- matching engine ----
    if (pathname === '/api/match' && method === 'POST') {
      const body = await readBody(req);
      const answers = body.answers || {};
      const all = getAllSchemeRows().filter(s => s.active);
      const results = all.map(s => {
        const r = computeMatch(s, answers);
        return r ? Object.assign({}, s, { score: r.score, reasons: r.reasons }) : null;
      }).filter(Boolean);
      results.sort((a, b) => b.score - a.score);
      return sendJSON(res, 200, { count: results.length, results });
    }

    // ---- admin auth ----
    if (pathname === '/api/admin/login' && method === 'POST') {
      const body = await readBody(req);
      const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');
      if (!user) return sendJSON(res, 500, { error: 'No admin user configured' });
      const hash = hashPassword(body.password || '', user.salt);
      const ok = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.hash));
      if (!ok) return sendJSON(res, 401, { error: 'Incorrect password' });
      const token = signToken({ role: 'admin', sub: 'admin', exp: Date.now() + 1000 * 60 * 60 * 8 });
      logAudit('Admin signed in');
      return sendJSON(res, 200, { token });
    }

    // ---- admin: audit log ----
    if (pathname === '/api/admin/audit-log' && method === 'GET') {
      if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').all();
      return sendJSON(res, 200, rows);
    }

    // ---- admin: scheme CRUD ----
    if (pathname === '/api/schemes' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return sendJSON(res, 401, { error: 'Unauthorized' });
      const b = await readBody(req);
      if (!b.name) return sendJSON(res, 400, { error: 'Scheme name is required' });
      const id = 'S' + crypto.randomBytes(4).toString('hex').toUpperCase();
      const now = new Date().toISOString();
      insertStmt.run(
        id, b.name, b.shortDesc || '', b.ministry || 'Not specified', b.level || 'Central', b.domain || 'education',
        JSON.stringify(b.states || 'All'), JSON.stringify(b.category || 'All'), b.gender || 'Any',
        b.minAge ?? null, b.maxAge ?? null, b.incomeMax ?? null,
        JSON.stringify(b.education || 'Any'), JSON.stringify(b.occupation || 'Any'), b.disability || 'either',
        b.benefitType || '', b.benefit || '', JSON.stringify(b.documents || []), JSON.stringify(b.steps || []),
        b.applyUrl || 'https://www.myscheme.gov.in', b.sourceUrl || 'admin-added', b.lastVerified || now.slice(0,10),
        b.deadline || 'Rolling', 1, now, now
      );
      logAudit(`Added scheme "${b.name}" (${id})`);
      return sendJSON(res, 201, getSchemeById(id));
    }

    if ((m = pathname.match(/^\/api\/schemes\/([^/]+)$/)) && (method === 'PUT' || method === 'PATCH')) {
      const admin = requireAdmin(req);
      if (!admin) return sendJSON(res, 401, { error: 'Unauthorized' });
      const existing = getSchemeById(m[1]);
      if (!existing) return sendJSON(res, 404, { error: 'Scheme not found' });
      const b = await readBody(req);
      const merged = Object.assign({}, existing, b);
      const now = new Date().toISOString();
      db.prepare(`UPDATE schemes SET name=?, short_desc=?, ministry=?, level=?, domain=?, states=?, category=?, gender=?,
        min_age=?, max_age=?, income_max=?, education=?, occupation=?, disability=?, benefit_type=?, benefit=?,
        documents=?, steps=?, apply_url=?, source_url=?, last_verified=?, deadline=?, active=?, updated_at=? WHERE id=?`).run(
        merged.name, merged.shortDesc, merged.ministry, merged.level, merged.domain,
        JSON.stringify(merged.states), JSON.stringify(merged.category), merged.gender,
        merged.minAge, merged.maxAge, merged.incomeMax,
        JSON.stringify(merged.education), JSON.stringify(merged.occupation), merged.disability,
        merged.benefitType, merged.benefit, JSON.stringify(merged.documents), JSON.stringify(merged.steps),
        merged.applyUrl, merged.sourceUrl, merged.lastVerified, merged.deadline,
        merged.active ? 1 : 0, now, m[1]
      );
      logAudit(`Updated scheme "${merged.name}" (${m[1]})`);
      return sendJSON(res, 200, getSchemeById(m[1]));
    }

    if ((m = pathname.match(/^\/api\/schemes\/([^/]+)\/toggle$/)) && method === 'PATCH') {
      const admin = requireAdmin(req);
      if (!admin) return sendJSON(res, 401, { error: 'Unauthorized' });
      const existing = getSchemeById(m[1]);
      if (!existing) return sendJSON(res, 404, { error: 'Scheme not found' });
      const newActive = existing.active ? 0 : 1;
      db.prepare('UPDATE schemes SET active=?, updated_at=? WHERE id=?').run(newActive, new Date().toISOString(), m[1]);
      logAudit(`${newActive ? 'Reactivated' : 'Deactivated'} "${existing.name}" (${m[1]})`);
      return sendJSON(res, 200, getSchemeById(m[1]));
    }

    if ((m = pathname.match(/^\/api\/schemes\/([^/]+)$/)) && method === 'DELETE') {
      const admin = requireAdmin(req);
      if (!admin) return sendJSON(res, 401, { error: 'Unauthorized' });
      const existing = getSchemeById(m[1]);
      if (!existing) return sendJSON(res, 404, { error: 'Scheme not found' });
      db.prepare('DELETE FROM schemes WHERE id=?').run(m[1]);
      logAudit(`Deleted scheme "${existing.name}" (${m[1]})`);
      return sendJSON(res, 200, { deleted: true });
    }

    if (pathname === '/api/schemes/bulk' && method === 'POST') {
      const admin = requireAdmin(req);
      if (!admin) return sendJSON(res, 401, { error: 'Unauthorized' });
      const b = await readBody(req);
      const arr = Array.isArray(b) ? b : b.schemes;
      if (!Array.isArray(arr)) return sendJSON(res, 400, { error: 'Body must be a JSON array of schemes' });
      let count = 0;
      const now = new Date().toISOString();
      for (const item of arr) {
        if (!item.name) continue;
        const id = 'S' + crypto.randomBytes(4).toString('hex').toUpperCase();
        insertStmt.run(
          id, item.name, item.shortDesc || '', item.ministry || 'Imported', item.level || 'Central', item.domain || 'education',
          JSON.stringify(item.states || 'All'), JSON.stringify(item.category || 'All'), item.gender || 'Any',
          item.minAge ?? null, item.maxAge ?? null, item.incomeMax ?? null,
          JSON.stringify(item.education || 'Any'), JSON.stringify(item.occupation || 'Any'), item.disability || 'either',
          item.benefitType || '', item.benefit || '', JSON.stringify(item.documents || []), JSON.stringify(item.steps || []),
          item.applyUrl || 'https://www.myscheme.gov.in', item.sourceUrl || 'bulk-import', item.lastVerified || now.slice(0,10),
          item.deadline || 'Rolling', 1, now, now
        );
        count++;
      }
      logAudit(`Bulk-imported ${count} scheme(s)`);
      return sendJSON(res, 201, { imported: count });
    }

    // ---- bookmarks (device-scoped, no login required) ----
    if (pathname === '/api/bookmarks' && method === 'GET') {
      const deviceId = req.headers['x-device-id'];
      if (!deviceId) return sendJSON(res, 400, { error: 'Missing X-Device-Id header' });
      const rows = db.prepare('SELECT scheme_id FROM bookmarks WHERE device_id = ?').all(deviceId);
      return sendJSON(res, 200, rows.map(r => r.scheme_id));
    }
    if ((m = pathname.match(/^\/api\/bookmarks\/([^/]+)$/)) && method === 'POST') {
      const deviceId = req.headers['x-device-id'];
      if (!deviceId) return sendJSON(res, 400, { error: 'Missing X-Device-Id header' });
      const schemeId = m[1];
      const existing = db.prepare('SELECT 1 FROM bookmarks WHERE device_id=? AND scheme_id=?').get(deviceId, schemeId);
      if (existing) {
        db.prepare('DELETE FROM bookmarks WHERE device_id=? AND scheme_id=?').run(deviceId, schemeId);
        return sendJSON(res, 200, { bookmarked: false });
      } else {
        db.prepare('INSERT INTO bookmarks (device_id, scheme_id, created_at) VALUES (?,?,?)').run(deviceId, schemeId, new Date().toISOString());
        return sendJSON(res, 200, { bookmarked: true });
      }
    }

    return sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return sendJSON(res, 500, { error: err.message || 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Scheme Matcher backend running → http://localhost:${PORT}`);
});
