// Scheme Matcher — Production-Ready Backend API Server
// Zero external dependencies: uses only Node's built-in http, https, node:sqlite, node:crypto, node:fs, node:path.
// Requires Node.js v22.5+ (for the built-in node:sqlite module).

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// ---------------------------------------------------------------------------
// ENVIRONMENT CONFIGURATION
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'scheme-matcher.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// DATABASE INITIALIZATION & MIGRATIONS
// ---------------------------------------------------------------------------
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

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

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    picture TEXT,
    role TEXT DEFAULT 'student',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state TEXT,
    age INTEGER,
    gender TEXT,
    category TEXT,
    income INTEGER,
    disability TEXT,
    occupation TEXT,
    education TEXT,
    domain TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_bookmarks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheme_id TEXT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, scheme_id)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheme_id TEXT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Not Started',
    applied_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    status TEXT DEFAULT 'received',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks(user_id);
  CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);
  CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_schemes_domain ON schemes(domain);
  CREATE INDEX IF NOT EXISTS idx_schemes_active ON schemes(active);
`);

// ---------------------------------------------------------------------------
// SERVER SECRET & AUTH
// ---------------------------------------------------------------------------
function getServerSecret() {
  const row = db.prepare('SELECT v FROM secrets WHERE k = ?').get('token_secret');
  if (row) return row.v;
  const secret = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO secrets (k, v) VALUES (?, ?)').run('token_secret', secret);
  return secret;
}
const SERVER_SECRET = getServerSecret();

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

if (!db.prepare('SELECT 1 FROM admin_users LIMIT 1').get()) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(DEFAULT_ADMIN_PASSWORD, salt);
  db.prepare('INSERT INTO admin_users (username, salt, hash) VALUES (?, ?, ?)').run('admin', salt, hash);
  console.log(`[AUTH] Seeded default admin user (username: admin, password: ${DEFAULT_ADMIN_PASSWORD})`);
}

// ---------------------------------------------------------------------------
// SEED SCHEME DATA (Preserved from original dataset)
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
  mk({ id:'S001', name:"National Means-cum-Merit Scholarship (NMMS)", shortDesc:"Merit scholarship for economically weaker students to prevent drop-out at Class 9.", ministry:"Ministry of Education", level:"Central", domain:"education", category:"All", incomeMax:150000, education:["School"], minAge:13, maxAge:16, benefitType:"Scholarship", benefit:"₹12,000/year", applyUrl:"https://www.myscheme.gov.in/schemes/nmms", documents:["Income certificate","Caste certificate (if applicable)","Previous marksheet","Aadhaar","Bank passbook"], steps:["Register on National Scholarship Portal","Fill application with school details","Upload documents","Submit before deadline","Track status on NSP dashboard"], sourceUrl:"scholarships.gov.in", deadline:"31 Oct 2026" }),
  mk({ id:'S002', name:"Post-Matric Scholarship for SC Students", shortDesc:"Central assistance for Scheduled Caste students studying post-Class 10.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["SC"], incomeMax:250000, education:["UG","PG","Diploma","ITI","PhD"], benefitType:"Scholarship", benefit:"Tuition fee + maintenance allowance", applyUrl:"https://www.myscheme.gov.in/schemes/post-matric-scholarship-for-sc-students", documents:["Caste certificate","Income certificate","Fee receipt","Bank passbook","Aadhaar"], steps:["Apply via NSP after institute verification","Institute forwards to district office","State releases scholarship in phases"], sourceUrl:"scholarships.gov.in", deadline:"15 Nov 2026" }),
  mk({ id:'S003', name:"Post-Matric Scholarship for OBC Students", shortDesc:"Tuition and maintenance support for OBC students in higher education.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["OBC"], incomeMax:100000, education:["UG","PG","Diploma","ITI"], benefitType:"Scholarship", benefit:"Tuition fee + maintenance allowance", applyUrl:"https://www.myscheme.gov.in/schemes/pm-yasasvi-post-matric-scholarship-for-obc-ebc-and-dnt-students", documents:["OBC certificate (non-creamy layer)","Income certificate","Fee receipt","Aadhaar"], steps:["Register on NSP","Institute verifies application","Amount disbursed to bank account"], sourceUrl:"scholarships.gov.in", deadline:"15 Nov 2026" }),
  mk({ id:'S004', name:"Pre-Matric Scholarship for Minorities", shortDesc:"Support for minority community students in Classes 1–10.", ministry:"Ministry of Minority Affairs", level:"Central", domain:"education", category:["Minority"], incomeMax:100000, education:["School"], benefitType:"Scholarship", benefit:"Up to ₹5,000/year", applyUrl:"https://www.myscheme.gov.in/schemes/pre-matric-scholarship-scheme-for-minorities", documents:["Minority community certificate","Income certificate","School bonafide certificate"], steps:["Apply through school/NSP","School verifies enrolment","State releases funds"], sourceUrl:"scholarships.gov.in", deadline:"30 Nov 2026" }),
  mk({ id:'S005', name:"PM YASASVI Scholarship", shortDesc:"Merit-based scholarship for OBC, EBC and DNT students in Classes 9–12.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["OBC"], incomeMax:250000, education:["School"], minAge:13, maxAge:18, benefitType:"Scholarship", benefit:"Up to ₹1,25,000/year (hostel)", applyUrl:"https://www.myscheme.gov.in/schemes/pm-yasasvi-top-class-school-education-for-obc-ebc-and-dnt-students", documents:["Category certificate","Income certificate","Entrance test admit card"], steps:["Register for YASASVI Entrance Test (YET)","Appear for test","Merit list decides award"], sourceUrl:"yet.nta.ac.in", deadline:"20 Sep 2026" }),
  mk({ id:'S006', name:"Central Sector Scheme of Scholarship (College/University)", shortDesc:"Merit scholarship for top-performing Class 12 students entering UG courses.", ministry:"Ministry of Education", level:"Central", domain:"education", category:"All", incomeMax:800000, education:["UG"], benefitType:"Scholarship", benefit:"₹10,000–₹20,000/year", applyUrl:"https://www.myscheme.gov.in/schemes/pmusp-csss", documents:["Class 12 marksheet","Income certificate","Bank passbook","Aadhaar"], steps:["Apply on NSP with Class 12 marks","College verification","Renewal each year on performance"], sourceUrl:"scholarships.gov.in", deadline:"31 Oct 2026" }),
  mk({ id:'S007', name:"Top Class Education Scheme for SC Students", shortDesc:"Full fee support for SC students admitted to India's top-tier institutions.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["SC"], incomeMax:800000, education:["UG","PG"], benefitType:"Scholarship", benefit:"Full tuition + living allowance", applyUrl:"https://www.myscheme.gov.in/schemes/top-class-education-scheme-for-sc-students", documents:["Caste certificate","Income certificate","Admission letter from notified institute"], steps:["Get admission to a listed premier institute","Apply on NSP","Institute confirms enrolment"], sourceUrl:"scholarships.gov.in", deadline:"31 Dec 2026" }),
  mk({ id:'S008', name:"National Fellowship for OBC Students", shortDesc:"Fellowship supporting OBC scholars pursuing M.Phil/PhD.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"education", category:["OBC"], education:["PhD"], benefitType:"Fellowship", benefit:"Monthly fellowship + contingency grant", applyUrl:"https://www.myscheme.gov.in/schemes/nfobc", documents:["OBC certificate","Research enrolment proof","Income certificate"], steps:["Apply via NSP during enrolment window","University verifies research status","Monthly disbursal begins"], sourceUrl:"scholarships.gov.in", deadline:"Rolling" }),
  mk({ id:'S009', name:"AICTE Pragati Scholarship for Girls", shortDesc:"Scholarship for girl students in technical diploma/degree programmes.", ministry:"AICTE / Ministry of Education", level:"Central", domain:"education", category:"All", gender:"Female", incomeMax:800000, education:["UG","Diploma"], benefitType:"Scholarship", benefit:"₹50,000/year", applyUrl:"https://www.myscheme.gov.in/schemes/pragati-scholarship-scheme-for-girl-students-technical-degree", documents:["Admission proof in AICTE-approved institute","Income certificate","Aadhaar"], steps:["Apply on AICTE Pragati portal","Institute verification","Two girls per institute per branch selected"], sourceUrl:"aicte-india.org", deadline:"31 Dec 2026" }),
  mk({ id:'S010', name:"AICTE Saksham Scholarship for Specially-Abled Students", shortDesc:"Technical education scholarship for students with 40%+ disability.", ministry:"AICTE / Ministry of Education", level:"Central", domain:"education", category:"All", education:["UG","Diploma"], disability:'true', benefitType:"Scholarship", benefit:"₹50,000/year", applyUrl:"https://www.myscheme.gov.in/schemes/saksham-scholarship-scheme-for-specially-abled-student-technical-degree", documents:["Disability certificate (40%+)","Admission proof","Income certificate"], steps:["Apply on AICTE Saksham portal","Institute verification","Disbursal each semester"], sourceUrl:"aicte-india.org", deadline:"31 Dec 2026" }),
  mk({ id:'S011', name:"Sukanya Samriddhi Yojana", shortDesc:"Small savings scheme for the education and marriage expenses of a girl child.", ministry:"Ministry of Finance", level:"Central", domain:"women_child", category:"All", gender:"Female", maxAge:10, benefitType:"Savings scheme", benefit:"High fixed interest, tax-free maturity", applyUrl:"https://www.myscheme.gov.in/schemes/ssy", documents:["Birth certificate of girl child","Guardian's ID proof","Address proof"], steps:["Open account at post office or authorised bank","Deposit minimum ₹250/year","Account matures 21 years from opening"], sourceUrl:"india.gov.in", deadline:"Rolling" }),
  mk({ id:'S012', name:"Beti Bachao Beti Padhao", shortDesc:"National campaign and local grants promoting survival, protection and education of the girl child.", ministry:"Ministry of Women & Child Development", level:"Central", domain:"women_child", category:"All", gender:"Female", benefitType:"Scheme/awareness grant", benefit:"District-level programme support", applyUrl:"https://www.myscheme.gov.in/schemes/bbbp", documents:["As specified by district programme"], steps:["Contact local Anganwadi/district office for active local activities"], sourceUrl:"wcd.nic.in", deadline:"Rolling" }),
  mk({ id:'S013', name:"PM Kisan Samman Nidhi", shortDesc:"Direct income support of ₹6,000/year to landholding farmer families.", ministry:"Ministry of Agriculture", level:"Central", domain:"agriculture", category:"All", occupation:["Farmer"], benefitType:"Direct benefit transfer", benefit:"₹6,000/year in 3 instalments", applyUrl:"https://www.myscheme.gov.in/schemes/pm-kisan", documents:["Land records","Aadhaar","Bank account linked to Aadhaar"], steps:["Register on PM-KISAN portal or via CSC","Land record verification by state","Instalments credited directly"], sourceUrl:"pmkisan.gov.in", deadline:"Rolling" }),
  mk({ id:'S014', name:"PM Fasal Bima Yojana", shortDesc:"Crop insurance scheme covering yield loss from natural calamities.", ministry:"Ministry of Agriculture", level:"Central", domain:"agriculture", category:"All", occupation:["Farmer"], benefitType:"Insurance", benefit:"Sum insured based on crop & area", applyUrl:"https://www.myscheme.gov.in/schemes/pmfby", documents:["Land record / tenancy proof","Bank passbook","Sowing certificate"], steps:["Enrol before the crop season cut-off via bank/CSC/portal","Premium auto-deducted for loanee farmers","Claim assessed via crop-cutting experiments"], sourceUrl:"pmfby.gov.in", deadline:"Season-bound" }),
  mk({ id:'S015', name:"Kisan Credit Card", shortDesc:"Short-term credit for farmers' crop, animal husbandry and fishery needs.", ministry:"Ministry of Agriculture", level:"Central", domain:"agriculture", category:"All", occupation:["Farmer"], benefitType:"Credit / loan", benefit:"Revolving credit at subsidised interest", applyUrl:"https://www.myscheme.gov.in/schemes/kcc", documents:["Land records","Identity & address proof","Passport photo"], steps:["Apply at any nationalised or rural bank","Land verification","Card issued with credit limit"], sourceUrl:"myscheme.gov.in", deadline:"Rolling" }),
  mk({ id:'S016', name:"Pradhan Mantri Awas Yojana (Urban)", shortDesc:"Interest subsidy and assistance for first-time homebuyers in EWS/LIG/MIG categories.", ministry:"Ministry of Housing & Urban Affairs", level:"Central", domain:"housing", category:"All", incomeMax:1800000, benefitType:"Subsidy", benefit:"Interest subsidy up to ₹2.67 lakh", applyUrl:"https://www.myscheme.gov.in/schemes/pmayu", documents:["Income proof","Aadhaar","Property/agreement documents","Bank statement"], steps:["Check eligibility on PMAY portal","Apply through lending bank or CSC","Subsidy credited to home loan account"], sourceUrl:"pmaymis.gov.in", deadline:"Rolling" }),
  mk({ id:'S017', name:"Pradhan Mantri Ujjwala Yojana", shortDesc:"Free LPG connection for women from low-income households.", ministry:"Ministry of Petroleum & Natural Gas", level:"Central", domain:"women_child", category:"All", gender:"Female", incomeMax:200000, benefitType:"Subsidy", benefit:"Free LPG connection + first refill", applyUrl:"https://www.myscheme.gov.in/schemes/pmuy", documents:["BPL/income proof","Aadhaar","Bank passbook","Address proof"], steps:["Apply at nearest LPG distributor or online","Submit KYC documents","Connection released after verification"], sourceUrl:"pmuy.gov.in", deadline:"Rolling" }),
  mk({ id:'S018', name:"Ayushman Bharat PM-JAY", shortDesc:"Health cover of ₹5 lakh/family/year for secondary and tertiary hospitalisation.", ministry:"Ministry of Health & Family Welfare", level:"Central", domain:"health", category:"All", incomeMax:250000, benefitType:"Health insurance", benefit:"₹5,00,000/family/year cashless cover", applyUrl:"https://www.myscheme.gov.in/schemes/ab-pmjay", documents:["Aadhaar","Ration card / SECC verification","Family ID"], steps:["Check eligibility on PM-JAY portal or Ayushman App","Get Ayushman Card issued at CSC/hospital","Cashless treatment at empanelled hospitals"], sourceUrl:"pmjay.gov.in", deadline:"Rolling" }),
  mk({ id:'S019', name:"Atal Pension Yojana", shortDesc:"Guaranteed monthly pension scheme for unorganised sector workers.", ministry:"Ministry of Finance / PFRDA", level:"Central", domain:"pension", category:"All", minAge:18, maxAge:40, occupation:["Unorganised worker","Self-employed"], benefitType:"Pension", benefit:"₹1,000–₹5,000/month after age 60", applyUrl:"https://www.myscheme.gov.in/schemes/apy", documents:["Aadhaar","Bank account","Mobile number"], steps:["Approach your bank or use net-banking APY option","Choose pension slab","Auto-debit contributions begin"], sourceUrl:"npscra.nsdl.co.in", deadline:"Rolling" }),
  mk({ id:'S020', name:"Indira Gandhi National Old Age Pension Scheme", shortDesc:"Monthly pension for senior citizens below the poverty line.", ministry:"Ministry of Rural Development", level:"Central", domain:"pension", category:"All", minAge:60, incomeMax:100000, benefitType:"Pension", benefit:"₹200–₹500+/month (state top-up varies)", applyUrl:"https://www.myscheme.gov.in/schemes/ignoaps", documents:["Age proof","BPL certificate","Bank passbook","Aadhaar"], steps:["Apply at Gram Panchayat / municipal office","Verification by local social welfare officer","Pension credited monthly"], sourceUrl:"myscheme.gov.in", deadline:"Rolling" }),
  mk({ id:'S021', name:"Indira Gandhi National Widow Pension Scheme", shortDesc:"Monthly pension support for BPL widows.", ministry:"Ministry of Rural Development", level:"Central", domain:"pension", category:"All", gender:"Female", minAge:40, maxAge:79, incomeMax:100000, benefitType:"Pension", benefit:"₹300+/month (state top-up varies)", applyUrl:"https://www.myscheme.gov.in/schemes/ignwps", documents:["Husband's death certificate","BPL certificate","Age proof","Bank passbook"], steps:["Apply at Gram Panchayat / municipal office","Document verification","Pension credited monthly"], sourceUrl:"myscheme.gov.in", deadline:"Rolling" }),
  mk({ id:'S022', name:"Indira Gandhi National Disability Pension Scheme", shortDesc:"Monthly pension for BPL persons with 80%+ disability.", ministry:"Ministry of Rural Development", level:"Central", domain:"disability", category:"All", minAge:18, maxAge:79, incomeMax:100000, disability:'true', benefitType:"Pension", benefit:"₹300+/month (state top-up varies)", applyUrl:"https://www.myscheme.gov.in/schemes/igndps", documents:["Disability certificate (80%+)","BPL certificate","Age proof"], steps:["Apply at Gram Panchayat / municipal office","Medical board verification if required","Pension credited monthly"], sourceUrl:"myscheme.gov.in", deadline:"Rolling" }),
  mk({ id:'S023', name:"PM Employment Generation Programme (PMEGP)", shortDesc:"Credit-linked subsidy to set up new micro-enterprises and generate self-employment.", ministry:"Ministry of MSME", level:"Central", domain:"business", category:"All", minAge:18, education:["School","UG","PG","ITI","Diploma"], benefitType:"Subsidy + loan", benefit:"15–35% subsidy on project cost", applyUrl:"https://www.myscheme.gov.in/schemes/pmegp", documents:["Project report","Identity & address proof","Educational certificate (min Class 8)"], steps:["Register on PMEGP e-portal","Submit project proposal","Bank sanctions loan; subsidy released after verification"], sourceUrl:"kviconline.gov.in", deadline:"Rolling" }),
  mk({ id:'S024', name:"Stand-Up India Scheme", shortDesc:"Bank loans of ₹10 lakh–₹1 crore for SC/ST and women entrepreneurs setting up a new enterprise.", ministry:"Ministry of Finance", level:"Central", domain:"business", category:["SC","ST"], minAge:18, benefitType:"Loan", benefit:"₹10 lakh – ₹1 crore", applyUrl:"https://www.myscheme.gov.in/schemes/suis", documents:["Business plan","Identity & address proof","Category certificate (if applicable)"], steps:["Register on Stand-Up Mitra portal","Connect with nearest branch","Loan sanctioned after appraisal"], sourceUrl:"standupmitra.in", deadline:"Rolling" }),
  mk({ id:'S025', name:"Pradhan Mantri Mudra Yojana", shortDesc:"Collateral-free micro-loans up to ₹10 lakh for non-farm small businesses.", ministry:"Ministry of Finance", level:"Central", domain:"business", category:"All", minAge:18, benefitType:"Loan", benefit:"Up to ₹10 lakh (Shishu/Kishor/Tarun slabs)", applyUrl:"https://www.myscheme.gov.in/schemes/pmmy", documents:["Business plan","Identity & address proof","Bank statements (if existing business)"], steps:["Approach any bank/NBFC/MFI","Submit Mudra loan application","Loan disbursed after appraisal, no collateral needed"], sourceUrl:"mudra.org.in", deadline:"Rolling" }),
  mk({ id:'S026', name:"Deen Dayal Upadhyaya Grameen Kaushalya Yojana (DDU-GKY)", shortDesc:"Free skill training and placement support for rural youth.", ministry:"Ministry of Rural Development", level:"Central", domain:"employment", category:"All", minAge:15, maxAge:35, occupation:["Unemployed","Student"], benefitType:"Skill training", benefit:"Free training, boarding, placement assistance", applyUrl:"https://www.myscheme.gov.in/schemes/ddu-gky", documents:["Aadhaar","Address proof (rural)","Educational certificates"], steps:["Register at nearest Project Implementing Agency","Enrol in relevant trade","Complete training and get placement support"], sourceUrl:"ddugky.gov.in", deadline:"Rolling" }),
  mk({ id:'S027', name:"NHFDC Concessional Loan Scheme", shortDesc:"Low-interest loans for persons with disabilities to start self-employment ventures.", ministry:"Ministry of Social Justice & Empowerment", level:"Central", domain:"disability", category:"All", disability:'true', minAge:18, benefitType:"Loan", benefit:"Concessional interest, up to ₹25 lakh", applyUrl:"https://www.myscheme.gov.in/schemes/nhfdc-cls", documents:["Disability certificate","Project report","Identity & address proof"], steps:["Apply through State Channelising Agency","Project appraisal","Loan disbursed in instalments"], sourceUrl:"nhfdc.nic.in", deadline:"Rolling" }),
  mk({ id:'S028', name:"Working Women Hostel Scheme", shortDesc:"Safe, affordable hostel accommodation for working women and trainees in cities.", ministry:"Ministry of Women & Child Development", level:"Central", domain:"women_child", category:"All", gender:"Female", occupation:["Employed","Student"], benefitType:"Accommodation subsidy", benefit:"Subsidised hostel accommodation", applyUrl:"https://www.myscheme.gov.in/schemes/wwh", documents:["Employment/training proof","Identity proof","Passport photo"], steps:["Check nearby empanelled hostel run under the scheme","Apply directly to hostel management","Admission subject to availability"], sourceUrl:"wcd.nic.in", deadline:"Rolling" }),
  mk({ id:'S029', name:"One Stop Centre Scheme (Sakhi)", shortDesc:"Integrated support — medical, legal, police, counselling and shelter — for women affected by violence.", ministry:"Ministry of Women & Child Development", level:"Central", domain:"women_child", category:"All", gender:"Female", benefitType:"Support services", benefit:"Free integrated support & temporary shelter", applyUrl:"https://www.myscheme.gov.in/schemes/osc", documents:["None required for emergency support; ID helpful if available"], steps:["Visit or call nearest One Stop Centre (dial 181)","Receive medical/legal/police assistance as needed","Follow-up counselling and shelter if required"], sourceUrl:"wcd.nic.in", deadline:"Rolling" }),
  mk({ id:'S030', name:"PM Vishwakarma Yojana", shortDesc:"Recognition, skilling, toolkit support and collateral-free loans for traditional artisans and craftspeople.", ministry:"Ministry of MSME", level:"Central", domain:"business", category:"All", minAge:18, occupation:["Artisan / Craftsperson"], benefitType:"Loan + toolkit grant", benefit:"₹15,000 toolkit + loans up to ₹3 lakh", applyUrl:"https://www.myscheme.gov.in/schemes/pm-vishwakarma", documents:["Aadhaar","Trade proof / self-declaration","Bank passbook"], steps:["Register at CSC under one of 18 trades","Complete skill verification","Receive toolkit grant, then apply for loan tranche"], sourceUrl:"pmvishwakarma.gov.in", deadline:"Rolling" }),
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
  console.log(`[SEED] Seeded ${SEED_SCHEMES.length} schemes into the database.`);
}

// ---------------------------------------------------------------------------
// DATA HELPERS & REFERENCE CONSTANTS
// ---------------------------------------------------------------------------
function safeJSONParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); }
  catch (e) { return fallback; }
}

function rowToScheme(r) {
  return {
    id: r.id,
    name: r.name,
    shortDesc: r.short_desc,
    ministry: r.ministry,
    level: r.level,
    domain: r.domain,
    states: safeJSONParse(r.states, 'All'),
    category: safeJSONParse(r.category, 'All'),
    gender: r.gender,
    minAge: r.min_age,
    maxAge: r.max_age,
    incomeMax: r.income_max,
    education: safeJSONParse(r.education, 'Any'),
    occupation: safeJSONParse(r.occupation, 'Any'),
    disability: r.disability,
    benefitType: r.benefit_type,
    benefit: r.benefit,
    documents: safeJSONParse(r.documents, []),
    steps: safeJSONParse(r.steps, []),
    applyUrl: r.apply_url,
    sourceUrl: r.source_url,
    lastVerified: r.last_verified,
    deadline: r.deadline,
    active: !!r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
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

function createNotification(userId, title, message, type = 'info') {
  const id = 'N' + crypto.randomBytes(6).toString('hex');
  db.prepare('INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(id, userId, title, message, type, new Date().toISOString());
  return id;
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

const STATES = [
  "All India", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

// ---------------------------------------------------------------------------
// DETERMINISTIC MATCHING ENGINE
// ---------------------------------------------------------------------------
function computeMatch(scheme, a) {
  let earnedPoints = 0;
  let maxPoints = 0;
  const reasons = [];
  const missing = [];

  // 1. State Criteria (Weight: 20)
  maxPoints += 20;
  if (scheme.states === 'All' || scheme.states === '"All"' || (Array.isArray(scheme.states) && scheme.states.includes('All India'))) {
    earnedPoints += 20;
    reasons.push('Open to all Indian States & UTs');
  } else if (a.state && Array.isArray(scheme.states)) {
    if (scheme.states.includes(a.state)) {
      earnedPoints += 20;
      reasons.push(`State matches: Eligible for residents of ${a.state}`);
    } else {
      missing.push(`State restriction: Scheme is for ${scheme.states.join(', ')} (you selected ${a.state})`);
    }
  } else if (!a.state) {
    earnedPoints += 10;
    reasons.push('State requirement pending');
  } else {
    missing.push(`State restriction: Specific states only`);
  }

  // 2. Category Criteria (Weight: 25)
  maxPoints += 25;
  if (scheme.category === 'All' || scheme.category === '"All"' || (Array.isArray(scheme.category) && scheme.category.includes('All'))) {
    earnedPoints += 25;
    reasons.push('Open to all social categories (General, SC, ST, OBC, Minorities)');
  } else if (a.category && Array.isArray(scheme.category)) {
    if (scheme.category.includes(a.category)) {
      earnedPoints += 25;
      reasons.push(`Social category matched: Dedicated to ${a.category} category`);
    } else {
      missing.push(`Category requirement: Targeted to ${scheme.category.join(', ')} (you selected ${a.category})`);
    }
  } else if (!a.category) {
    earnedPoints += 12;
  } else {
    missing.push(`Category requirement: Specific category required`);
  }

  // 3. Gender Criteria (Weight: 15)
  maxPoints += 15;
  if (scheme.gender === 'Any') {
    earnedPoints += 15;
    reasons.push('No gender restrictions (Any gender eligible)');
  } else if (a.gender) {
    if (scheme.gender === a.gender) {
      earnedPoints += 15;
      reasons.push(`Gender requirement met: Targeted for ${a.gender} candidates`);
    } else {
      missing.push(`Gender restriction: Scheme is specifically reserved for ${scheme.gender} candidates`);
    }
  } else {
    earnedPoints += 8;
  }

  // 4. Age Window (Weight: 15)
  maxPoints += 15;
  if (scheme.minAge == null && scheme.maxAge == null) {
    earnedPoints += 15;
    reasons.push('No specific age barrier');
  } else if (a.age !== undefined && a.age !== '' && a.age !== null) {
    const age = parseInt(a.age, 10);
    const minOk = scheme.minAge == null || age >= scheme.minAge;
    const maxOk = scheme.maxAge == null || age <= scheme.maxAge;
    if (minOk && maxOk) {
      earnedPoints += 15;
      reasons.push(`Age eligibility verified: Age ${age} is within ${scheme.minAge || 0} to ${scheme.maxAge || 'no limit'} years`);
    } else if (!minOk) {
      missing.push(`Age below limit: Minimum age requirement is ${scheme.minAge} years (current age: ${age})`);
    } else {
      missing.push(`Age exceeds limit: Maximum age cutoff is ${scheme.maxAge} years (current age: ${age})`);
    }
  } else {
    earnedPoints += 7;
  }

  // 5. Income Ceiling (Weight: 15)
  maxPoints += 15;
  if (scheme.incomeMax == null) {
    earnedPoints += 15;
    reasons.push('No household income ceiling');
  } else if (a.income !== undefined && a.income !== '' && a.income !== null) {
    const income = parseInt(a.income, 10);
    if (income <= scheme.incomeMax) {
      earnedPoints += 15;
      reasons.push(`Within income ceiling: ₹${income.toLocaleString()} <= ₹${scheme.incomeMax.toLocaleString()}/year`);
    } else {
      missing.push(`Income ceiling exceeded: Limit is ₹${scheme.incomeMax.toLocaleString()}/year (entered ₹${income.toLocaleString()})`);
    }
  } else {
    earnedPoints += 7;
  }

  // 6. Disability Constraint (Weight: 10)
  maxPoints += 10;
  if (scheme.disability === 'true') {
    if (a.disability === 'yes') {
      earnedPoints += 10;
      reasons.push('Special quota: Meets 40%+ disability criteria');
    } else {
      missing.push('Scheme exclusively requires 40%+ disability certificate');
    }
  } else {
    earnedPoints += 10;
    if (a.disability === 'yes') {
      reasons.push('Open to specially-abled persons');
    }
  }

  // 7. Education Match (Weight: 10)
  maxPoints += 10;
  if (scheme.education === 'Any' || scheme.education === '"Any"') {
    earnedPoints += 10;
  } else if (a.education && Array.isArray(scheme.education)) {
    if (scheme.education.includes(a.education)) {
      earnedPoints += 10;
      reasons.push(`Education level matched: Accepted course level (${a.education})`);
    } else {
      missing.push(`Education level: Requires ${scheme.education.join(', ')} (you selected ${a.education})`);
    }
  } else {
    earnedPoints += 5;
  }

  // 8. Occupation Match (Weight: 10)
  maxPoints += 10;
  if (scheme.occupation === 'Any' || scheme.occupation === '"Any"') {
    earnedPoints += 10;
  } else if (a.occupation && Array.isArray(scheme.occupation)) {
    if (scheme.occupation.includes(a.occupation)) {
      earnedPoints += 10;
      reasons.push(`Occupation matched: Target occupation (${a.occupation})`);
    } else {
      missing.push(`Occupation requirement: Requires ${scheme.occupation.join(', ')}`);
    }
  } else {
    earnedPoints += 5;
  }

  // 9. Domain Alignment (Weight: 5 bonus)
  if (a.domain) {
    maxPoints += 5;
    if (scheme.domain === a.domain) {
      earnedPoints += 5;
      reasons.push(`Preferred domain matched: ${scheme.domain}`);
    }
  }

  const score = Math.min(100, Math.max(0, Math.round((earnedPoints / maxPoints) * 100)));
  const isFullyEligible = missing.length === 0;

  return {
    score,
    isFullyEligible,
    reasons,
    missing,
  };
}

// ---------------------------------------------------------------------------
// TOKEN AUTHENTICATION (HMAC-SHA256 JWT)
// ---------------------------------------------------------------------------
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac('sha256', SERVER_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const expected = base64url(crypto.createHmac('sha256', SERVER_SECRET).update(`${header}.${body}`).digest());
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getAuthUser(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  return verifyToken(token);
}

function requireAdmin(req) {
  const payload = getAuthUser(req);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

function requireUser(req) {
  const payload = getAuthUser(req);
  if (!payload || !payload.sub) return null;
  return payload;
}

// ---------------------------------------------------------------------------
// GOOGLE ID TOKEN VERIFICATION
// ---------------------------------------------------------------------------
function verifyGoogleIdTokenOnline(idToken) {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200 || parsed.error_description || parsed.error) {
            return reject(new Error(parsed.error_description || parsed.error || 'Google token validation failed'));
          }
          if (GOOGLE_CLIENT_ID && parsed.aud !== GOOGLE_CLIENT_ID) {
            return reject(new Error('Google Client ID mismatch'));
          }
          if (parsed.iss !== 'accounts.google.com' && parsed.iss !== 'https://accounts.google.com') {
            return reject(new Error('Invalid token issuer'));
          }
          if (parsed.email_verified !== 'true' && parsed.email_verified !== true) {
            return reject(new Error('Google email is not verified'));
          }
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// HTTP HELPERS & BODY PARSING
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

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
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 10_000_000) { // 10MB safety ceiling for base64 file payloads
        req.destroy();
        return reject(new Error('Payload too large'));
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const full = path.join(PUBLIC_DIR, filePath);
  if (!full.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(full, (err, data) => {
    if (err) {
      if (!path.extname(filePath)) {
        return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => {
          if (e2) {
            res.writeHead(404);
            return res.end('Not found');
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(d2);
        });
      }
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// AI ASSISTANT & VOICE GUIDANCE ENGINE
// ---------------------------------------------------------------------------
const AI_STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'in', 'on', 'at', 'to', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'from', 'up', 'down',
  'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don',
  'should', 'now', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your',
  'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they',
  'them', 'their', 'theirs', 'give', 'tell', 'show', 'find', 'help', 'please',
  'need', 'want', 'know', 'scheme', 'schemes', 'yojana', 'government', 'portal',
  'india', 'indian', 'apply', 'applying', 'avail', 'available', 'eligibility',
  'eligible', 'details', 'detail', 'information', 'info'
]);

function extractSearchTokens(str) {
  return (str || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !AI_STOP_WORDS.has(w));
}

function formatSchemeSummary(s) {
  return {
    id: s.id,
    name: s.name,
    ministry: s.ministry || '',
    domain: s.domain || 'general',
    benefit: s.benefit || '',
    benefitType: s.benefitType || 'Scheme',
    incomeMax: s.incomeMax || null,
    applyUrl: s.applyUrl || '',
    deadline: s.deadline || 'Rolling'
  };
}

function generateAIResponse(query) {
  const raw = (query || '').trim();
  const q = raw.toLowerCase();
  const allSchemes = getAllSchemeRows().filter(s => s.active);

  // 1. GREETINGS & INTRO
  if (!q || /^(hi|hello|hey|namaste|greetings|good\s+(morning|afternoon|evening)|who are you|kya haal hai|help me)/i.test(q)) {
    return {
      reply: `**Namaste! I am SchemeMitra**, your AI & Voice Assistant for Indian government welfare schemes and scholarships.\n\nHere is what I can do for you:\n- 🎯 **Find Scholarships**: Tell me your state, category, or course.\n- 🧭 **Guide You**: Say *\"Start guided tour\"* to explore all features.\n- 📂 **Documents**: Ask about required certificates for any scheme.\n- 🚀 **Quick Actions**: Say *\"Open tracker\"*, *\"Open vault\"*, or *\"Show services\"*.`,
      voiceText: "Namaste! I am SchemeMitra, your AI and Voice Guide. You can ask me to find scholarships, check welfare schemes for farmers or women, or say 'Start guided tour' to explore the portal.",
      action: null,
      schemes: [],
      chips: ["Start guided tour 🧭", "Find scholarships for me 🎓", "Schemes for Farmers 🌾", "Ayushman Bharat Health 🏥", "Business & MSME Loans 💼", "What documents for NSP? 📄"]
    };
  }

  // 2. GUIDED TOUR & WEBSITE OVERVIEW
  if (/(tour|guided tour|guide me|walkthrough|how to use|show me around|overview|help me navigate|navigate)/i.test(q)) {
    return {
      reply: `### 🧭 Welcome to the Interactive Portal Tour!\n\nHere are the 4 main tools to help you discover and track welfare benefits:\n\n1. **🎯 Eligibility Matcher**: Fill out your state, caste, education, and household income in the questionnaire to get ranked, explainable matches.\n2. **⚡ Services Hub**: Access the top navigation bar for your student suite.\n3. **📋 Application Tracker**: Monitor submission numbers, verification stages, and deadlines across NSP and state portals.\n4. **🔒 Document Vault**: Store your income certificate, caste certificate, Aadhaar, and marksheets securely in your browser.\n\n*Click below or say a command to jump directly into any section!*`,
      voiceText: "Welcome to Government Scheme Matcher! I can guide you through our portal. First, use our Eligibility Matcher to discover scholarships tailored to your profile. Second, check the Services menu for your Application Tracker and Document Vault. Where would you like to start?",
      action: "START_TOUR",
      schemes: [],
      chips: ["Scroll to Matching Form 🎯", "Open Services Menu ⚡", "Open Application Tracker 📋", "Open Document Vault 🔒"]
    };
  }

  // 3. NAVIGATIONAL COMMANDS & ACTIONS
  if (/(services menu|fancy services|open services|services dropdown)/i.test(q)) {
    return {
      reply: `✨ **Opening the Services Menu** for you right now!\n\nFrom here you can access:\n- 🎓 Scholarship Matcher\n- 📋 Application Tracker\n- 🔒 Document Vault\n- 🔔 Eligibility Alerts & Deadlines\n- 👤 Student Profile\n- ❤️ Support & Volunteering`,
      voiceText: "Opening the Services menu for you right now!",
      action: "OPEN_SERVICES",
      schemes: [],
      chips: ["Open Tracker 📋", "Open Document Vault 🔒", "Check Alerts 🔔"]
    };
  }

  if (/(track|tracker|application status|my applications|status of application|track status)/i.test(q)) {
    return {
      reply: `📋 **Opening Application Tracker**!\n\nMonitor your scholarship applications across NSP, State E-Kalyan, or AICTE. Add application reference numbers, track verification stages, and record personal notes.`,
      voiceText: "Opening your Application Tracker right now.",
      action: "OPEN_MODAL",
      target: "tracker-modal",
      schemes: [],
      chips: ["Open Document Vault 🔒", "Find scholarships for me 🎓", "Back to Home"]
    };
  }

  if (/(vault|document vault|upload documents?|my documents?|files?|certificates?|storage)/i.test(q)) {
    return {
      reply: `🔒 **Opening Secure Document Vault**!\n\nYou can upload and organize essential files like your **Income Certificate**, **Caste Certificate**, **Aadhaar Card**, and **Marksheets** (up to 5MB, PDF/PNG/JPG). Files stay securely stored on your device.`,
      voiceText: "Opening your secure Document Vault.",
      action: "OPEN_MODAL",
      target: "vault-modal",
      schemes: [],
      chips: ["What documents for NSP? 📄", "Open Tracker 📋", "Find scholarships 🎓"]
    };
  }

  if (/(alert|alerts|notification|notifications|closing date|renewal date)/i.test(q)) {
    return {
      reply: `🔔 **Opening Eligibility Alerts & Deadlines**!\n\nStay updated with critical renewal windows, closing deadlines, and state scholarship disbursement alerts.`,
      voiceText: "Opening your Eligibility Alerts and Deadlines.",
      action: "OPEN_MODAL",
      target: "notif-modal",
      schemes: [],
      chips: ["Open Services Menu ⚡", "Check Tracker 📋", "Scroll to Matcher 🎯"]
    };
  }

  if (/(profile|my profile|student profile|my account|edit details)/i.test(q)) {
    return {
      reply: `👤 **Opening Student Profile**!\n\nSave your demographic information, domicile state, academic level, and annual family income so your recommendations stay 100% accurate.`,
      voiceText: "Opening your Student Profile.",
      action: "OPEN_MODAL",
      target: "profile-modal",
      schemes: [],
      chips: ["Run Matcher 🎯", "Open Tracker 📋", "Close"]
    };
  }

  if (/(feedback|review|rating|suggest|contact team)/i.test(q)) {
    return {
      reply: `💬 **Opening Feedback Form**!\n\nYour feedback helps us support more students across India. Share your thoughts, report issues, or suggest new schemes!`,
      voiceText: "Opening the Feedback form.",
      action: "OPEN_MODAL",
      target: "feedback-modal",
      schemes: [],
      chips: ["Start guided tour 🧭", "Find scholarships 🎓"]
    };
  }

  if (/(run match|scroll to match|find match|matching form|eligibility finder|check eligible|find my schemes)/i.test(q)) {
    return {
      reply: `🎯 **Taking you to the Eligibility Matcher!**\n\nFill in your **State**, **Caste Category**, **Education Level**, and **Annual Family Income** in the form on the page, then click **'Search Matching Schemes'** for ranked recommendations.`,
      voiceText: "Scrolling you down to the Scholarship Eligibility Matcher form.",
      action: "SCROLL_TO_MATCH",
      schemes: [],
      chips: ["Scholarships for OBC 🎓", "Scholarships for SC/ST 🎓", "Scholarships for Girls 👩‍🎓", "What documents for NSP? 📄"]
    };
  }

  // 4. DOCUMENT ADVISORY (COMMON SCHOLARSHIPS / NSP)
  if (/(what documents?|document list|documents required|nsp documents?|certificate list|bonafide certificate|income certificate|caste certificate)/i.test(q)) {
    return {
      reply: `### 📄 Standard Documents Required for Indian Government Scholarships:\n\n1. **Aadhaar Card** (Linked with bank account for Direct Benefit Transfer / DBT)\n2. **Income Certificate** (Current financial year, issued by Revenue Department / Tehsildar)\n3. **Caste / Category Certificate** (For SC, ST, OBC non-creamy layer, or EWS)\n4. **Previous Academic Marksheet** (With minimum 50%–60% marks as prescribed)\n5. **Bank Passbook** (Active student savings account with IFSC code)\n6. **Bonafide Student Certificate** / College ID (From current enrolled school/institute)\n7. **Fee Receipt / Admission Letter** (For post-matric & technical degree schemes)\n\n*Tip: Store copies in your **Document Vault** for quick access when portals open!*`,
      voiceText: "For government scholarships, you typically need your Aadhaar card, current income certificate, caste certificate if applicable, previous academic marksheet, bank passbook, and bonafide student certificate from your institute.",
      action: null,
      schemes: [],
      chips: ["Open Document Vault 🔒", "Find scholarships for me 🎓", "Start guided tour 🧭"]
    };
  }

  // 5. WELFARE DOMAIN INTENTS
  // 5A. AGRICULTURE & FARMERS
  if (/\b(farm|farmer|farmers|farming|agriculture|crop|crops|kisan|krishi|mandis?|soil|harvest|landholding)\b/i.test(q)) {
    const agriSchemes = allSchemes.filter(s => s.domain === 'agriculture' || (Array.isArray(s.occupation) && s.occupation.includes('Farmer')));
    const top = agriSchemes.slice(0, 3);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 🌾 Schemes for Farmers & Agriculture:\n\n${list}\n\nKey Highlights:\n- **PM-KISAN**: Direct income support of ₹6,000/year in 3 tranches to landholding farmers.\n- **PM Fasal Bima Yojana**: Comprehensive crop insurance against natural calamities.\n- **Kisan Credit Card**: Concessional institutional credit for crop cultivation.\n\n*Explore detailed criteria or apply via official links below.*`,
      voiceText: `Found ${agriSchemes.length} schemes supporting farmers, including PM-KISAN, PM Fasal Bima Yojana, and Kisan Credit Card.`,
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["PM Kisan details 🌾", "Crop Insurance (PMFBY) 🛡️", "Kisan Credit Card 💳", "Scroll to Matcher 🎯"]
    };
  }

  // 5B. HEALTH & MEDICAL
  if (/\b(health|medical|hospital|hospitalisation|treatment|ayushman|pm-?jay|doctor|illness|healthcare|insurance)\b/i.test(q)) {
    const healthSchemes = allSchemes.filter(s => s.domain === 'health');
    const top = healthSchemes.slice(0, 3);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 🏥 Health & Medical Welfare Schemes:\n\n${list}\n\n- **Ayushman Bharat PM-JAY**: Provides cashless healthcare coverage up to ₹5 lakh per family per year for secondary and tertiary hospitalization across 28,000+ empanelled hospitals.\n- **Eligibility**: Low-income households identified through SECC and Ayushman card enrollment at nearest CSC.`,
      voiceText: "Ayushman Bharat PM-JAY offers cashless hospitalisation cover of up to five lakh rupees per family per year. You can check eligibility and register for an Ayushman card.",
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["Ayushman Bharat Link 🏥", "Required documents 📄", "Scroll to Matcher 🎯"]
    };
  }

  // 5C. HOUSING & SHELTER
  if (/\b(housing|house|home|awas|shelter|pucca house|pmayu|pmay|home loan subsidy)\b/i.test(q)) {
    const houseSchemes = allSchemes.filter(s => s.domain === 'housing');
    const top = houseSchemes.slice(0, 3);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 🏠 Housing & Shelter Schemes:\n\n${list}\n\n- **Pradhan Mantri Awas Yojana (Urban & Gramin)**: Provides interest subsidies up to ₹2.67 lakh for first-time home buyers in EWS/LIG/MIG categories.\n- **Eligibility**: Household must not own a pucca house in India; annual income limits apply per category.`,
      voiceText: "Pradhan Mantri Awas Yojana provides financial assistance and interest subsidies up to 2.67 lakh rupees for buying or constructing a pucca house.",
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["PMAY Urban details 🏠", "Required documents 📄", "Scroll to Matcher 🎯"]
    };
  }

  // 5D. WOMEN & CHILD WELFARE
  if (/\b(girl|girls|female|women|daughter|beti|mahila|widow|maternity|ujjwala|lpg|sukanya)\b/i.test(q)) {
    const womenSchemes = allSchemes.filter(s => s.gender === 'Female' || s.domain === 'women_child');
    const top = womenSchemes.slice(0, 4);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 👩‍🎓 Special Schemes for Girls & Women:\n\n${list}\n\nKey Initiatives:\n- **AICTE Pragati**: ₹50,000/year scholarship for female students entering technical diploma/degree programs.\n- **Sukanya Samriddhi Yojana**: High-yield, tax-free savings scheme for girl child education & future.\n- **PM Ujjwala Yojana**: Free LPG connection + first cylinder refill for eligible households.\n- **Working Women Hostels**: Safe, subsidized city accommodation for working women and trainees.`,
      voiceText: "We have dedicated welfare and scholarship schemes for girls and women, including AICTE Pragati, Sukanya Samriddhi Yojana, and PM Ujjwala Yojana.",
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["AICTE Pragati Scholarship 🎓", "Sukanya Samriddhi Yojana 💰", "PM Ujjwala Yojana 🔥", "Scroll to Matcher 🎯"]
    };
  }

  // 5E. BUSINESS, LOANS & ENTREPRENEURSHIP
  if (/\b(business|startup|startups|entrepreneur|entrepreneurs|enterprise|msme|mudra|loan|loans|pmegp|standup|vishwakarma|credit|artisan|craftsperson)\b/i.test(q)) {
    const bizSchemes = allSchemes.filter(s => s.domain === 'business' || (s.benefitType && s.benefitType.toLowerCase().includes('loan')));
    const top = bizSchemes.slice(0, 4);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 💼 Business, Loans & Self-Employment Schemes:\n\n${list}\n\nTop Financial Programs:\n- **PM Mudra Yojana**: Collateral-free micro-loans up to ₹10 lakh (Shishu, Kishor, and Tarun categories).\n- **PMEGP**: Credit-linked subsidy up to 35% for setting up new manufacturing or service units.\n- **Stand-Up India**: Bank loans from ₹10 lakh to ₹1 crore for SC/ST and women entrepreneurs.\n- **PM Vishwakarma**: ₹15,000 modern toolkit grant + subsidized 5% interest collateral-free loans for traditional artisans.`,
      voiceText: "Government business schemes include Pradhan Mantri Mudra Yojana, PMEGP, Stand-Up India, and PM Vishwakarma for artisans and entrepreneurs.",
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["Mudra Loan details 💳", "PMEGP Subsidy 🏭", "PM Vishwakarma Yojana 🛠️", "Scroll to Matcher 🎯"]
    };
  }

  // 5F. PENSIONS & SENIOR CITIZENS
  if (/\b(pension|pensions|old age|senior citizens?|elderly|atal|apy|retirement|ignoaps|ignwps)\b/i.test(q)) {
    const pensionSchemes = allSchemes.filter(s => s.domain === 'pension');
    const top = pensionSchemes.slice(0, 3);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 🪙 Pension & Social Security Schemes:\n\n${list}\n\n- **Atal Pension Yojana (APY)**: Guaranteed monthly pension of ₹1,000–₹5,000/month after age 60 for unorganized sector workers (join between 18–40 years).\n- **National Old Age Pension (IGNOAPS)**: Monthly pension assistance for senior citizens (60+ years) living below the poverty line.`,
      voiceText: "Government pension schemes include Atal Pension Yojana for unorganised sector workers, and Indira Gandhi National Old Age Pension for BPL senior citizens.",
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["Atal Pension Yojana 🪙", "Old Age Pension 👴", "Scroll to Matcher 🎯"]
    };
  }

  // 5G. DISABILITY / DIVYANGJAN
  if (/\b(disability|disabled|divyang|divyangjan|pwd|handicap|specially abled|udid)\b/i.test(q)) {
    const pwdSchemes = allSchemes.filter(s => s.disability === 'true' || s.domain === 'disability');
    const top = pwdSchemes.slice(0, 3);
    const list = top.map(s => `• **${s.name}**: ${s.benefit}`).join('\n');
    return {
      reply: `### ♿ Schemes for Specially-Abled Students & Citizens (Divyangjan):\n\n${list}\n\n- **AICTE Saksham**: ₹50,000/year technical education scholarship for students with 40%+ benchmark disability.\n- **NHFDC Concessional Loans**: Low-interest financial assistance up to ₹25 lakh for self-employment ventures.\n- **National Disability Pension**: Monthly pension for BPL individuals with severe disabilities.`,
      voiceText: "Found dedicated schemes for specially-abled students and individuals, including AICTE Saksham and NHFDC concessional loans.",
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["AICTE Saksham details ♿", "NHFDC Loan details 💼", "Open Document Vault 🔒"]
    };
  }

  // 5H. EMPLOYMENT & SKILL TRAINING
  if (/\b(employment|job|jobs|skill|skills|training|unemployed|placement|ddu-?gky|kaushalya)\b/i.test(q)) {
    const empSchemes = allSchemes.filter(s => s.domain === 'employment' || (Array.isArray(s.occupation) && s.occupation.includes('Unemployed')));
    const top = empSchemes.slice(0, 3);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 🛠️ Employment & Skill Training Schemes:\n\n${list}\n\n- **DDU-GKY (Deen Dayal Upadhyaya Grameen Kaushalya Yojana)**: Free residential skill development training with assured placement assistance for rural youth aged 15–35.`,
      voiceText: "Employment schemes include DDU-GKY, offering free skill training, boarding, and placement support for rural youth.",
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["DDU-GKY Training details 🛠️", "PMEGP Self-Employment 💼", "Scroll to Matcher 🎯"]
    };
  }

  // 6. DEMOGRAPHIC CATEGORY FILTERING (OBC, SC, ST, MINORITY)
  if (/\b(obc|other backward)\b/i.test(q)) {
    const obcSchemes = allSchemes.filter(s => Array.isArray(s.category) ? s.category.includes('OBC') : s.category === 'All');
    const top = obcSchemes.slice(0, 4);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (Income limit: ₹${(s.incomeMax||0).toLocaleString('en-IN')})`).join('\n');
    return {
      reply: `### 🎓 Top Schemes for OBC Students:\n\n${list}\n\n👉 *Need personalized matches? Use the Matcher form with OBC selected for exact eligibility calculation.*`,
      voiceText: `Found ${obcSchemes.length} schemes supporting OBC students, including Post-Matric Scholarship for OBC and PM YASASVI.`,
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["Scroll to Matcher 🎯", "Documents required 📄", "Open Services ⚡"]
    };
  }

  if (/\b(sc|st|scheduled caste|scheduled tribe)\b/i.test(q)) {
    const scSchemes = allSchemes.filter(s => Array.isArray(s.category) ? (s.category.includes('SC') || s.category.includes('ST')) : s.category === 'All');
    const top = scSchemes.slice(0, 4);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 🎓 Top Schemes for SC & ST Students:\n\n${list}\n\n👉 *Complete tuition assistance, living allowances, and entrepreneurship loans are available.*`,
      voiceText: `Found ${scSchemes.length} schemes for Scheduled Caste and Scheduled Tribe students, including Post-Matric SC and Top Class Education scheme.`,
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["Scroll to Matcher 🎯", "Open Document Vault 🔒", "What documents for NSP? 📄"]
    };
  }

  if (/\b(minority|minorities|muslim|christian|sikh|buddhist|jain|parsi)\b/i.test(q)) {
    const minSchemes = allSchemes.filter(s => Array.isArray(s.category) && s.category.includes('Minority'));
    const top = minSchemes.slice(0, 3);
    const list = top.map(s => `• **${s.name}**: ${s.benefit} (${s.ministry})`).join('\n');
    return {
      reply: `### 🎓 Scholarships for Minority Community Students:\n\n${list}\n\n- **Pre-Matric & Post-Matric Minority Schemes**: Financial assistance for school and college students belonging to notified minority communities with annual income under ₹1,00,000–₹2,00,000.`,
      voiceText: "Found dedicated scholarships for minority community students, including Pre-Matric and Post-Matric Minority scholarships.",
      action: null,
      schemes: top.map(formatSchemeSummary),
      chips: ["Scroll to Matcher 🎯", "What documents for NSP? 📄", "Open Document Vault 🔒"]
    };
  }

  // 7. SPECIFIC SCHEME LOOKUP (High-Precision Ranking)
  const queryTokens = extractSearchTokens(q);
  const ACRONYM_MAP = {
    'nmms': 'S001',
    'sc': 'S002',
    'yasasvi': 'S005',
    'csss': 'S006',
    'pragati': 'S009',
    'saksham': 'S010',
    'sukanya': 'S011',
    'ssy': 'S011',
    'beti bachao': 'S012',
    'bbbp': 'S012',
    'pm kisan': 'S013',
    'pm-kisan': 'S013',
    'kisan': 'S013',
    'fasal bima': 'S014',
    'pmfby': 'S014',
    'kcc': 'S015',
    'kisan credit': 'S015',
    'pmay': 'S016',
    'awas yojana': 'S016',
    'ujjwala': 'S017',
    'pmuy': 'S017',
    'ayushman': 'S018',
    'pmjay': 'S018',
    'pm-jay': 'S018',
    'atal pension': 'S019',
    'apy': 'S019',
    'pmegp': 'S023',
    'stand up': 'S024',
    'standup': 'S024',
    'mudra': 'S025',
    'ddu gky': 'S026',
    'ddu-gky': 'S026',
    'nhfdc': 'S027',
    'vishwakarma': 'S030'
  };

  // Direct ID or Acronym Lookup
  let matchedScheme = null;
  for (const [phrase, schemeId] of Object.entries(ACRONYM_MAP)) {
    if (q.includes(phrase)) {
      matchedScheme = allSchemes.find(s => s.id === schemeId);
      if (matchedScheme) break;
    }
  }

  // Token Overlap Scoring if no direct acronym matched
  if (!matchedScheme && queryTokens.length > 0) {
    let bestScore = 0;
    for (const s of allSchemes) {
      const nameTokens = (s.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
      const descTokens = (s.shortDesc || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
      let score = 0;
      for (const t of queryTokens) {
        if (nameTokens.includes(t)) score += 4;
        else if (nameTokens.some(nt => nt.includes(t))) score += 2;
        if (descTokens.includes(t)) score += 1;
      }
      if (score > bestScore && score >= 4) {
        bestScore = score;
        matchedScheme = s;
      }
    }
  }

  if (matchedScheme) {
    const docList = Array.isArray(matchedScheme.documents) && matchedScheme.documents.length > 0
      ? matchedScheme.documents.join(', ')
      : 'Standard KYC proofs & academic marksheets';
    const stepsList = Array.isArray(matchedScheme.steps) && matchedScheme.steps.length > 0
      ? matchedScheme.steps.map((st, i) => `${i+1}. ${st}`).join('\n')
      : 'Apply online via the official portal.';
    return {
      reply: `### 📌 **${matchedScheme.name}**\n\n- **Authority / Ministry**: ${matchedScheme.ministry}\n- **Benefit**: ${matchedScheme.benefit || 'Financial Support'}\n- **Annual Income Limit**: ${matchedScheme.incomeMax ? '₹' + matchedScheme.incomeMax.toLocaleString('en-IN') : 'No upper ceiling'}\n- **Application Deadline**: ${matchedScheme.deadline || 'Rolling'}\n- **Required Documents**: ${docList}\n\n**Application Steps:**\n${stepsList}\n\n🔗 [Official Portal Link](${matchedScheme.applyUrl})`,
      voiceText: `${matchedScheme.name} is offered by the ${matchedScheme.ministry}. It provides ${matchedScheme.benefit}. You can apply through the official portal.`,
      action: null,
      schemes: [formatSchemeSummary(matchedScheme)],
      chips: ["Open Application Tracker 📋", "Save documents in Vault 🔒", "Find more schemes 🎓", "What documents for NSP? 📄"]
    };
  }

  // 8. DEFAULT INTELLIGENT ADVICE
  return {
    reply: `I can help you navigate **Indian government welfare schemes and scholarships**!\n\nHere are some questions you can ask me:\n- 🎯 *"What scholarships are available for college students?"*\n- 🌾 *"What schemes exist for farmers?"*\n- 🏥 *"Tell me about Ayushman Bharat health cover"*\n- 💼 *"What loan subsidies are available for small businesses?"*\n- 📄 *"What documents are needed for NSP?"*\n- 🧭 *"Start guided tour of this portal"*`,
    voiceText: "I am here to guide you with Indian scholarships and welfare schemes. You can ask for scholarships by category, farming benefits, business loans, or say 'Start guided tour'.",
    action: null,
    schemes: [],
    chips: ["Start guided tour 🧭", "Find scholarships for me 🎓", "Schemes for Farmers 🌾", "Business & Loans 💼", "What documents for NSP? 📄"]
  };
}

// ---------------------------------------------------------------------------
// SERVER ROUTER
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') return sendJSON(res, 204, {});

  if (!pathname.startsWith('/api/')) {
    return serveStatic(req, res, pathname);
  }

  try {
    let m;

    // -------------------------------------------------------------------------
    // PUBLIC CONFIG & REFERENCE DATA
    // -------------------------------------------------------------------------
    if (pathname === '/api/config' && method === 'GET') {
      return sendJSON(res, 200, {
        googleClientId: GOOGLE_CLIENT_ID,
        hasGoogleAuth: !!GOOGLE_CLIENT_ID,
        nodeVersion: process.version,
      });
    }

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

    // AI Assistant & Voice Guidance Endpoint
    if (pathname === '/api/ai-chat' && method === 'POST') {
      const b = await readBody(req);
      const query = (b.message || '').trim();
      const reply = generateAIResponse(query);
      return sendJSON(res, 200, reply);
    }

    // -------------------------------------------------------------------------
    // SCHEMES: LIST / DETAIL
    // -------------------------------------------------------------------------
    if (pathname === '/api/schemes' && method === 'GET') {
      const isAdmin = !!requireAdmin(req);
      let data = getAllSchemeRows();
      if (!isAdmin) {
        data = data.filter(s => s.active);
      }
      const domain = url.searchParams.get('domain');
      const q = (url.searchParams.get('q') || '').toLowerCase();
      if (domain) data = data.filter(s => s.domain === domain);
      if (q) {
        data = data.filter(s =>
          s.name.toLowerCase().includes(q) ||
          (s.shortDesc || '').toLowerCase().includes(q) ||
          (s.ministry || '').toLowerCase().includes(q)
        );
      }
      return sendJSON(res, 200, data);
    }

    if ((m = pathname.match(/^\/api\/schemes\/([^/]+)$/)) && method === 'GET') {
      const s = getSchemeById(m[1]);
      if (!s) return sendJSON(res, 404, { error: 'Scheme not found' });
      return sendJSON(res, 200, s);
    }

    // -------------------------------------------------------------------------
    // MATCHING ENGINE
    // -------------------------------------------------------------------------
    if (pathname === '/api/match' && method === 'POST') {
      const body = await readBody(req);
      const answers = body.answers || {};
      const all = getAllSchemeRows().filter(s => s.active);

      const results = all.map(s => {
        const match = computeMatch(s, answers);
        return Object.assign({}, s, {
          score: match.score,
          isFullyEligible: match.isFullyEligible,
          reasons: match.reasons,
          missing: match.missing,
        });
      }).filter(r => r.score >= 40); // Exclude irrelevancies below 40%

      results.sort((a, b) => {
        if (b.isFullyEligible !== a.isFullyEligible) {
          return b.isFullyEligible ? 1 : -1;
        }
        return b.score - a.score;
      });

      return sendJSON(res, 200, {
        count: results.length,
        eligibleCount: results.filter(r => r.isFullyEligible).length,
        results,
      });
    }

    // -------------------------------------------------------------------------
    // AUTHENTICATION: GOOGLE & LOCAL DEV
    // -------------------------------------------------------------------------
    if (pathname === '/api/auth/google' && method === 'POST') {
      const body = await readBody(req);
      const idToken = body.credential || body.idToken;
      if (!idToken) return sendJSON(res, 400, { error: 'Missing credential / ID token' });

      let payload;
      try {
        payload = await verifyGoogleIdTokenOnline(idToken);
      } catch (err) {
        return sendJSON(res, 401, { error: `Google verification failed: ${err.message}` });
      }

      const googleId = payload.sub;
      const email = payload.email;
      const name = payload.name || email.split('@')[0];
      const picture = payload.picture || '';

      const now = new Date().toISOString();
      let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(googleId, email);

      if (!user) {
        const userId = 'U' + crypto.randomBytes(6).toString('hex');
        db.prepare(`
          INSERT INTO users (id, google_id, email, name, picture, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'student', ?, ?)
        `).run(userId, googleId, email, name, picture, now, now);

        db.prepare(`
          INSERT INTO user_profiles (user_id, state, age, gender, category, income, disability, occupation, education, domain, updated_at)
          VALUES (?, '', NULL, 'Any', 'All', NULL, 'no', 'Any', 'Any', '', ?)
        `).run(userId, now);

        createNotification(userId, 'Welcome to Scheme Matcher!', 'Your account has been created. Fill your profile to save time on scholarships.', 'welcome');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      } else {
        db.prepare('UPDATE users SET name = ?, picture = ?, updated_at = ? WHERE id = ?').run(name, picture, now, user.id);
      }

      // Migrate anonymous device bookmarks
      const deviceId = req.headers['x-device-id'];
      if (deviceId) {
        const deviceBookmarks = db.prepare('SELECT scheme_id FROM bookmarks WHERE device_id = ?').all(deviceId);
        for (const b of deviceBookmarks) {
          db.prepare('INSERT OR IGNORE INTO user_bookmarks (user_id, scheme_id, created_at) VALUES (?, ?, ?)')
            .run(user.id, b.scheme_id, now);
        }
      }

      const token = signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
      });

      return sendJSON(res, 200, {
        token,
        user: { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role },
      });
    }

    // Localhost Development / Testing Login
    if (pathname === '/api/auth/dev-login' && method === 'POST') {
      const body = await readBody(req);
      const email = (body.email || 'student@localhost.test').toLowerCase().trim();
      const name = body.name || 'Student Explorer';
      const now = new Date().toISOString();

      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user) {
        const userId = 'U' + crypto.randomBytes(6).toString('hex');
        db.prepare(`
          INSERT INTO users (id, google_id, email, name, picture, role, created_at, updated_at)
          VALUES (?, NULL, ?, ?, '', 'student', ?, ?)
        `).run(userId, email, name, now, now);

        db.prepare(`
          INSERT INTO user_profiles (user_id, state, age, gender, category, income, disability, occupation, education, domain, updated_at)
          VALUES (?, '', NULL, 'Any', 'All', NULL, 'no', 'Any', 'Any', '', ?)
        `).run(userId, now);

        createNotification(userId, 'Welcome to Scheme Matcher!', 'Local student test profile ready. Explore scholarships and manage applications.', 'welcome');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      }

      // Migrate device bookmarks
      const deviceId = req.headers['x-device-id'];
      if (deviceId) {
        const deviceBookmarks = db.prepare('SELECT scheme_id FROM bookmarks WHERE device_id = ?').all(deviceId);
        for (const b of deviceBookmarks) {
          db.prepare('INSERT OR IGNORE INTO user_bookmarks (user_id, scheme_id, created_at) VALUES (?, ?, ?)')
            .run(user.id, b.scheme_id, now);
        }
      }

      const token = signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
      });

      return sendJSON(res, 200, {
        token,
        user: { id: user.id, email: user.email, name: user.name, picture: user.picture, role: user.role },
      });
    }

    // -------------------------------------------------------------------------
    // CURRENT USER & PROFILE
    // -------------------------------------------------------------------------
    if (pathname === '/api/me' && method === 'GET') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const user = db.prepare('SELECT id, email, name, picture, role, created_at FROM users WHERE id = ?').get(auth.sub);
      if (!user) return sendJSON(res, 404, { error: 'User not found' });

      const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(auth.sub) || {};
      const unreadRow = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0').get(auth.sub);

      return sendJSON(res, 200, {
        user,
        profile,
        unreadNotifications: unreadRow ? unreadRow.cnt : 0,
      });
    }

    if (pathname === '/api/profile' && method === 'GET') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      let profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(auth.sub);
      if (!profile) {
        const now = new Date().toISOString();
        db.prepare('INSERT INTO user_profiles (user_id, updated_at) VALUES (?, ?)').run(auth.sub, now);
        profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(auth.sub);
      }
      return sendJSON(res, 200, profile);
    }

    if (pathname === '/api/profile' && (method === 'PUT' || method === 'POST')) {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const b = await readBody(req);
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO user_profiles (user_id, state, age, gender, category, income, disability, occupation, education, domain, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          state = excluded.state,
          age = excluded.age,
          gender = excluded.gender,
          category = excluded.category,
          income = excluded.income,
          disability = excluded.disability,
          occupation = excluded.occupation,
          education = excluded.education,
          domain = excluded.domain,
          updated_at = excluded.updated_at
      `).run(
        auth.sub,
        b.state || '',
        b.age ? parseInt(b.age, 10) : null,
        b.gender || 'Any',
        b.category || 'All',
        b.income !== undefined && b.income !== '' ? parseInt(b.income, 10) : null,
        b.disability || 'no',
        b.occupation || 'Any',
        b.education || 'Any',
        b.domain || '',
        now
      );

      return sendJSON(res, 200, db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(auth.sub));
    }

    // -------------------------------------------------------------------------
    // BOOKMARKS (Anonymous device or Authenticated student)
    // -------------------------------------------------------------------------
    if (pathname === '/api/bookmarks' && method === 'GET') {
      const auth = requireUser(req);
      if (auth) {
        const rows = db.prepare('SELECT scheme_id FROM user_bookmarks WHERE user_id = ?').all(auth.sub);
        return sendJSON(res, 200, rows.map(r => r.scheme_id));
      } else {
        const deviceId = req.headers['x-device-id'];
        if (!deviceId) return sendJSON(res, 400, { error: 'Missing X-Device-Id header or Authorization token' });
        const rows = db.prepare('SELECT scheme_id FROM bookmarks WHERE device_id = ?').all(deviceId);
        return sendJSON(res, 200, rows.map(r => r.scheme_id));
      }
    }

    if ((m = pathname.match(/^\/api\/bookmarks\/([^/]+)$/)) && method === 'POST') {
      const schemeId = m[1];
      const auth = requireUser(req);
      const now = new Date().toISOString();

      if (auth) {
        const existing = db.prepare('SELECT 1 FROM user_bookmarks WHERE user_id = ? AND scheme_id = ?').get(auth.sub, schemeId);
        if (existing) {
          db.prepare('DELETE FROM user_bookmarks WHERE user_id = ? AND scheme_id = ?').run(auth.sub, schemeId);
          return sendJSON(res, 200, { bookmarked: false });
        } else {
          db.prepare('INSERT INTO user_bookmarks (user_id, scheme_id, created_at) VALUES (?, ?, ?)').run(auth.sub, schemeId, now);
          return sendJSON(res, 200, { bookmarked: true });
        }
      } else {
        const deviceId = req.headers['x-device-id'];
        if (!deviceId) return sendJSON(res, 400, { error: 'Missing X-Device-Id header' });
        const existing = db.prepare('SELECT 1 FROM bookmarks WHERE device_id = ? AND scheme_id = ?').get(deviceId, schemeId);
        if (existing) {
          db.prepare('DELETE FROM bookmarks WHERE device_id = ? AND scheme_id = ?').run(deviceId, schemeId);
          return sendJSON(res, 200, { bookmarked: false });
        } else {
          db.prepare('INSERT INTO bookmarks (device_id, scheme_id, created_at) VALUES (?, ?, ?)').run(deviceId, schemeId, now);
          return sendJSON(res, 200, { bookmarked: true });
        }
      }
    }

    // Explicit bookmark migration
    if (pathname === '/api/bookmarks/migrate' && method === 'POST') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });
      const deviceId = req.headers['x-device-id'];
      if (!deviceId) return sendJSON(res, 400, { error: 'Missing X-Device-Id header' });

      const deviceBookmarks = db.prepare('SELECT scheme_id FROM bookmarks WHERE device_id = ?').all(deviceId);
      const now = new Date().toISOString();
      let count = 0;
      for (const b of deviceBookmarks) {
        const resRun = db.prepare('INSERT OR IGNORE INTO user_bookmarks (user_id, scheme_id, created_at) VALUES (?, ?, ?)').run(auth.sub, b.scheme_id, now);
        if (resRun.changes > 0) count++;
      }
      return sendJSON(res, 200, { migrated: count });
    }

    // -------------------------------------------------------------------------
    // APPLICATION TRACKER
    // -------------------------------------------------------------------------
    if (pathname === '/api/applications' && method === 'GET') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const rows = db.prepare(`
        SELECT a.*, s.name as scheme_name, s.ministry as scheme_ministry, s.benefit as scheme_benefit, s.apply_url as scheme_apply_url
        FROM applications a
        LEFT JOIN schemes s ON a.scheme_id = s.id
        WHERE a.user_id = ?
        ORDER BY a.updated_at DESC
      `).all(auth.sub);

      return sendJSON(res, 200, rows);
    }

    if (pathname === '/api/applications' && method === 'POST') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const b = await readBody(req);
      if (!b.scheme_id) return sendJSON(res, 400, { error: 'scheme_id is required' });

      const scheme = getSchemeById(b.scheme_id);
      if (!scheme) return sendJSON(res, 404, { error: 'Scheme does not exist' });

      const id = 'APP' + crypto.randomBytes(6).toString('hex').toUpperCase();
      const now = new Date().toISOString();
      const status = b.status || 'Preparing';
      const appliedAt = b.applied_at || (status === 'Applied' ? now : null);

      db.prepare(`
        INSERT INTO applications (id, user_id, scheme_id, status, applied_at, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, auth.sub, b.scheme_id, status, appliedAt, b.notes || '', now, now);

      createNotification(auth.sub, 'Application Created', `Tracking application for "${scheme.name}" (Status: ${status}).`, 'application');

      const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
      return sendJSON(res, 201, app);
    }

    if ((m = pathname.match(/^\/api\/applications\/([^/]+)$/)) && (method === 'PUT' || method === 'PATCH')) {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const existing = db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?').get(m[1], auth.sub);
      if (!existing) return sendJSON(res, 404, { error: 'Application not found' });

      const b = await readBody(req);
      const now = new Date().toISOString();
      const status = b.status || existing.status;
      const notes = b.notes !== undefined ? b.notes : existing.notes;
      const appliedAt = b.applied_at !== undefined ? b.applied_at : existing.applied_at;

      db.prepare(`
        UPDATE applications SET status = ?, notes = ?, applied_at = ?, updated_at = ? WHERE id = ?
      `).run(status, notes, appliedAt, now, m[1]);

      if (status !== existing.status) {
        const scheme = getSchemeById(existing.scheme_id);
        const schemeName = scheme ? scheme.name : 'Scholarship';
        createNotification(auth.sub, 'Status Updated', `Application for "${schemeName}" status changed to: ${status}.`, 'application');
      }

      const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(m[1]);
      return sendJSON(res, 200, updated);
    }

    if ((m = pathname.match(/^\/api\/applications\/([^/]+)$/)) && method === 'DELETE') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const existing = db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?').get(m[1], auth.sub);
      if (!existing) return sendJSON(res, 404, { error: 'Application not found' });

      db.prepare('DELETE FROM applications WHERE id = ?').run(m[1]);
      return sendJSON(res, 200, { deleted: true });
    }

    // -------------------------------------------------------------------------
    // DOCUMENT MANAGEMENT (Real File Upload & Storage)
    // -------------------------------------------------------------------------
    if (pathname === '/api/documents' && method === 'GET') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const rows = db.prepare(`
        SELECT id, doc_type, file_name, file_size, mime_type, uploaded_at
        FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC
      `).all(auth.sub);

      return sendJSON(res, 200, rows);
    }

    if (pathname === '/api/documents' && method === 'POST') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const b = await readBody(req);
      const { docType, fileName, fileBase64, mimeType } = b;

      if (!docType || !fileName || !fileBase64) {
        return sendJSON(res, 400, { error: 'docType, fileName, and fileBase64 are required' });
      }

      // Validations
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      const effectiveMime = mimeType || 'application/octet-stream';
      if (!allowedMimes.includes(effectiveMime.toLowerCase())) {
        return sendJSON(res, 400, { error: 'Only PDF, JPG, and PNG files are accepted.' });
      }

      const buffer = Buffer.from(fileBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return sendJSON(res, 400, { error: 'File size exceeds maximum 5MB limit.' });
      }

      // Safe filename generation & path traversal prevention
      const ext = path.extname(fileName).toLowerCase() || '.bin';
      const safeId = 'DOC_' + crypto.randomUUID();
      const storageName = `${safeId}${ext}`;
      const filePath = path.join(UPLOADS_DIR, storageName);

      fs.writeFileSync(filePath, buffer);

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO documents (id, user_id, doc_type, file_name, file_path, file_size, mime_type, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(safeId, auth.sub, docType, path.basename(fileName), storageName, buffer.length, effectiveMime, now);

      createNotification(auth.sub, 'Document Uploaded', `Document "${docType}" successfully stored in vault.`, 'document');

      return sendJSON(res, 201, {
        id: safeId,
        docType,
        fileName: path.basename(fileName),
        fileSize: buffer.length,
        mimeType: effectiveMime,
        uploadedAt: now,
      });
    }

    if ((m = pathname.match(/^\/api\/documents\/([^/]+)\/download$/)) && method === 'GET') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(m[1], auth.sub);
      if (!doc) return sendJSON(res, 404, { error: 'Document not found' });

      const safePath = path.join(UPLOADS_DIR, path.basename(doc.file_path));
      if (!fs.existsSync(safePath)) return sendJSON(res, 404, { error: 'Physical file not found on disk' });

      const data = fs.readFileSync(safePath);
      res.writeHead(200, {
        'Content-Type': doc.mime_type,
        'Content-Length': data.length,
        'Content-Disposition': `inline; filename="${encodeURIComponent(doc.file_name)}"`,
      });
      return res.end(data);
    }

    if ((m = pathname.match(/^\/api\/documents\/([^/]+)$/)) && method === 'DELETE') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?').get(m[1], auth.sub);
      if (!doc) return sendJSON(res, 404, { error: 'Document not found' });

      const safePath = path.join(UPLOADS_DIR, path.basename(doc.file_path));
      if (fs.existsSync(safePath)) {
        try { fs.unlinkSync(safePath); } catch (e) {}
      }

      db.prepare('DELETE FROM documents WHERE id = ?').run(m[1]);
      return sendJSON(res, 200, { deleted: true });
    }

    // -------------------------------------------------------------------------
    // NOTIFICATIONS
    // -------------------------------------------------------------------------
    if (pathname === '/api/notifications' && method === 'GET') {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(auth.sub);
      return sendJSON(res, 200, rows);
    }

    if ((m = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/)) && (method === 'PUT' || method === 'POST')) {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(m[1], auth.sub);
      return sendJSON(res, 200, { success: true });
    }

    if (pathname === '/api/notifications/read-all' && (method === 'PUT' || method === 'POST')) {
      const auth = requireUser(req);
      if (!auth) return sendJSON(res, 401, { error: 'Authentication required' });

      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(auth.sub);
      return sendJSON(res, 200, { success: true });
    }

    // -------------------------------------------------------------------------
    // SERVICE REQUESTS (Donations & Volunteers - Genuine Registration, No Fake Payment)
    // -------------------------------------------------------------------------
    if (pathname === '/api/service-requests' && method === 'POST') {
      const auth = getAuthUser(req);
      const b = await readBody(req);
      const type = b.type; // 'donation' or 'volunteer'

      if (!type || !['donation', 'volunteer', 'support'].includes(type)) {
        return sendJSON(res, 400, { error: 'Invalid service request type' });
      }

      const id = 'SR_' + crypto.randomUUID();
      const now = new Date().toISOString();

      if (type === 'donation') {
        if (!b.amount || parseFloat(b.amount) <= 0) {
          return sendJSON(res, 400, { error: 'Valid donation pledge amount is required' });
        }
        if (!b.name || !b.email) {
          return sendJSON(res, 400, { error: 'Name and email are required for tax receipting' });
        }
      } else if (type === 'volunteer') {
        if (!b.name || !b.email || !b.interests) {
          return sendJSON(res, 400, { error: 'Name, email, and interests are required for volunteer signup' });
        }
      }

      db.prepare(`
        INSERT INTO service_requests (id, user_id, type, data, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        auth ? auth.sub : null,
        type,
        JSON.stringify(b),
        type === 'donation' ? 'pledged' : 'registered',
        now
      );

      logAudit(`New ${type} request submitted by ${b.name || 'Anonymous'}`);

      return sendJSON(res, 201, {
        id,
        type,
        status: type === 'donation' ? 'pledged' : 'registered',
        message: type === 'donation'
          ? 'Thank you for your generous pledge! Our verification coordinator will contact you with official payment channels (UPI/NEFT) and 80G tax exemption details.'
          : 'Thank you for volunteering! Our community manager will review your submission and connect with you shortly.',
      });
    }

    // -------------------------------------------------------------------------
    // FEEDBACK
    // -------------------------------------------------------------------------
    if (pathname === '/api/feedback' && method === 'POST') {
      const auth = getAuthUser(req);
      const b = await readBody(req);
      const rating = parseInt(b.rating, 10);

      if (!rating || rating < 1 || rating > 5) {
        return sendJSON(res, 400, { error: 'Rating between 1 and 5 is required' });
      }
      if (!b.message || !b.message.trim()) {
        return sendJSON(res, 400, { error: 'Feedback message is required' });
      }

      const id = 'FB_' + crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare('INSERT INTO feedback (id, user_id, rating, message, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, auth ? auth.sub : null, rating, b.message.trim(), now);

      return sendJSON(res, 201, { success: true, message: 'Thank you for your feedback!' });
    }

    // -------------------------------------------------------------------------
    // ADMIN PORTAL & MANAGEMENT
    // -------------------------------------------------------------------------
    if (pathname === '/api/admin/login' && method === 'POST') {
      const body = await readBody(req);
      const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin');
      if (!user) return sendJSON(res, 500, { error: 'No admin user configured' });

      const hash = hashPassword(body.password || '', user.salt);
      const ok = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.hash));
      if (!ok) return sendJSON(res, 401, { error: 'Incorrect password' });

      const token = signToken({ role: 'admin', sub: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 });
      logAudit('Admin signed in');
      return sendJSON(res, 200, { token });
    }

    if (pathname === '/api/admin/audit-log' && method === 'GET') {
      if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 150').all();
      return sendJSON(res, 200, rows);
    }

    if (pathname === '/api/admin/users' && method === 'GET') {
      if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const rows = db.prepare(`
        SELECT u.id, u.email, u.name, u.role, u.created_at,
               p.state, p.category, p.education,
               (SELECT COUNT(*) FROM applications WHERE user_id = u.id) as app_count,
               (SELECT COUNT(*) FROM documents WHERE user_id = u.id) as doc_count
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        ORDER BY u.created_at DESC
      `).all();
      return sendJSON(res, 200, rows);
    }

    if (pathname === '/api/admin/applications' && method === 'GET') {
      if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const rows = db.prepare(`
        SELECT a.*, u.name as user_name, u.email as user_email, s.name as scheme_name
        FROM applications a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN schemes s ON a.scheme_id = s.id
        ORDER BY a.updated_at DESC
      `).all();
      return sendJSON(res, 200, rows);
    }

    if (pathname === '/api/admin/service-requests' && method === 'GET') {
      if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const rows = db.prepare('SELECT * FROM service_requests ORDER BY created_at DESC').all();
      return sendJSON(res, 200, rows);
    }

    if (pathname === '/api/admin/feedback' && method === 'GET') {
      if (!requireAdmin(req)) return sendJSON(res, 401, { error: 'Unauthorized' });
      const rows = db.prepare(`
        SELECT f.*, u.name as user_name, u.email as user_email
        FROM feedback f
        LEFT JOIN users u ON f.user_id = u.id
        ORDER BY f.created_at DESC
      `).all();
      return sendJSON(res, 200, rows);
    }

    // Scheme Mutations (Admin only)
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
        b.applyUrl || 'https://www.myscheme.gov.in', b.sourceUrl || 'admin-added', b.lastVerified || now.slice(0, 10),
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

      db.prepare(`
        UPDATE schemes SET name=?, short_desc=?, ministry=?, level=?, domain=?, states=?, category=?, gender=?,
        min_age=?, max_age=?, income_max=?, education=?, occupation=?, disability=?, benefit_type=?, benefit=?,
        documents=?, steps=?, apply_url=?, source_url=?, last_verified=?, deadline=?, active=?, updated_at=? WHERE id=?
      `).run(
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
          item.applyUrl || 'https://www.myscheme.gov.in', item.sourceUrl || 'bulk-import', item.lastVerified || now.slice(0, 10),
          item.deadline || 'Rolling', 1, now, now
        );
        count++;
      }
      logAudit(`Bulk-imported ${count} scheme(s)`);
      return sendJSON(res, 201, { imported: count });
    }

    return sendJSON(res, 404, { error: 'Endpoint not found' });
  } catch (err) {
    console.error('[SERVER ERROR]', err);
    return sendJSON(res, 500, { error: err.message || 'Internal server error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[READY] Scheme Matcher running at http://localhost:${PORT}`);
    if (!GOOGLE_CLIENT_ID) {
      console.log(`[INFO] Google Client ID not set in environment. Google sign-in fallback and local test sign-in available.`);
    }
  });
}

module.exports = {
  server,
  db,
  computeMatch,
  getAllSchemeRows,
  getSchemeById,
  signToken,
  verifyToken,
};
