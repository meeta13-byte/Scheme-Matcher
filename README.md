# Scheme Matcher — India Welfare Matcher

A zero-dependency full-stack application designed to match Indian citizens with eligible government schemes and scholarships. 

Built entirely with modern Node.js, SQLite, and vanilla JavaScript—no `npm install` or external API keys required.

## 🚀 How to Run

1. **Prerequisites**: Ensure you have Node.js v22.5.0 or newer (for built-in `node:sqlite`).
2. **Start the server**:
   ```bash
   node server.js
   ```
3. **Open the app**: Visit [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
scheme-matcher/
├── package.json         # Metadata & start script
├── server.js            # Node HTTP server, APIs, & Matching engine
├── data/                # SQLite database folder (auto-seeded)
└── public/              # Front-end static assets
    ├── index.html       # Client interface (questionnaire & admin portal)
    ├── style.css        # Responsive stylesheet
    └── app.js           # dynamic DOM handler & API caller
```

## 🛠️ Features
- **Smart Matching Questionnaire**: Inputs State, Age, Income, Social Category, Gender, Occupation, Education, and Disability to compute match scores.
- **Bookmark System**: Saves schemes locally per-device using a device identifier synced to the SQLite backend.
- **Admin Dashboard**: Change default configurations, manage scheme CRUD operations, review logs, and run bulk imports.
