# Government Scheme & Scholarship Matcher — India

A zero-dependency, production-quality localhost full-stack application designed to help Indian students discover government scholarships and welfare schemes for which they are eligible.

Built entirely with modern Node.js, SQLite (`node:sqlite`), and vanilla JavaScript — zero external npm packages required.

---

## 🚀 How to Run

1. **Prerequisites**: Ensure you have Node.js v22.5.0 or newer (uses built-in `node:sqlite`, `node:crypto`, `node:http`, and `node:https`).
2. **Start the server**:
   ```bash
   node server.js
   ```
   *or*
   ```bash
   npm start
   ```
3. **Open the app**: Visit [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧪 Automated Testing

A full regression and verification suite is included:
```bash
npm test
```
*or*
```bash
node test_runner.js
```
Runs 23 automated tests covering:
- Frontend HTML & DOM element integrity (135 referenced IDs verified)
- Public reference APIs (`/api/domains`, `/api/states`, `/api/stats`, `/api/schemes`)
- Deterministic matching engine (100% full matches and partial match criteria explanation)
- Anonymous bookmarks & device ID persistence
- Google ID token validation & Local Student Session issuance
- Student profile persistence (`/api/profile`)
- Application Tracker (Create, Read, Update status, Delete)
- Document Vault (Upload validation, max 5MB ceiling, PDF/PNG/JPG mime verification, download, delete)
- Notifications (Retrieval, read status update)
- Service Requests (Donation pledge registration & volunteer sign-up)
- Feedback submission
- Extended Admin Portal (Schemes CRUD, Users, Applications, Requests, Feedback, Audit Logs)
- Database persistence across server restarts

---

## 🔑 Configuration & Environment Variables

Copy `.env.example` to `.env` to customize settings:
```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Local HTTP server port |
| `ADMIN_PASSWORD` | `admin123` | Password for the Admin Portal |
| `GOOGLE_CLIENT_ID` | *(Optional)* | Google Cloud OAuth 2.0 Web Client ID |

---

## 🔐 Google Sign-In Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Application Type: Web Application).
3. Under **Authorized JavaScript origins**, add `http://localhost:3000`.
4. Copy the Client ID into your `.env` file:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```
5. Restart the server. Google Sign-In will render via Google Identity Services.

> [!NOTE]
> **Localhost Test Login Available**: If you do not yet have a Google Cloud Client ID, click **"Student Sign In"** on the top right to use the local student test account (`student@india.gov.in`). All features (Profile, Application Tracker, Document Vault, Notifications) work immediately.

---

## 📁 Project Architecture

```
Scheme-Matcher/
├── .env.example         # Environment template
├── package.json         # Scripts (start, test)
├── server.js            # Node HTTP server, DB migrations, APIs, Matching engine
├── test_runner.js       # Complete automated test runner
├── data/                # SQLite persistent storage
│   ├── scheme-matcher.db # SQLite database
│   └── uploads/         # Uploaded documents storage
└── public/              # Vanilla frontend assets
    ├── index.html       # Single-page client interface
    ├── style.css        # Responsive stylesheet
    └── app.js           # Client controller & dynamic DOM handler
```

---

## 🎯 Core Features

### 1. Deterministic Scholarship Matching Engine
- **Inputs**: State, Category, Gender, Age, Family Income, Disability (40%+), Occupation, Education Level, Domain.
- **Explainability**: Every result provides an explicit percentage score, **"Criteria Met"** reasons, and **"Missing / Unmet Requirements"** for partial matches.
- **Actions**: Direct official application links, bookmark toggle, and instant one-click application tracking.

### 2. Secondary Services Pop-Out ("Services ▾")
Accessible from the header navigation without cluttering the homepage:
- 🎓 **Scholarship Matcher**: Jump to matching questionnaire.
- 📄 **Document Vault**: Store and manage Aadhaar, Income, Caste, and Bonafide certificates (PDF, PNG, JPG under 5MB).
- 📝 **Application Tracker**: Monitor scholarship submissions through 7 lifecycle stages (*Not Started, Preparing, Applied, Under Review, Approved, Rejected, Completed*).
- 🔔 **Deadline Alerts & Notifications**: Automatic notifications when applications update or deadlines approach.
- 👤 **My Profile**: Save eligibility criteria once to auto-fill future searches.
- ❤️ **Support & Donate**: Honest donation pledge registration with 80G tax receipt information (no fake payment gateway).
- 🤝 **Volunteer**: Community outreach and scholarship guidance registration.
- 💬 **Feedback**: 5-star rating and suggestions.

### 3. Extended Admin Dashboard
Sign in with password `admin123`:
- **Schemes**: Add, edit, activate/deactivate, delete, and bulk import schemes in JSON format.
- **Users**: View registered student accounts and activity counts.
- **Applications**: View all student applications across the platform.
- **Services & Donations**: Review submitted donation pledges and volunteer sign-ups.
- **Feedback**: Review student ratings and comments.
- **Audit Logs**: Immutable log of administrative actions with timestamps.

---

## 🛡️ Security Measures
- **SQL Injection Prevention**: 100% parameterized SQLite statements (`DatabaseSync.prepare`).
- **XSS Protection**: Comprehensive HTML escaping (`escapeHtml`) on all user-supplied content.
- **Path Traversal Protection**: Uploaded files receive safe UUID filenames with sanitized extensions and isolated storage in `data/uploads/`.
- **Authorization Separation**: Separate HMAC-SHA256 tokens for `admin` and `student` roles; students cannot access admin mutations or another student's documents/applications.
