// Who she is beyond her body: gender and the language she speaks. Ciatta
// itself is in English for now; her language tells Ciatta, and anyone she
// shares her record with, what she would rather read and be spoken to in.

export const GENDERS = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
  { id: 'non_binary', label: 'Non binary' },
  { id: 'trans_woman', label: 'Transgender woman' },
  { id: 'trans_man', label: 'Transgender man' },
  { id: 'intersex', label: 'Intersex' },
  { id: 'another', label: 'Another identity' },
  { id: 'prefer_not', label: 'Prefer not to say' },
] as const;

export function genderLabel(id: string | null | undefined): string | null {
  return GENDERS.find((g) => g.id === id)?.label ?? null;
}

// First: English, then the most spoken languages worldwide.
export const POPULAR_LANGUAGES = [
  'English', 'Spanish', 'Mandarin Chinese', 'Hindi', 'Arabic', 'French', 'Portuguese', 'Bengali', 'Russian', 'Urdu',
  'Indonesian', 'German', 'Japanese', 'Swahili', 'Korean', 'Italian', 'Turkish', 'Vietnamese', 'Tagalog', 'Yoruba',
];

// Every language, A to Z, African languages included.
export const ALL_LANGUAGES = [
  'Acholi', 'Afar', 'Afrikaans', 'Akan', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Assamese', 'Aymara', 'Azerbaijani',
  'Bambara', 'Basque', 'Belarusian', 'Bemba', 'Bengali', 'Berber (Tamazight)', 'Bhojpuri', 'Bosnian', 'Breton', 'Bulgarian', 'Burmese',
  'Cantonese', 'Catalan', 'Cebuano', 'Chichewa', 'Croatian', 'Czech', 'Danish', 'Dari', 'Dinka', 'Dutch', 'Dzongkha',
  'Efik', 'English', 'Esperanto', 'Estonian', 'Ewe', 'Faroese', 'Fijian', 'Finnish', 'Fon', 'French', 'Fula', 'Ga',
  'Galician', 'Georgian', 'German', 'Greek', 'Guarani', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hawaiian', 'Hebrew',
  'Hindi', 'Hmong', 'Hungarian', 'Icelandic', 'Igbo', 'Ilocano', 'Indonesian', 'Irish', 'Italian', 'Japanese', 'Javanese',
  'Kalenjin', 'Kamba', 'Kannada', 'Kanuri', 'Kazakh', 'Khmer', 'Kikongo', 'Kikuyu', 'Kinyarwanda', 'Kirundi', 'Konkani',
  'Korean', 'Krio', 'Kurdish', 'Kyrgyz', 'Lao', 'Latin', 'Latvian', 'Lingala', 'Lithuanian', 'Luganda', 'Luhya', 'Luo',
  'Luxembourgish', 'Macedonian', 'Maithili', 'Malagasy', 'Malay', 'Malayalam', 'Maltese', 'Mandarin Chinese', 'Maori',
  'Marathi', 'Mende', 'Mongolian', 'Mossi', 'Ndebele', 'Nepali', 'Northern Sotho', 'Norwegian', 'Nuer', 'Odia', 'Oromo',
  'Pashto', 'Persian', 'Polish', 'Portuguese', 'Punjabi', 'Quechua', 'Romanian', 'Russian', 'Samoan', 'Sango', 'Sanskrit',
  'Scottish Gaelic', 'Serbian', 'Sesotho', 'Setswana', 'Shona', 'Sindhi', 'Sinhala', 'Slovak', 'Slovenian', 'Somali',
  'Spanish', 'Sundanese', 'Swahili', 'Swati', 'Swedish', 'Tagalog', 'Tahitian', 'Tajik', 'Tamil', 'Tatar', 'Telugu',
  'Temne', 'Thai', 'Tibetan', 'Tigrinya', 'Tiv', 'Tongan', 'Tsonga', 'Turkish', 'Turkmen', 'Twi', 'Ukrainian', 'Urdu',
  'Uyghur', 'Uzbek', 'Venda', 'Vietnamese', 'Welsh', 'Wolof', 'Xhosa', 'Yiddish', 'Yoruba', 'Zulu',
].sort((a, b) => a.localeCompare(b));
