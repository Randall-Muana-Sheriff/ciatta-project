// Every other quantity type HealthKit exposes, generated from the library's
// own identifier list rather than typed out.
//
// Ciatta reads all of them. The twelve in healthMetrics.ts stay exactly as
// they are: they carry hand checked units and the four that fold into a row
// of daily_metrics, and renaming or re-unitting any of them would orphan the
// observations already stored against those names.
//
// Three things make reading a hundred and ten unreviewed metrics safe:
//
//   No unit is named. HealthKit picks the unit for the type and the returned
//   sample reports which it picked, so the unit stored is always the unit the
//   value is actually in. A hand written unit table of this size would be
//   wrong somewhere, and a number stored under the wrong unit is worse than
//   no number at all.
//
//   None of them folds into daily_metrics. They are stored as observations
//   and nothing derives a daily figure from them, so fold is unused here and
//   set to mean throughout rather than guessed per metric.
//
//   The metric names are generated from the identifiers, and a test asserts
//   none of them collides with the twelve. A collision would merge two
//   different readings into one series, which is the one mistake here that
//   could not be undone.
//
// To regenerate, see the note in healthMetrics.test.ts.

import type { MetricSpec } from './healthMetrics';

export const EXTRA_QUANTITY_SPECS: readonly MetricSpec[] = [
  { identifier: 'HKQuantityTypeIdentifierAppleMoveTime', metric: 'apple_move_time', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierAppleStandTime', metric: 'apple_stand_time', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierAppleWalkingSteadiness', metric: 'apple_walking_steadiness', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBasalEnergyBurned', metric: 'basal_energy_burned', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierCrossCountrySkiingSpeed', metric: 'cross_country_skiing_speed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierCyclingCadence', metric: 'cycling_cadence', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierCyclingFunctionalThresholdPower', metric: 'cycling_functional_threshold_power', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierCyclingPower', metric: 'cycling_power', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierCyclingSpeed', metric: 'cycling_speed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistanceCrossCountrySkiing', metric: 'distance_cross_country_skiing', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistanceCycling', metric: 'distance_cycling', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistanceDownhillSnowSports', metric: 'distance_downhill_snow_sports', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistancePaddleSports', metric: 'distance_paddle_sports', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistanceRowing', metric: 'distance_rowing', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistanceSkatingSports', metric: 'distance_skating_sports', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistanceSwimming', metric: 'distance_swimming', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistanceWalkingRunning', metric: 'distance_walking_running', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDistanceWheelchair', metric: 'distance_wheelchair', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierEstimatedWorkoutEffortScore', metric: 'estimated_workout_effort_score', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierFlightsClimbed', metric: 'flights_climbed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierNikeFuel', metric: 'nike_fuel', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierPaddleSportsSpeed', metric: 'paddle_sports_speed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierPhysicalEffort', metric: 'physical_effort', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierPushCount', metric: 'push_count', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierRowingSpeed', metric: 'rowing_speed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierRunningGroundContactTime', metric: 'running_ground_contact_time', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierRunningPower', metric: 'running_power', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierRunningSpeed', metric: 'running_speed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierRunningStrideLength', metric: 'running_stride_length', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierRunningVerticalOscillation', metric: 'running_vertical_oscillation', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierSixMinuteWalkTestDistance', metric: 'six_minute_walk_test_distance', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierStairAscentSpeed', metric: 'stair_ascent_speed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierStairDescentSpeed', metric: 'stair_descent_speed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierSwimmingStrokeCount', metric: 'swimming_stroke_count', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierUnderwaterDepth', metric: 'underwater_depth', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierWalkingAsymmetryPercentage', metric: 'walking_asymmetry_percentage', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage', metric: 'walking_double_support_percentage', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierWalkingSpeed', metric: 'walking_speed', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierWalkingStepLength', metric: 'walking_step_length', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierWorkoutEffortScore', metric: 'workout_effort_score', domain: 'activity', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierNumberOfTimesFallen', metric: 'number_of_times_fallen', domain: 'behaviour', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBodyFatPercentage', metric: 'body_fat_percentage', domain: 'body', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBodyMass', metric: 'body_mass', domain: 'body', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBodyMassIndex', metric: 'body_mass_index', domain: 'body', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierHeight', metric: 'height', domain: 'body', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierLeanBodyMass', metric: 'lean_body_mass', domain: 'body', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierWaistCircumference', metric: 'waist_circumference', domain: 'body', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierEnvironmentalAudioExposure', metric: 'environmental_audio_exposure', domain: 'environment', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierEnvironmentalSoundReduction', metric: 'environmental_sound_reduction', domain: 'environment', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierHeadphoneAudioExposure', metric: 'headphone_audio_exposure', domain: 'environment', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierTimeInDaylight', metric: 'time_in_daylight', domain: 'environment', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryBiotin', metric: 'dietary_biotin', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryCaffeine', metric: 'dietary_caffeine', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryCalcium', metric: 'dietary_calcium', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryCarbohydrates', metric: 'dietary_carbohydrates', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryChloride', metric: 'dietary_chloride', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryCholesterol', metric: 'dietary_cholesterol', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryChromium', metric: 'dietary_chromium', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryCopper', metric: 'dietary_copper', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryEnergyConsumed', metric: 'dietary_energy_consumed', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryFatMonounsaturated', metric: 'dietary_fat_monounsaturated', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryFatPolyunsaturated', metric: 'dietary_fat_polyunsaturated', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryFatSaturated', metric: 'dietary_fat_saturated', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryFatTotal', metric: 'dietary_fat_total', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryFiber', metric: 'dietary_fiber', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryFolate', metric: 'dietary_folate', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryIodine', metric: 'dietary_iodine', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryIron', metric: 'dietary_iron', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryMagnesium', metric: 'dietary_magnesium', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryManganese', metric: 'dietary_manganese', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryMolybdenum', metric: 'dietary_molybdenum', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryNiacin', metric: 'dietary_niacin', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryPantothenicAcid', metric: 'dietary_pantothenic_acid', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryPhosphorus', metric: 'dietary_phosphorus', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryPotassium', metric: 'dietary_potassium', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryProtein', metric: 'dietary_protein', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryRiboflavin', metric: 'dietary_riboflavin', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietarySelenium', metric: 'dietary_selenium', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietarySodium', metric: 'dietary_sodium', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietarySugar', metric: 'dietary_sugar', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryThiamin', metric: 'dietary_thiamin', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryVitaminA', metric: 'dietary_vitamin_a', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryVitaminB12', metric: 'dietary_vitamin_b12', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryVitaminB6', metric: 'dietary_vitamin_b6', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryVitaminC', metric: 'dietary_vitamin_c', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryVitaminD', metric: 'dietary_vitamin_d', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryVitaminE', metric: 'dietary_vitamin_e', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryVitaminK', metric: 'dietary_vitamin_k', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryWater', metric: 'dietary_water', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierDietaryZinc', metric: 'dietary_zinc', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierWaterTemperature', metric: 'water_temperature', domain: 'nutrition', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierUVExposure', metric: 'uv_exposure', domain: 'other', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierVO2Max', metric: 'vo2_max', domain: 'other', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances', metric: 'apple_sleeping_breathing_disturbances', domain: 'sleep', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierAtrialFibrillationBurden', metric: 'atrial_fibrillation_burden', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBloodAlcoholContent', metric: 'blood_alcohol_content', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBloodGlucose', metric: 'blood_glucose', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBloodPressureDiastolic', metric: 'blood_pressure_diastolic', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBloodPressureSystolic', metric: 'blood_pressure_systolic', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierBodyTemperature', metric: 'body_temperature', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierElectrodermalActivity', metric: 'electrodermal_activity', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierForcedExpiratoryVolume1', metric: 'forced_expiratory_volume1', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierForcedVitalCapacity', metric: 'forced_vital_capacity', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute', metric: 'heart_rate_recovery_one_minute', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierInhalerUsage', metric: 'inhaler_usage', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierInsulinDelivery', metric: 'insulin_delivery', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierNumberOfAlcoholicBeverages', metric: 'number_of_alcoholic_beverages', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierPeakExpiratoryFlowRate', metric: 'peak_expiratory_flow_rate', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierPeripheralPerfusionIndex', metric: 'peripheral_perfusion_index', domain: 'vitals', fold: 'mean' },
  { identifier: 'HKQuantityTypeIdentifierWalkingHeartRateAverage', metric: 'walking_heart_rate_average', domain: 'vitals', fold: 'mean' },
];
