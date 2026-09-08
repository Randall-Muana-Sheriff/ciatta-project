require 'fileutils'
require 'xcodeproj'

root = File.expand_path(__dir__)
proj_path = File.join(root, 'CiattaUITest.xcodeproj')
FileUtils.rm_rf(proj_path)

project = Xcodeproj::Project.new(proj_path)
target = project.new_target(:ui_test_bundle, 'CiattaUITest', :ios, '16.4')
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.ciatta.uitest'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'YES'
  config.build_settings['CODE_SIGN_IDENTITY'] = '-'
  config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
  config.build_settings['DEVELOPMENT_TEAM'] = '8WDZ75627S'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['SDKROOT'] = 'iphonesimulator'
  config.build_settings['SUPPORTED_PLATFORMS'] = 'iphonesimulator'
  config.build_settings['TEST_TARGET_NAME'] = ''
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @loader_path/Frameworks'
end

group = project.main_group.new_group('CiattaUITest', 'CiattaUITest')
file = group.new_file('CiattaUITest.swift')
target.source_build_phase.add_file_reference(file)

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.set_launch_target(target)
test_action = scheme.test_action
test_action.should_use_launch_scheme_args_env = true
testable = Xcodeproj::XCScheme::TestAction::TestableReference.new(target)
test_action.add_testable(testable)
scheme.save_as(proj_path, 'CiattaUITest')

project.save
puts "wrote #{proj_path}"
