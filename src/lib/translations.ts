// Kurdish Sorani (کوردی سۆرانی) Translations
// RTL Language

export const ku = {
  // App
  appName: "اقرأ - لقی هەولێر",
  appTitle: "سیستەمی بەڕێوەبردنی بەشداریکردن",
  
  // Navigation
  nav: {
    dashboard: "داشبۆرد",
    students: "قوتابیان",
    myStudents: "قوتابیانی من",
    allStudents: "هەموو قوتابیان",
    payments: "پارەدانەکان",
    admins: "بەڕێوەبەران",
    settings: "ڕێکخستنەکان",
    reports: "ڕاپۆرتەکان",
    books: "کتێبەکان",
    manageBooks: "بەڕێوەبردنی کتێب",
    logout: "دەرچوون",
  },

  // Class Times
  classTimes: {
    title: "کاتی پۆل",
    saturday_morning: "شەممە بەیانی",
    saturday_evening: "شەممە ئێوارە",
    saturday_night: "شەممە شەو",
    monday_evening: "دووشەممە ئێوارە",
    tuesday_night: "سێشەممە شەو",
    wednesday_evening: "چوارشەممە ئێوارە",
    wednesday_night: "چوارشەممە شەو",
    thursday_night: "پێنجشەممە شەو",
    assignedClasses: "پۆلە دیاریکراوەکان",
    selectClasses: "پۆلەکان هەڵبژێرە",
    noClassAssigned: "هیچ پۆلێک دیاری نەکراوە",
  },

  // Auth
  auth: {
    login: "چوونەژوورەوە",
    email: "ئیمەیڵ",
    password: "وشەی نهێنی",
    loginButton: "چوونەژوورەوە",
    loggingIn: "چوونەژوورەوە...",
    loginError: "ئیمەیڵ یان وشەی نهێنی هەڵەیە",
    welcome: "بەخێربێیت بۆ اقرأ - لقی هەولێر",
    subtitle: "سیستەمی بەڕێوەبردنی بەشداریکردنی قوتابیان",
  },

  // Dashboard
  dashboard: {
    title: "داشبۆرد",
    totalStudents: "کۆی قوتابیان",
    myStudents: "قوتابیانی من",
    maleStudents: "کوڕان",
    femaleStudents: "کچان",
    todayPayments: "پارەدانی ئەمڕۆ",
    todayCollection: "کۆکراوەی ئەمڕۆ",
    unpaidStudents: "نەدراوەکان",
    unpaidInMyClasses: "نەدراوەکان لە پۆلەکانم",
    recentPayments: "پارەدانە تازەکان",
    downloadCSV: "داگرتنی CSV",
    downloadAll: "داگرتنی هەموو",
    collectionByAdmin: "کۆکراوە بەپێی بەڕێوەبەر",
    collectionByPeriod: "کۆکراوە بەپێی ماوە",
    periodCollection: "کۆکراوە بەپێی ماوە",
    lastWeek: "هەفتەی ڕابردوو",
    lastMonth: "مانگی ڕابردوو",
    allTime: "هەموو کات",
    periodStart: "دەستپێکی ماوە",
    periodEnd: "کۆتایی ماوە",
  },

  // Students
  students: {
    title: "قوتابیان",
    myStudents: "قوتابیانی من",
    allStudents: "هەموو قوتابیان",
    addStudent: "زیادکردنی قوتابی",
    editStudent: "دەستکاریکردنی قوتابی",
    deleteStudent: "سڕینەوەی قوتابی",
    importCsv: "هاوردەکردنی فایلی CSV",
    exportCsv: "هەناردەکردنی فایلی CSV",
    bulkAdd: "زیادکردنی کۆمەڵ",
    bulkDelete: "سڕینەوەی کۆمەڵ",
    search: "گەڕان...",
    name: "ناو",
    fullName: "ناوی سیانی",
    gender: "ڕەگەز",
    male: "کوڕ",
    female: "کچ",
    birthYear: "ساڵی لەدایکبوون",
    address: "ناونیشان",
    phone: "ژمارەی مۆبایل",
    financialStatus: "بارى دارايى",
    classGroup: "پۆل",
    classTime: "کاتی پۆل",
    joinDate: "بەرواری تۆمارکردن",
    status: "بار",
    active: "چالاک",
    inactive: "ناچالاک",
    notes: "تێبینی",
    actions: "کردارەکان",
    noStudents: "هیچ قوتابییەک نییە",
    confirmDelete: "دڵنیایت لە سڕینەوەی ئەم قوتابییە؟",
    studentAdded: "قوتابی زیادکرا",
    studentUpdated: "قوتابی نوێکرایەوە",
    studentDeleted: "قوتابی سڕایەوە",
    selectGender: "ڕەگەز هەڵبژێرە",
    selectClassTime: "کاتی پۆل هەڵبژێرە",
    all: "هەموو",
    total: "کۆی گشتی",
    paidStatus: "دراوە",
    unpaidStatus: "نەدراوە",
    downloadInfo: "داگرتنی زانیاری",
    billingPreference: "جۆری پارەدان",
    semesterBilling: "وەرزی",
    monthlyBilling: "مانگانە",
  },

  // Payments
  payments: {
    title: "پارەدانەکان",
    recordPayment: "تۆمارکردنی پارەدان",
    newPayment: "پارەدانی نوێ",
    amount: "بڕی پارە",
    date: "بەروار",
    student: "قوتابی",
    type: "جۆر",
    single: "تاک",
    sibling: "خوشک و برا (6 مانگ)",
    siblingGroup: "خوشک و برا",
    monthly: "مانگانە",
    donation: "بەخشین",
    scholarship: "بورسیە",
    siblingNames: "ناوی خوشک و برا",
    selectSibling: "خوشک/برا هەڵبژێرە",
    siblingStudent: "قوتابی خوشک/برا",
    notes: "تێبینی",
    recordedBy: "تۆمارکراوە لەلایەن",
    periodStart: "دەستپێکی ماوە",
    periodEnd: "کۆتایی ماوە",
    months: "مانگ",
    paymentRecorded: "پارەدان تۆمارکرا",
    noPayments: "هیچ پارەدانێک نییە",
    void: "هەڵوەشاندنەوە",
    voidPayment: "هەڵوەشاندنەوەی پارەدان",
    voidReason: "هۆکاری هەڵوەشاندنەوە",
    confirmVoid: "دڵنیایت لە هەڵوەشاندنەوەی ئەم پارەدانە؟",
    voided: "هەڵوەشێنراوە",
    selectStudent: "قوتابی هەڵبژێرە",
    searchStudent: "ناوی قوتابی بنووسە...",
    amountPlaceholder: "بۆ نمونە: 25000",
    paymentTypes: {
      single: "پارەدانی تاک",
      family: "پارەدانی خوشک و برا",
      donation: "بەخشین",
      book: "فرۆشتنی کتێب",
    },
    today: "ئەمڕۆ",
    thisWeek: "ئەم هەفتەیە",
    thisMonth: "ئەم مانگە",
    total: "کۆی گشتی",
    totalForTwo: "کۆی بۆ دوو قوتابی",
  },

  // Admins
  admins: {
    title: "بەڕێوەبەران",
    addAdmin: "زیادکردنی بەڕێوەبەر",
    editAdmin: "دەستکاریکردنی بەڕێوەبەر",
    deleteAdmin: "سڕینەوەی بەڕێوەبەر",
    fullName: "ناوی تەواو",
    email: "ئیمەیڵ",
    password: "وشەی نهێنی",
    role: "ڕۆڵ",
    admin: "بەڕێوەبەر",
    adminView: "بەڕێوەبەر (بینین)",
    superAdmin: "سەرپەرشتیار",
    superAdminView: "سەرپەرشتیار (بینین)",
    lastLogin: "دوایین چوونەژوورەوە",
    active: "چالاک",
    inactive: "ناچالاک",
    status: "بار",
    assignedClasses: "پۆلە دیاریکراوەکان",
    noAdmins: "هیچ بەڕێوەبەرێک نییە",
    confirmDelete: "دڵنیایت لە سڕینەوەی ئەم بەڕێوەبەرە؟",
    onlySuperAdmin: "تەنها سەرپەرشتیار دەتوانێت بەڕێوەبەر زیادبکات",
    activate: "چالاککردن",
    deactivate: "ناچالاککردن",
    changeRole: "گۆڕینی ڕۆڵ",
    todayCollection: "کۆکراوەی ئەمڕۆ",
    resetPassword: "ڕیسێتی وشەی نهێنی",
    manageClasses: "بەڕێوەبردنی پۆلەکان",
    addClass: "زیادکردنی پۆل",
    deleteClass: "سڕینەوەی پۆل",
  },

  // Common
  common: {
    save: "پاشەکەوتکردن",
    cancel: "هەڵوەشاندنەوە",
    delete: "سڕینەوە",
    edit: "دەستکاری",
    add: "زیادکردن",
    close: "داخستن",
    confirm: "دڵنیاکردنەوە",
    yes: "بەڵێ",
    no: "نەخێر",
    loading: "...چاوەڕوانبە",
    error: "هەڵە",
    success: "سەرکەوتوو بوو",
    required: "پێویستە",
    optional: "ئارەزوومەندانە",
    noData: "هیچ داتایەک نییە",
    actions: "کردارەکان",
    filter: "فلتەر",
    search: "گەڕان",
    clear: "پاککردنەوە",
    selectAll: "هەڵبژاردنی هەموو",
    deselectAll: "لادانی هەموو",
    selected: "هەڵبژێردراو",
    of: "لە",
    items: "بڕگە",
    page: "پەڕە",
    next: "دواتر",
    previous: "پێشتر",
    first: "یەکەم",
    last: "کۆتایی",
    showing: "پیشاندانی",
    to: "تا",
    from: "لە",
    iqd: "دینار",
    today: "ئەمڕۆ",
    view: "بینین",
  },

  // CSV Import
  csv: {
    title: "هاوردەکردنی قوتابیان لە CSV",
    selectFile: "فایل هەڵبژێرە",
    dragDrop: "فایل ڕابکێشە بۆ ئێرە یان کلیک بکە",
    preview: "پێشبینین",
    import: "هاوردەکردن",
    importing: "هاوردەکردن...",
    success: "سەرکەوتوانە هاوردەکرا",
    error: "هەڵەیەک ڕوویدا لە هاوردەکردندا",
    rowsImported: "قوتابی هاوردەکرا",
    skipDuplicates: "تێپەڕاندنی دووبارەکان",
    mappingColumns: "نەخشەکردنی ستوونەکان",
    csvColumn: "ستوونی CSV",
    systemField: "بواری سیستەم",
  },

  // Errors
  errors: {
    generic: "هەڵەیەک ڕوویدا",
    notFound: "نەدۆزرایەوە",
    unauthorized: "مۆڵەتت نییە",
    network: "هەڵەی تۆڕ",
    validation: "داتا دروست نییە",
    required: "ئەم بوارە پێویستە",
    invalidEmail: "ئیمەیڵ دروست نییە",
  },

  // Time
  time: {
    justNow: "ئێستا",
    minutesAgo: "خولەک لەمەوپێش",
    hoursAgo: "کاتژمێر لەمەوپێش",
    daysAgo: "ڕۆژ لەمەوپێش",
  },
};

// Export as default
export default ku;

// Helper function to format IQD currency with English numerals
export function formatIQD(amount: number): string {
  return `${amount.toLocaleString("en-US")} د.ع`;
}

// Helper function to format date in Kurdish with English numerals
export function formatDateKu(date: Date | string): string {
  const d = new Date(date);
  // Format with English numerals but Kurdish month names
  const day = d.getDate();
  const year = d.getFullYear();
  
  const kurdishMonths = [
    'کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران',
    'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'
  ];
  const month = kurdishMonths[d.getMonth()];
  
  return `${day} ${month} ${year}`;
}

// Helper for relative time
export function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return ku.time.justNow;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${ku.time.minutesAgo}`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${ku.time.hoursAgo}`;
  
  const days = Math.floor(hours / 24);
  return `${days} ${ku.time.daysAgo}`;
}
