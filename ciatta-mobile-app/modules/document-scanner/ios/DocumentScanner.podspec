Pod::Spec.new do |s|
  s.name           = 'DocumentScanner'
  s.version        = '1.0.0'
  s.summary        = 'Apple document camera for scanning lab reports in Ciatta'
  s.description    = 'Wraps VNDocumentCameraViewController and returns the scanned pages as one PDF.'
  s.author         = 'Ciatta'
  s.homepage       = 'https://www.ciatta.io'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'VisionKit', 'PDFKit'
  s.source_files   = '**/*.{h,m,swift}'
end
