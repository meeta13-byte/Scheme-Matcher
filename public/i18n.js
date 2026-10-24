// i18n.js — Scheme Matcher Multi-Language Support
// Supports: English (en) | Hindi (hi)
// Usage: window.i18n.t('key') → translated string
//        window.i18n.applyAll() → re-translates all data-i18n elements
//        window.i18n.setLang('hi') → switch language & re-render

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSLATION DICTIONARIES
  // ─────────────────────────────────────────────────────────────────────────
  const TRANSLATIONS = {

    // ═══════════════════════════════════════════════════════════════════════
    en: {
      // Language switcher
      lang_en: 'EN',
      lang_hi: 'हि',
      lang_switch_label: 'Switch Language',

      // Site title / header
      site_title: 'Scheme Matcher',
      site_subtitle: 'Government Scheme & Scholarship Matcher for India',
      site_title_full: 'Scheme Matcher — India Welfare Matcher',

      // Navigation
      nav_find: 'Find Schemes',
      nav_browse: 'Browse All',
      nav_international: '✈️ International',
      nav_bookmarks: 'Bookmarks',
      nav_admin: 'Admin Portal',
      nav_services: '⚡ Services',

      // International Schemes tab
      intl_badge: '🌍 GLOBAL OPPORTUNITIES FOR INDIAN STUDENTS',
      intl_title: 'Study Abroad & International Scholarships',
      intl_subtitle: 'Discover fully-funded and prestigious overseas fellowships, government scholarships, bilateral exchange programs, and study-abroad grants in the UK, USA, Germany, Japan, Europe, and worldwide.',
      intl_ph_search: 'Search international scholarships by country, degree, or funding...',
      intl_all_countries: 'All Destinations',

      // Services menu
      svc_menu_title: 'Quick Access',
      svc_menu_tagline: 'Your tools, all in one place',
      svc_scholarship: 'Scholarship\nMatcher',
      svc_abroad: 'Study\nAbroad',
      svc_tracker: 'Application\nTracker',
      svc_vault: 'Document\nVault',
      svc_notifications: 'Notifications',
      svc_profile: 'My\nProfile',
      svc_feedback: 'Give\nFeedback',
      svc_donate: '❤️ Support & Donate',
      svc_volunteer: '🤝 Volunteer With Us',

      // Auth area
      btn_signin: '👤 Student Sign In',
      btn_signout: 'Sign Out',

      // Stats bar
      stat_active: '🟢 Live Active Schemes:',
      stat_domains: '📂 Welfare Domains:',
      stat_reviewed: '🗓️ Last Reviewed:',

      // Login gate
      gate_heading: 'Scheme Matcher',
      gate_subtitle: 'Government Scheme & Scholarship Finder for India',
      gate_welcome: 'Welcome! Please sign in to continue',
      gate_welcome_subtitle: "Discover government schemes and scholarships you're eligible for — free, personalised, and in seconds.",
      gate_google_btn: 'Sign in with Google',
      gate_or: 'OR CONTINUE WITH EMAIL',
      gate_email_label: 'Email Address',
      gate_name_label: 'Full Name',
      gate_continue_btn: 'Continue to Scheme Matcher →',
      gate_privacy: '🔒 Your data is stored only on this device. No spam, no tracking.',

      // Match form
      form_heading: 'Find Schemes You Qualify For',
      form_subtitle: 'Fill out your eligibility details below. Our deterministic matching engine calculates score percentages and reasons.',
      btn_load_profile: '⚡ Load from Profile',
      lbl_state: 'State / UT',
      lbl_category: 'Social Category',
      lbl_gender: 'Gender',
      lbl_age: 'Age (Years)',
      lbl_income: 'Annual Household Income (₹)',
      lbl_disability: 'Specially-Abled (Disability 40%+)?',
      lbl_occupation: 'Occupation',
      lbl_education: 'Highest Education Level',
      lbl_domain: 'Domain of Interest (Optional)',
      lbl_domain_opt: 'All Welfare Domains',
      btn_search: 'Search Matching Schemes',
      ph_age: 'e.g. 20',
      ph_income: 'e.g. 150000',

      // Category options
      opt_all_general: 'All / General',
      opt_sc: 'Scheduled Caste (SC)',
      opt_st: 'Scheduled Tribe (ST)',
      opt_obc: 'Other Backward Class (OBC)',
      opt_minority: 'Minority Communities',

      // Gender options
      opt_any_gender: 'Any Gender',
      opt_male: 'Male',
      opt_female: 'Female',

      // Disability options
      opt_yes: 'Yes',
      opt_no: 'No',

      // Occupation options
      opt_any_other: 'Any / Other',
      opt_student: 'Student',
      opt_farmer: 'Farmer',
      opt_unemployed: 'Unemployed',
      opt_employed: 'Employed / Salaried',
      opt_self_employed: 'Self-employed',
      opt_unorganised: 'Unorganised Sector Worker',
      opt_artisan: 'Artisan / Craftsperson',

      // Education options
      opt_any_edu: 'Any / Other',
      opt_school: 'School Education (Class 1-12)',
      opt_iti: 'ITI Course',
      opt_diploma: 'Diploma Course',
      opt_ug: 'Undergraduate (UG)',
      opt_pg: 'Postgraduate (PG)',
      opt_phd: 'Doctoral / PhD',

      // Results
      results_heading: 'Your Matches',
      results_count_zero: '0 schemes found',
      results_empty: 'Fill out the questionnaire and click search to view matching government schemes.',

      // Browse tab
      ph_search: 'Search schemes by name, keyword, or ministry...',
      opt_all_domains: 'All Domains',

      // Bookmarks tab
      bookmarks_heading: 'Your Saved Schemes',
      bookmarks_subtitle: 'Bookmarked schemes are saved to your account or device.',
      bookmarks_empty: "You haven't bookmarked any schemes yet.",

      // Admin tab
      admin_auth_heading: 'Admin Authentication',
      admin_auth_subtitle: 'Sign in to manage schemes, view registered users, track applications, and inspect system audit logs.',
      lbl_admin_password: 'Admin Password',
      ph_admin_password: 'Enter admin password',
      btn_admin_login: 'Login to Admin Portal',
      admin_dashboard_heading: 'Admin Dashboard',
      btn_add_scheme: '+ Add New Scheme',
      btn_bulk_import: 'Bulk Import',
      btn_admin_logout: 'Logout',

      // Admin subnav
      subnav_schemes: 'Schemes',
      subnav_users: 'Users',
      subnav_apps: 'Applications',
      subnav_requests: 'Services & Donations',
      subnav_feedback: 'Feedback',
      subnav_audit: 'Audit Logs',

      // Admin tables — Schemes
      th_id: 'ID',
      th_name: 'Name',
      th_ministry_level: 'Ministry / Level',
      th_domain: 'Domain',
      th_benefit: 'Benefit',
      th_status: 'Status',
      th_actions: 'Actions',

      // Admin tables — Users
      th_email: 'Email',
      th_role: 'Role',
      th_state_edu: 'State / Education',
      th_apps: 'Apps',
      th_docs: 'Docs',
      th_joined: 'Joined',

      // Admin tables — Applications
      th_app_id: 'App ID',
      th_user: 'User',
      th_scheme: 'Scheme',
      th_applied_date: 'Applied Date',
      th_notes: 'Notes',
      th_last_updated: 'Last Updated',

      // Admin tables — Requests
      th_request_id: 'Request ID',
      th_type: 'Type',
      th_details: 'Details',
      th_submitted_at: 'Submitted At',

      // Admin tables — Feedback
      th_rating: 'Rating',
      th_message: 'Message',
      th_date: 'Date',

      // Admin tables — Audit
      th_timestamp: 'Timestamp',
      th_action: 'Action Details',

      // Auth modal
      auth_modal_title: 'Student Account Access',
      auth_modal_subtitle: 'Sign in to save your eligibility criteria, track applications, and maintain your document vault.',
      auth_or_local: 'OR LOCAL TEST SIGN-IN',
      lbl_student_email: 'Student Email',
      lbl_full_name: 'Full Name',
      btn_continue_account: 'Continue to Account',

      // Profile modal
      profile_modal_title: 'My Student Profile',
      profile_modal_subtitle: "Save your eligibility information here once so you don't need to re-enter it each time.",
      lbl_prof_state: 'State / UT',
      lbl_prof_category: 'Social Category',
      lbl_prof_gender: 'Gender',
      lbl_prof_age: 'Age (Years)',
      lbl_prof_income: 'Annual Household Income (₹)',
      lbl_prof_disability: 'Specially-Abled (40%+ Disability)?',
      lbl_prof_occupation: 'Occupation',
      lbl_prof_education: 'Highest Education Level',
      lbl_prof_domain: 'Preferred Domain / Field of Study',
      opt_all_domains_prof: 'All Domains',
      btn_save_profile: 'Save Profile Details',
      profile_saved: 'Profile updated successfully!',

      // Tracker modal
      tracker_modal_title: 'Scholarship Application Tracker',
      tracker_modal_subtitle: 'Monitor deadlines, submission dates, notes, and progress of all your scholarship applications.',
      th_tracker_scheme: 'Scheme Name',
      th_tracker_status: 'Status',
      th_tracker_date: 'Applied Date',
      th_tracker_notes: 'Notes',
      th_tracker_actions: 'Actions',

      // Quick-app modal
      quick_app_title: 'Track Application',
      lbl_quick_status: 'Current Status',
      lbl_quick_notes: 'Notes / Application Reference No.',
      ph_quick_notes: 'e.g. Reference No: NSP-2026-88192, verified by college on Oct 12',
      btn_save_tracker: 'Save to Tracker',
      opt_not_started: 'Not Started',
      opt_preparing: 'Preparing Documents',
      opt_applied: 'Applied',
      opt_under_review: 'Under Review',
      opt_approved: 'Approved',
      opt_rejected: 'Rejected',
      opt_completed: 'Completed',

      // Vault modal
      vault_modal_title: 'Document Vault',
      vault_modal_subtitle: 'Securely store certificates and documents required for scholarship verification (Aadhaar, Income, Caste, Marksheets). Max 5MB per file (PDF/PNG/JPG).',
      vault_upload_heading: 'Upload Verified Document',
      lbl_doc_category: 'Document Category',
      opt_aadhaar: 'Aadhaar Card',
      opt_income_cert: 'Income Certificate',
      opt_caste_cert: 'Caste Certificate',
      opt_domicile: 'Domicile / Residence Certificate',
      opt_marksheet: 'Marksheet / Grade Card',
      opt_bank_passbook: 'Bank Passbook',
      opt_disability_cert: 'Disability Certificate',
      opt_other_doc: 'Other Document',
      btn_choose_file: 'Choose File',
      btn_upload_doc: '📤 Upload to Vault',
      vault_stored_heading: 'Stored Documents',

      // Notifications modal
      notif_modal_title: 'Notifications',
      btn_mark_all_read: '✓ Mark All Read',

      // Donation modal
      donation_modal_title: '❤️ Support Scheme Matcher',
      donation_modal_subtitle: 'Your contribution helps us serve more students, maintain data accuracy, and expand state-level scheme coverage.',
      lbl_donor_name: 'Full Name',
      lbl_donor_email: 'Email Address',
      lbl_donor_amount: 'Pledge Amount (₹)',
      ph_donor_amount: 'e.g. 500',
      lbl_donor_pan: 'PAN Number (for 80G Tax Receipt)',
      ph_donor_pan: 'AAAAA0000A',
      btn_donate: '❤️ Pledge Support',

      // Volunteer modal
      volunteer_modal_title: '🤝 Volunteer With Us',
      volunteer_modal_subtitle: 'Join our community of volunteers helping students across India navigate government welfare schemes.',
      lbl_vol_name: 'Full Name',
      lbl_vol_email: 'Email Address',
      lbl_vol_phone: 'Phone Number',
      ph_vol_phone: '+91 98765 43210',
      lbl_vol_state: 'Your State',
      lbl_vol_interests: 'Areas of Interest',
      opt_data_entry: 'Scheme Data Entry',
      opt_student_help: 'Student Guidance',
      opt_translation: 'Regional Language Translation',
      opt_tech: 'Technology / Development',
      opt_outreach: 'Community Outreach',
      lbl_vol_message: 'Brief Message',
      ph_vol_message: 'Tell us about yourself and why you want to volunteer...',
      btn_volunteer: '🤝 Submit Volunteer Application',

      // Feedback modal
      feedback_modal_title: '💬 Share Your Feedback',
      feedback_modal_subtitle: 'Help us improve Scheme Matcher for students across India.',
      lbl_rating: 'Your Rating',
      lbl_feedback_msg: 'Your Feedback',
      ph_feedback_msg: 'Tell us what works well, what could be improved, or suggest new features...',
      btn_submit_feedback: '💬 Submit Feedback',

      // AI Chat / SchemeMitra
      ai_placeholder: 'Ask SchemeMitra anything... e.g. "Scholarships for OBC girls"',
      ai_send: 'Send',
      ai_voice_start: '🎙️',
      ai_voice_stop: '⏹️',
      ai_title: '🤖 SchemeMitra — AI & Voice Assistant',

      // Scheme cards
      scheme_ministry: 'Ministry',
      scheme_benefit: 'Benefit',
      scheme_deadline: 'Deadline',
      scheme_income_limit: 'Income Limit',
      scheme_no_limit: 'No limit',
      scheme_apply: '🔗 Apply Now',
      scheme_bookmark: '🔖 Save',
      scheme_unbookmark: '📌 Saved',
      scheme_track: '📋 Track',
      scheme_eligible: '✅ Fully Eligible',
      scheme_partial: '⚠️ Partial Match',
      scheme_why: '📋 Why This Matches',
      scheme_missing: '⚠️ Missing Criteria',

      // Common buttons
      btn_close: 'Close',
      btn_save: 'Save',
      btn_cancel: 'Cancel',
      btn_delete: 'Delete',
      btn_edit: 'Edit',
      btn_view: 'View',
      btn_download: '⬇ Download',
      btn_refresh: 'Refresh',

      // Toast / alerts
      toast_saved: 'Saved successfully!',
      toast_error: 'Something went wrong. Please try again.',
      toast_login_required: 'Please sign in to use this feature.',
      toast_bookmark_added: 'Scheme bookmarked!',
      toast_bookmark_removed: 'Bookmark removed.',

      // Footer
      footer_text: '© 2026 Scheme Matcher. Built for India.',
    },

    // ═══════════════════════════════════════════════════════════════════════
    hi: {
      // Language switcher
      lang_en: 'EN',
      lang_hi: 'हि',
      lang_switch_label: 'भाषा बदलें',

      // Site title / header
      site_title: 'स्कीम मैचर',
      site_subtitle: 'भारत के लिए सरकारी योजना व छात्रवृत्ति खोजकर्ता',
      site_title_full: 'स्कीम मैचर — भारत कल्याण योजना',

      // Navigation
      nav_find: 'योजनाएँ खोजें',
      nav_browse: 'सभी देखें',
      nav_international: '✈️ अंतर्राष्ट्रीय छात्रवृत्ति',
      nav_bookmarks: 'सहेजी योजनाएँ',
      nav_admin: 'एडमिन पोर्टल',
      nav_services: '⚡ सेवाएँ',

      // International Schemes tab
      intl_badge: '🌍 भारतीय छात्रों के लिए वैश्विक अवसर',
      intl_title: 'विदेश में उच्च शिक्षा व अंतर्राष्ट्रीय छात्रवृत्तियाँ',
      intl_subtitle: 'ब्रिटेन (UK), अमेरिका (USA), जर्मनी, जापान, यूरोपीय संघ और दुनिया भर में पूर्ण-वित्तपोषित फ़ेलोशिप, सरकारी छात्रवृत्तियाँ और अध्ययन अनुदान खोजें।',
      intl_ph_search: 'देश, डिग्री या वित्तीय सहायता से अंतर्राष्ट्रीय योजनाएँ खोजें...',
      intl_all_countries: 'सभी देश / गंतव्य',

      // Services menu
      svc_menu_title: 'त्वरित पहुँच',
      svc_menu_tagline: 'आपके सभी टूल एक जगह',
      svc_scholarship: 'छात्रवृत्ति\nमैचर',
      svc_abroad: 'विदेश में\nशिक्षा',
      svc_tracker: 'आवेदन\nट्रैकर',
      svc_vault: 'दस्तावेज़\nवॉल्ट',
      svc_notifications: 'सूचनाएँ',
      svc_profile: 'मेरी\nप्रोफ़ाइल',
      svc_feedback: 'प्रतिक्रिया\nदें',
      svc_donate: '❤️ सहयोग व दान करें',
      svc_volunteer: '🤝 स्वयंसेवक बनें',

      // Auth area
      btn_signin: '👤 छात्र साइन इन',
      btn_signout: 'साइन आउट',

      // Stats bar
      stat_active: '🟢 सक्रिय योजनाएँ:',
      stat_domains: '📂 कल्याण क्षेत्र:',
      stat_reviewed: '🗓️ अंतिम समीक्षा:',

      // Login gate
      gate_heading: 'स्कीम मैचर',
      gate_subtitle: 'भारत के लिए सरकारी योजना व छात्रवृत्ति खोजकर्ता',
      gate_welcome: 'स्वागत है! जारी रखने के लिए साइन इन करें',
      gate_welcome_subtitle: 'अपने लिए सरकारी योजनाएँ और छात्रवृत्तियाँ खोजें — मुफ़्त, व्यक्तिगत, और कुछ ही सेकंड में।',
      gate_google_btn: 'Google से साइन इन करें',
      gate_or: 'या ईमेल से जारी रखें',
      gate_email_label: 'ईमेल पता',
      gate_name_label: 'पूरा नाम',
      gate_continue_btn: 'स्कीम मैचर पर जाएँ →',
      gate_privacy: '🔒 आपका डेटा केवल इस डिवाइस पर है। कोई स्पैम नहीं, कोई ट्रैकिंग नहीं।',

      // Match form
      form_heading: 'अपनी पात्र योजनाएँ खोजें',
      form_subtitle: 'नीचे अपनी पात्रता जानकारी भरें। हमारा मिलान इंजन प्रत्येक योजना का स्कोर और कारण बताएगा।',
      btn_load_profile: '⚡ प्रोफ़ाइल से भरें',
      lbl_state: 'राज्य / केंद्र शासित प्रदेश',
      lbl_category: 'सामाजिक श्रेणी',
      lbl_gender: 'लिंग',
      lbl_age: 'आयु (वर्षों में)',
      lbl_income: 'वार्षिक पारिवारिक आय (₹)',
      lbl_disability: 'विशेष रूप से सक्षम (40%+ दिव्यांगता)?',
      lbl_occupation: 'व्यवसाय',
      lbl_education: 'उच्चतम शैक्षिक स्तर',
      lbl_domain: 'रुचि का क्षेत्र (वैकल्पिक)',
      lbl_domain_opt: 'सभी कल्याण क्षेत्र',
      btn_search: 'मेरी योजनाएँ खोजें',
      ph_age: 'उदा. 20',
      ph_income: 'उदा. 150000',

      // Category options
      opt_all_general: 'सभी / सामान्य',
      opt_sc: 'अनुसूचित जाति (SC)',
      opt_st: 'अनुसूचित जनजाति (ST)',
      opt_obc: 'अन्य पिछड़ा वर्ग (OBC)',
      opt_minority: 'अल्पसंख्यक समुदाय',

      // Gender options
      opt_any_gender: 'कोई भी लिंग',
      opt_male: 'पुरुष',
      opt_female: 'महिला',

      // Disability options
      opt_yes: 'हाँ',
      opt_no: 'नहीं',

      // Occupation options
      opt_any_other: 'कोई भी / अन्य',
      opt_student: 'छात्र',
      opt_farmer: 'किसान',
      opt_unemployed: 'बेरोजगार',
      opt_employed: 'कर्मचारी / वेतनभोगी',
      opt_self_employed: 'स्व-रोजगार',
      opt_unorganised: 'असंगठित क्षेत्र कामगार',
      opt_artisan: 'शिल्पकार / कारीगर',

      // Education options
      opt_any_edu: 'कोई भी / अन्य',
      opt_school: 'विद्यालय शिक्षा (कक्षा 1-12)',
      opt_iti: 'आईटीआई कोर्स',
      opt_diploma: 'डिप्लोमा कोर्स',
      opt_ug: 'स्नातक (UG)',
      opt_pg: 'स्नातकोत्तर (PG)',
      opt_phd: 'डॉक्टरेट / PhD',

      // Results
      results_heading: 'आपके मिलान',
      results_count_zero: '0 योजनाएँ मिलीं',
      results_empty: 'प्रश्नावली भरें और खोज बटन दबाएँ।',

      // Browse tab
      ph_search: 'योजनाओं का नाम, कीवर्ड या मंत्रालय से खोजें...',
      opt_all_domains: 'सभी क्षेत्र',

      // Bookmarks tab
      bookmarks_heading: 'सहेजी हुई योजनाएँ',
      bookmarks_subtitle: 'बुकमार्क की गई योजनाएँ आपके अकाउंट या डिवाइस में सहेजी हैं।',
      bookmarks_empty: 'आपने अभी कोई योजना सहेजी नहीं है।',

      // Admin tab
      admin_auth_heading: 'एडमिन प्रमाणीकरण',
      admin_auth_subtitle: 'योजनाएँ प्रबंधित करें, उपयोगकर्ता देखें, आवेदन ट्रैक करें।',
      lbl_admin_password: 'एडमिन पासवर्ड',
      ph_admin_password: 'एडमिन पासवर्ड दर्ज करें',
      btn_admin_login: 'एडमिन पोर्टल में लॉगिन करें',
      admin_dashboard_heading: 'एडमिन डैशबोर्ड',
      btn_add_scheme: '+ नई योजना जोड़ें',
      btn_bulk_import: 'बल्क आयात',
      btn_admin_logout: 'लॉगआउट',

      // Admin subnav
      subnav_schemes: 'योजनाएँ',
      subnav_users: 'उपयोगकर्ता',
      subnav_apps: 'आवेदन',
      subnav_requests: 'सेवाएँ व दान',
      subnav_feedback: 'प्रतिक्रिया',
      subnav_audit: 'ऑडिट लॉग',

      // Admin tables — Schemes
      th_id: 'आईडी',
      th_name: 'नाम',
      th_ministry_level: 'मंत्रालय / स्तर',
      th_domain: 'क्षेत्र',
      th_benefit: 'लाभ',
      th_status: 'स्थिति',
      th_actions: 'कार्रवाई',

      // Admin tables — Users
      th_email: 'ईमेल',
      th_role: 'भूमिका',
      th_state_edu: 'राज्य / शिक्षा',
      th_apps: 'आवेदन',
      th_docs: 'दस्तावेज़',
      th_joined: 'जुड़े',

      // Admin tables — Applications
      th_app_id: 'आवेदन ID',
      th_user: 'उपयोगकर्ता',
      th_scheme: 'योजना',
      th_applied_date: 'आवेदन तिथि',
      th_notes: 'नोट्स',
      th_last_updated: 'अंतिम अपडेट',

      // Admin tables — Requests
      th_request_id: 'अनुरोध ID',
      th_type: 'प्रकार',
      th_details: 'विवरण',
      th_submitted_at: 'जमा तिथि',

      // Admin tables — Feedback
      th_rating: 'रेटिंग',
      th_message: 'संदेश',
      th_date: 'तिथि',

      // Admin tables — Audit
      th_timestamp: 'समय',
      th_action: 'कार्रवाई विवरण',

      // Auth modal
      auth_modal_title: 'छात्र खाता पहुँच',
      auth_modal_subtitle: 'साइन इन करें — पात्रता मानदंड सहेजें, आवेदन ट्रैक करें, और दस्तावेज़ वॉल्ट रखें।',
      auth_or_local: 'या स्थानीय परीक्षण लॉगिन',
      lbl_student_email: 'छात्र ईमेल',
      lbl_full_name: 'पूरा नाम',
      btn_continue_account: 'खाते पर जाएँ',

      // Profile modal
      profile_modal_title: 'मेरी छात्र प्रोफ़ाइल',
      profile_modal_subtitle: 'अपनी पात्रता जानकारी यहाँ एक बार सहेजें, बार-बार दर्ज न करें।',
      lbl_prof_state: 'राज्य / केंद्र शासित प्रदेश',
      lbl_prof_category: 'सामाजिक श्रेणी',
      lbl_prof_gender: 'लिंग',
      lbl_prof_age: 'आयु (वर्षों में)',
      lbl_prof_income: 'वार्षिक पारिवारिक आय (₹)',
      lbl_prof_disability: 'विशेष रूप से सक्षम (40%+ दिव्यांगता)?',
      lbl_prof_occupation: 'व्यवसाय',
      lbl_prof_education: 'उच्चतम शैक्षिक स्तर',
      lbl_prof_domain: 'पसंदीदा क्षेत्र / अध्ययन क्षेत्र',
      opt_all_domains_prof: 'सभी क्षेत्र',
      btn_save_profile: 'प्रोफ़ाइल सहेजें',
      profile_saved: 'प्रोफ़ाइल सफलतापूर्वक अपडेट हुई!',

      // Tracker modal
      tracker_modal_title: 'छात्रवृत्ति आवेदन ट्रैकर',
      tracker_modal_subtitle: 'सभी छात्रवृत्ति आवेदनों की समय सीमा, जमा तिथि, नोट्स और प्रगति देखें।',
      th_tracker_scheme: 'योजना का नाम',
      th_tracker_status: 'स्थिति',
      th_tracker_date: 'आवेदन तिथि',
      th_tracker_notes: 'नोट्स',
      th_tracker_actions: 'कार्रवाई',

      // Quick-app modal
      quick_app_title: 'आवेदन ट्रैक करें',
      lbl_quick_status: 'वर्तमान स्थिति',
      lbl_quick_notes: 'नोट्स / आवेदन संदर्भ संख्या',
      ph_quick_notes: 'उदा. संदर्भ संख्या: NSP-2026-88192',
      btn_save_tracker: 'ट्रैकर में सहेजें',
      opt_not_started: 'शुरू नहीं हुआ',
      opt_preparing: 'दस्तावेज़ तैयार कर रहे हैं',
      opt_applied: 'आवेदन किया',
      opt_under_review: 'समीक्षाधीन',
      opt_approved: 'स्वीकृत',
      opt_rejected: 'अस्वीकृत',
      opt_completed: 'पूर्ण',

      // Vault modal
      vault_modal_title: 'दस्तावेज़ वॉल्ट',
      vault_modal_subtitle: 'छात्रवृत्ति सत्यापन के लिए आवश्यक प्रमाण पत्र सुरक्षित रखें (आधार, आय, जाति, मार्कशीट)। प्रत्येक फ़ाइल अधिकतम 5MB (PDF/PNG/JPG)।',
      vault_upload_heading: 'सत्यापित दस्तावेज़ अपलोड करें',
      lbl_doc_category: 'दस्तावेज़ श्रेणी',
      opt_aadhaar: 'आधार कार्ड',
      opt_income_cert: 'आय प्रमाण पत्र',
      opt_caste_cert: 'जाति प्रमाण पत्र',
      opt_domicile: 'अधिवास / निवास प्रमाण पत्र',
      opt_marksheet: 'मार्कशीट / ग्रेड कार्ड',
      opt_bank_passbook: 'बैंक पासबुक',
      opt_disability_cert: 'दिव्यांगता प्रमाण पत्र',
      opt_other_doc: 'अन्य दस्तावेज़',
      btn_choose_file: 'फ़ाइल चुनें',
      btn_upload_doc: '📤 वॉल्ट में अपलोड करें',
      vault_stored_heading: 'संग्रहीत दस्तावेज़',

      // Notifications modal
      notif_modal_title: 'सूचनाएँ',
      btn_mark_all_read: '✓ सभी पढ़ा गया चिह्नित करें',

      // Donation modal
      donation_modal_title: '❤️ स्कीम मैचर का समर्थन करें',
      donation_modal_subtitle: 'आपका योगदान अधिक छात्रों की सेवा, डेटा सटीकता बनाए रखने और राज्य-स्तरीय योजना कवरेज बढ़ाने में मदद करता है।',
      lbl_donor_name: 'पूरा नाम',
      lbl_donor_email: 'ईमेल पता',
      lbl_donor_amount: 'प्रतिज्ञा राशि (₹)',
      ph_donor_amount: 'उदा. 500',
      lbl_donor_pan: 'PAN नंबर (80G कर रसीद के लिए)',
      ph_donor_pan: 'AAAAA0000A',
      btn_donate: '❤️ सहयोग का वादा करें',

      // Volunteer modal
      volunteer_modal_title: '🤝 स्वयंसेवक बनें',
      volunteer_modal_subtitle: 'भारत भर में छात्रों को सरकारी कल्याण योजनाओं में मदद करने वाले स्वयंसेवकों के समुदाय में शामिल हों।',
      lbl_vol_name: 'पूरा नाम',
      lbl_vol_email: 'ईमेल पता',
      lbl_vol_phone: 'फोन नंबर',
      ph_vol_phone: '+91 98765 43210',
      lbl_vol_state: 'आपका राज्य',
      lbl_vol_interests: 'रुचि के क्षेत्र',
      opt_data_entry: 'योजना डेटा प्रविष्टि',
      opt_student_help: 'छात्र मार्गदर्शन',
      opt_translation: 'क्षेत्रीय भाषा अनुवाद',
      opt_tech: 'प्रौद्योगिकी / विकास',
      opt_outreach: 'सामुदायिक आउटरीच',
      lbl_vol_message: 'संक्षिप्त संदेश',
      ph_vol_message: 'अपने बारे में बताएँ और स्वयंसेवा करने का कारण...',
      btn_volunteer: '🤝 स्वयंसेवक आवेदन जमा करें',

      // Feedback modal
      feedback_modal_title: '💬 अपनी प्रतिक्रिया दें',
      feedback_modal_subtitle: 'भारत के छात्रों के लिए स्कीम मैचर को बेहतर बनाने में हमारी मदद करें।',
      lbl_rating: 'आपकी रेटिंग',
      lbl_feedback_msg: 'आपकी प्रतिक्रिया',
      ph_feedback_msg: 'बताएँ क्या अच्छा है, क्या सुधरे, या नई सुविधाएँ सुझाएँ...',
      btn_submit_feedback: '💬 प्रतिक्रिया जमा करें',

      // AI Chat / SchemeMitra
      ai_placeholder: 'SchemeMitra से पूछें... उदा. "OBC छात्राओं के लिए छात्रवृत्ति"',
      ai_send: 'भेजें',
      ai_voice_start: '🎙️',
      ai_voice_stop: '⏹️',
      ai_title: '🤖 SchemeMitra — AI व वॉयस सहायक',

      // Scheme cards
      scheme_ministry: 'मंत्रालय',
      scheme_benefit: 'लाभ',
      scheme_deadline: 'अंतिम तिथि',
      scheme_income_limit: 'आय सीमा',
      scheme_no_limit: 'कोई सीमा नहीं',
      scheme_apply: '🔗 अभी आवेदन करें',
      scheme_bookmark: '🔖 सहेजें',
      scheme_unbookmark: '📌 सहेजा हुआ',
      scheme_track: '📋 ट्रैक करें',
      scheme_eligible: '✅ पूर्णतः पात्र',
      scheme_partial: '⚠️ आंशिक मिलान',
      scheme_why: '📋 यह क्यों मिलता है',
      scheme_missing: '⚠️ अनुपस्थित मानदंड',

      // Common buttons
      btn_close: 'बंद करें',
      btn_save: 'सहेजें',
      btn_cancel: 'रद्द करें',
      btn_delete: 'हटाएँ',
      btn_edit: 'संपादित करें',
      btn_view: 'देखें',
      btn_download: '⬇ डाउनलोड',
      btn_refresh: 'रीफ्रेश करें',

      // Toast / alerts
      toast_saved: 'सफलतापूर्वक सहेजा गया!',
      toast_error: 'कुछ गलत हुआ। कृपया पुनः प्रयास करें।',
      toast_login_required: 'इस सुविधा का उपयोग करने के लिए कृपया साइन इन करें।',
      toast_bookmark_added: 'योजना बुकमार्क हो गई!',
      toast_bookmark_removed: 'बुकमार्क हटाया गया।',

      // Footer
      footer_text: '© 2026 स्कीम मैचर। भारत के लिए निर्मित।',
    },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  let currentLang = localStorage.getItem('scheme_lang') || 'en';

  // ─────────────────────────────────────────────────────────────────────────
  // CORE API
  // ─────────────────────────────────────────────────────────────────────────
  function t(key, vars) {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    let str = dict[key] || TRANSLATIONS.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
      });
    }
    return str;
  }

  function getLang() { return currentLang; }

  function setLang(lang) {
    if (!TRANSLATIONS[lang]) return;
    currentLang = lang;
    localStorage.setItem('scheme_lang', lang);
    document.documentElement.lang = lang;
    applyAll();
    // Fire custom event so app.js can react (re-render dynamic content)
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM TRANSLATION ENGINE
  // ─────────────────────────────────────────────────────────────────────────
  function applyAll() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translated = t(key);
      // Don't override children that are elements (e.g. badges inside buttons)
      if (el.children.length === 0) {
        el.textContent = translated;
      } else {
        // Only update text nodes, not child elements
        el.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = translated;
          }
        });
      }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    // Title attributes (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });

    // aria-label attributes
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });

    // Update lang toggle button active state
    const btnEn = document.getElementById('lang-btn-en');
    const btnHi = document.getElementById('lang-btn-hi');
    if (btnEn) btnEn.classList.toggle('active', currentLang === 'en');
    if (btnHi) btnHi.classList.toggle('active', currentLang === 'hi');

    // Update page title
    document.title = t('site_title_full');

    // Update html lang attribute
    document.documentElement.lang = currentLang;
    document.documentElement.setAttribute('data-lang', currentLang);

    // Font adjustments for Hindi (use a Devanagari-friendly stack)
    if (currentLang === 'hi') {
      document.body.classList.add('lang-hi');
    } else {
      document.body.classList.remove('lang-hi');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INJECT LANGUAGE SWITCHER INTO DOM
  // ─────────────────────────────────────────────────────────────────────────
  function injectLangSwitcher() {
    // Only inject once
    if (document.getElementById('lang-switcher')) return;

    const switcher = document.createElement('div');
    switcher.id = 'lang-switcher';
    switcher.className = 'lang-switcher';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Language switcher');
    switcher.innerHTML = `
      <button id="lang-btn-en" class="lang-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en" title="Switch to English">EN</button>
      <span class="lang-divider">|</span>
      <button id="lang-btn-hi" class="lang-btn ${currentLang === 'hi' ? 'active' : ''}" data-lang="hi" title="हिंदी में बदलें">हि</button>
    `;

    switcher.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
    });

    // Insert into header user-auth-area (before the existing content)
    const userAuthArea = document.getElementById('user-auth-area');
    if (userAuthArea) {
      userAuthArea.parentNode.insertBefore(switcher, userAuthArea);
    } else {
      // fallback: append to header
      const header = document.querySelector('.header-container') || document.querySelector('header');
      if (header) header.appendChild(switcher);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALISE
  // ─────────────────────────────────────────────────────────────────────────
  function init() {
    injectLangSwitcher();
    applyAll();
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  window.i18n = { t, getLang, setLang, applyAll };

})();
