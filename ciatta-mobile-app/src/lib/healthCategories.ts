// Every category type HealthKit exposes, generated from the library's own
// identifier list. Sleep is not here: it has its own spec and its own stage
// folding in healthMetrics.ts.
//
// Category samples are not measurements. Each one is a coded value whose
// meaning depends on its type: for menstrual flow the codes run unspecified,
// light, medium, heavy, none; for a symptom they run present or absent. The
// code is stored as given and nothing here maps it, because a wrong mapping
// would put a reading in her record that she never gave. Mapping is a later
// task with its own tests, one type at a time.
//
// Thirteen of these are women's health types that a women's health app had
// no business not reading: menstrual flow, cervical mucus, ovulation and
// pregnancy tests, lactation, contraceptive.

export type CategorySpec = { identifier: string; metric: string; domain: string };

export const CATEGORY_SPECS: readonly CategorySpec[] = [
  { identifier: 'HKCategoryTypeIdentifierAppleStandHour', metric: 'apple_stand_hour', domain: 'behaviour' },
  { identifier: 'HKCategoryTypeIdentifierHandwashingEvent', metric: 'handwashing_event', domain: 'behaviour' },
  { identifier: 'HKCategoryTypeIdentifierMindfulSession', metric: 'mindful_session', domain: 'behaviour' },
  { identifier: 'HKCategoryTypeIdentifierSleepApneaEvent', metric: 'sleep_apnea_event', domain: 'behaviour' },
  { identifier: 'HKCategoryTypeIdentifierToothbrushingEvent', metric: 'toothbrushing_event', domain: 'behaviour' },
  { identifier: 'HKCategoryTypeIdentifierAudioExposureEvent', metric: 'audio_exposure_event', domain: 'environment' },
  { identifier: 'HKCategoryTypeIdentifierEnvironmentalAudioExposureEvent', metric: 'environmental_audio_exposure_event', domain: 'environment' },
  { identifier: 'HKCategoryTypeIdentifierHeadphoneAudioExposureEvent', metric: 'headphone_audio_exposure_event', domain: 'environment' },
  { identifier: 'HKCategoryTypeIdentifierBleedingAfterPregnancy', metric: 'bleeding_after_pregnancy', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierBleedingDuringPregnancy', metric: 'bleeding_during_pregnancy', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierCervicalMucusQuality', metric: 'cervical_mucus_quality', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierContraceptive', metric: 'contraceptive', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierInfrequentMenstrualCycles', metric: 'infrequent_menstrual_cycles', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierIntermenstrualBleeding', metric: 'intermenstrual_bleeding', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierIrregularMenstrualCycles', metric: 'irregular_menstrual_cycles', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierLactation', metric: 'lactation', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierMenstrualFlow', metric: 'menstrual_flow', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierOvulationTestResult', metric: 'ovulation_test_result', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierPersistentIntermenstrualBleeding', metric: 'persistent_intermenstrual_bleeding', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierPregnancy', metric: 'pregnancy', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierPregnancyTestResult', metric: 'pregnancy_test_result', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierProgesteroneTestResult', metric: 'progesterone_test_result', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierProlongedMenstrualPeriods', metric: 'prolonged_menstrual_periods', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierSexualActivity', metric: 'sexual_activity', domain: 'reproductive' },
  { identifier: 'HKCategoryTypeIdentifierAbdominalCramps', metric: 'abdominal_cramps', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierAcne', metric: 'acne', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierAppetiteChanges', metric: 'appetite_changes', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierBladderIncontinence', metric: 'bladder_incontinence', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierBloating', metric: 'bloating', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierBreastPain', metric: 'breast_pain', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierChestTightnessOrPain', metric: 'chest_tightness_or_pain', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierChills', metric: 'chills', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierConstipation', metric: 'constipation', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierCoughing', metric: 'coughing', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierDiarrhea', metric: 'diarrhea', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierDizziness', metric: 'dizziness', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierDrySkin', metric: 'dry_skin', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierFainting', metric: 'fainting', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierFatigue', metric: 'fatigue', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierFever', metric: 'fever', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierGeneralizedBodyAche', metric: 'generalized_body_ache', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierHairLoss', metric: 'hair_loss', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierHeadache', metric: 'headache', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierHeartburn', metric: 'heartburn', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierHotFlashes', metric: 'hot_flashes', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierHypertensionEvent', metric: 'hypertension_event', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierLossOfSmell', metric: 'loss_of_smell', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierLossOfTaste', metric: 'loss_of_taste', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierLowerBackPain', metric: 'lower_back_pain', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierMemoryLapse', metric: 'memory_lapse', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierMoodChanges', metric: 'mood_changes', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierNausea', metric: 'nausea', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierNightSweats', metric: 'night_sweats', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierPelvicPain', metric: 'pelvic_pain', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierRapidPoundingOrFlutteringHeartbeat', metric: 'rapid_pounding_or_fluttering_heartbeat', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierRunnyNose', metric: 'runny_nose', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierShortnessOfBreath', metric: 'shortness_of_breath', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierSinusCongestion', metric: 'sinus_congestion', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierSkippedHeartbeat', metric: 'skipped_heartbeat', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierSleepChanges', metric: 'sleep_changes', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierSoreThroat', metric: 'sore_throat', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierVaginalDryness', metric: 'vaginal_dryness', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierVomiting', metric: 'vomiting', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierWheezing', metric: 'wheezing', domain: 'symptoms' },
  { identifier: 'HKCategoryTypeIdentifierAppleWalkingSteadinessEvent', metric: 'apple_walking_steadiness_event', domain: 'vitals' },
  { identifier: 'HKCategoryTypeIdentifierHighHeartRateEvent', metric: 'high_heart_rate_event', domain: 'vitals' },
  { identifier: 'HKCategoryTypeIdentifierIrregularHeartRhythmEvent', metric: 'irregular_heart_rhythm_event', domain: 'vitals' },
  { identifier: 'HKCategoryTypeIdentifierLowCardioFitnessEvent', metric: 'low_cardio_fitness_event', domain: 'vitals' },
  { identifier: 'HKCategoryTypeIdentifierLowHeartRateEvent', metric: 'low_heart_rate_event', domain: 'vitals' },
];
