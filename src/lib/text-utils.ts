// Text utilities for Arabic/Kurdish text normalization
// Handles differences between Arabic and Kurdish letters

// Map of Arabic letters to their Kurdish equivalents and vice versa
const arabicToKurdishMap: Record<string, string> = {
  // Common letter variations
  'ي': 'ی',  // Arabic Ya to Kurdish Ya
  'ك': 'ک',  // Arabic Kaf to Kurdish Kaf
  'ە': 'ه',  // Kurdish He to Arabic Ha
  'ھ': 'ه',  // Another He variant
  'ؤ': 'و',  // Arabic Waw with hamza to plain Waw
  'أ': 'ا',  // Alef with hamza above
  'إ': 'ا',  // Alef with hamza below
  'آ': 'ا',  // Alef with madda
  'ة': 'ه',  // Ta marbuta to Ha
  'ى': 'ی',  // Alef maksura to Kurdish Ya
};

const kurdishToArabicMap: Record<string, string> = {
  'ی': 'ي',  // Kurdish Ya to Arabic Ya
  'ک': 'ك',  // Kurdish Kaf to Arabic Kaf
};

// All possible variations of each character for searching
const allVariations: Record<string, string[]> = {
  'ی': ['ی', 'ي', 'ى'],
  'ي': ['ی', 'ي', 'ى'],
  'ى': ['ی', 'ي', 'ى'],
  'ک': ['ک', 'ك'],
  'ك': ['ک', 'ك'],
  'ه': ['ه', 'ە', 'ھ', 'ة'],
  'ە': ['ه', 'ە', 'ھ', 'ة'],
  'ھ': ['ه', 'ە', 'ھ', 'ة'],
  'ة': ['ه', 'ە', 'ھ', 'ة'],
  'ا': ['ا', 'أ', 'إ', 'آ'],
  'أ': ['ا', 'أ', 'إ', 'آ'],
  'إ': ['ا', 'أ', 'إ', 'آ'],
  'آ': ['ا', 'أ', 'إ', 'آ'],
  'و': ['و', 'ؤ'],
  'ؤ': ['و', 'ؤ'],
};

/**
 * Normalize Arabic/Kurdish text to a standard form for comparison
 * Converts all variants to a single canonical form
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  
  let normalized = text;
  
  // Apply Arabic to Kurdish mapping
  for (const [arabic, kurdish] of Object.entries(arabicToKurdishMap)) {
    normalized = normalized.replace(new RegExp(arabic, 'g'), kurdish);
  }
  
  // Remove diacritics (tashkeel)
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, '');
  
  // Remove zero-width characters
  normalized = normalized.replace(/[\u200B-\u200F\u202A-\u202E]/g, '');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Create a search pattern that matches all variations of Arabic/Kurdish letters
 * Returns a regex pattern string
 */
export function createSearchPattern(query: string): string {
  if (!query) return '';
  
  let pattern = '';
  
  for (const char of query) {
    const variations = allVariations[char];
    if (variations) {
      pattern += `[${variations.join('')}]`;
    } else {
      // Escape special regex characters
      pattern += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  
  return pattern;
}

/**
 * Check if text contains the search query (with variations)
 */
export function textContains(text: string, query: string): boolean {
  if (!text || !query) return false;
  
  const normalizedText = normalizeText(text.toLowerCase());
  const normalizedQuery = normalizeText(query.toLowerCase());
  
  // First try simple contains
  if (normalizedText.includes(normalizedQuery)) {
    return true;
  }
  
  // Try with regex pattern for variations
  try {
    const pattern = createSearchPattern(normalizedQuery);
    const regex = new RegExp(pattern, 'i');
    return regex.test(normalizedText);
  } catch {
    return false;
  }
}

/**
 * Search students by name with Arabic/Kurdish letter variation support
 */
export function searchName(name: string, query: string): boolean {
  return textContains(name, query);
}

/**
 * Format date range for display (1/1/2026 to 1/7/2026)
 */
export function formatDateRange(start: Date, end: Date): string {
  const formatDate = (d: Date) => {
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };
  return `${formatDate(start)} - ${formatDate(end)}`;
}

// NOTE: For subscription period calculations and pricing, 
// use the functions in billing.ts to ensure consistent pricing logic.
