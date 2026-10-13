/**
 * Message catalogues (Phase D).
 *
 * SCOPE: this covers interface chrome only — navigation, actions and system
 * state. It deliberately contains NO official, legal, procedural or
 * departmental wording, because none has been approved for translation. The
 * public information pages remain English until approved text and translations
 * are supplied.
 *
 * REVIEW STATUS:
 *   en  — reference catalogue, complete.
 *   ur  — draft translation, requires review by a native-speaking officer.
 *   ps  — draft translation (partial), requires native-speaker review.
 *   bal — draft translation (partial), requires native-speaker review.
 *
 * A key missing from a catalogue falls back to English, so no interface string
 * is ever empty. Nothing here is presented as an approved departmental
 * translation.
 */
import type { Locale } from "./config";

/** English reference catalogue. Every other locale falls back to this. */
export const EN_MESSAGES: Record<string, string> = {
  "app.name": "Transport Security",
  "app.subtitle": "Compliance System · Preview",
  "app.unapproved": "Unapproved development project",
  "app.synthetic": "Synthetic data only",
  "app.footer":
    "Balochistan Transport Security & Compliance Management System — development preview with synthetic data. Not an approved government service.",

  "shell.skipToContent": "Skip to main content",
  "shell.menu.open": "Open navigation menu",
  "shell.menu.close": "Close navigation menu",
  "shell.sidebar.collapse": "Collapse sidebar",
  "shell.sidebar.expand": "Expand sidebar",
  "shell.navLabel": "Main navigation",
  "shell.modulesLabel": "Modules",
  "shell.phase": "Phase {phase}",

  "nav.group.overview": "Overview",
  "nav.group.operations": "Operations",
  "nav.group.compliance": "Compliance",
  "nav.group.oversight": "Oversight",
  "nav.group.system": "System",

  "nav.dashboard": "Dashboard",
  "nav.operators": "Operators",
  "nav.vehicles": "Vehicles",
  "nav.routes": "Routes",
  "nav.permits": "Permits",
  "nav.trips": "Trips & Manifests",
  "nav.inspections": "CCTV & Inspections",
  "nav.incidents": "Incidents",
  "nav.reports": "Reports",
  "nav.audit": "Audit Trail",
  "nav.settings": "Users & Access",

  "action.signOut": "Sign out",
  "action.signingOut": "Signing out…",
  "action.language": "Language",
  "action.languageHelp":
    "Interface language. Non-English text is a draft awaiting review.",

  "state.notSignedIn": "Not signed in",
  "state.authenticated": "Authenticated",
  "state.provisionalTranslation": "Draft translation — pending review",
};

/**
 * Urdu draft. Terms chosen are common administrative vocabulary; a native
 * speaker must still confirm them before publication.
 */
export const UR_MESSAGES: Record<string, string> = {
  "app.name": "ٹرانسپورٹ سیکیورٹی",
  "app.subtitle": "کمپلائنس سسٹم · پیش نظارہ",
  "app.unapproved": "غیر منظور شدہ ترقیاتی منصوبہ",
  "app.synthetic": "صرف فرضی ڈیٹا",
  "shell.skipToContent": "مرکزی مواد پر جائیں",
  "shell.menu.open": "نیویگیشن مینو کھولیں",
  "shell.menu.close": "نیویگیشن مینو بند کریں",
  "shell.sidebar.collapse": "سائیڈبار سکیڑیں",
  "shell.sidebar.expand": "سائیڈبار پھیلائیں",
  "shell.navLabel": "مرکزی نیویگیشن",
  "shell.modulesLabel": "ماڈیولز",
  "shell.phase": "مرحلہ {phase}",

  "nav.group.overview": "جائزہ",
  "nav.group.operations": "کارروائیاں",
  "nav.group.compliance": "تعمیل",
  "nav.group.oversight": "نگرانی",
  "nav.group.system": "نظام",

  "nav.dashboard": "ڈیش بورڈ",
  "nav.operators": "آپریٹرز",
  "nav.vehicles": "گاڑیاں",
  "nav.routes": "روٹس",
  "nav.permits": "اجازت نامے",
  "nav.trips": "سفر اور مسافر فہرست",
  "nav.inspections": "سی سی ٹی وی اور معائنہ",
  "nav.incidents": "واقعات",
  "nav.reports": "رپورٹس",
  "nav.audit": "آڈٹ ٹریل",
  "nav.settings": "صارفین اور رسائی",

  "action.signOut": "سائن آؤٹ",
  "action.signingOut": "سائن آؤٹ ہو رہا ہے…",
  "action.language": "زبان",
  "state.notSignedIn": "سائن ان نہیں ہیں",
  "state.authenticated": "تصدیق شدہ",
  "state.provisionalTranslation": "مسودہ ترجمہ — جائزے کے لیے زیر التوا",
};

/** Pashto draft (partial). Falls back to English where a key is absent. */
export const PS_MESSAGES: Record<string, string> = {
  "app.name": "د ټرانسپورټ امنیت",
  "app.unapproved": "نه منل شوی پرمختیایي پروژه",
  "shell.skipToContent": "مرکزي منځپانګې ته ورشئ",
  "nav.group.overview": "کتنه",
  "nav.group.operations": "عملیات",
  "nav.group.system": "سیستم",
  "nav.dashboard": "ډشبورډ",
  "nav.operators": "چلونکي",
  "nav.vehicles": "موټرې",
  "nav.routes": "لارې",
  "nav.reports": "راپورونه",
  "action.signOut": "وتل",
  "action.language": "ژبه",
  "state.notSignedIn": "ننوتل شوي نه یاست",
};

/** Balochi draft (partial). Falls back to English where a key is absent. */
export const BAL_MESSAGES: Record<string, string> = {
  "app.name": "ٹرانسپورٹ سیکیورٹی",
  "app.unapproved": "منظور نہ بوتگین پروجہ",
  "shell.skipToContent": "سرکݔن مضمون ءَ برو",
  "nav.group.overview": "سرجہ",
  "nav.group.system": "سیسٹم",
  "nav.dashboard": "ڈیشبورڈ",
  "nav.operators": "چلاروک",
  "nav.vehicles": "گاڑی",
  "action.signOut": "دَرکَپ",
  "action.language": "زبان",
};

/** All catalogues keyed by locale. */
export const MESSAGES: Record<Locale, Record<string, string>> = {
  en: EN_MESSAGES,
  ur: UR_MESSAGES,
  ps: PS_MESSAGES,
  bal: BAL_MESSAGES,
};
