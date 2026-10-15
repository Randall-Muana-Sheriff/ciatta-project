import ExpoModulesCore
import PDFKit
import UIKit
import VisionKit

// Apple's document camera, returning the pages as one PDF in the cache.
// Pages are downscaled and recompressed so a several page report stays
// small enough to send to be read.
public class DocumentScannerModule: Module {
  private var session: ScanSession?

  public func definition() -> ModuleDefinition {
    Name("DocumentScanner")

    Function("isAvailable") { () -> Bool in
      VNDocumentCameraViewController.isSupported
    }

    AsyncFunction("scan") { (promise: Promise) in
      guard VNDocumentCameraViewController.isSupported else {
        promise.resolve(nil)
        return
      }
      // One scanner at a time: a second call would replace the session the
      // open camera reports to, and its Save and Cancel would do nothing.
      guard self.session == nil else {
        promise.reject("E_BUSY", "The scanner is already open")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("E_NO_VIEW", "There is no screen to show the scanner on")
        return
      }
      let session = ScanSession(promise: promise) { [weak self] in self?.session = nil }
      self.session = session
      let camera = VNDocumentCameraViewController()
      camera.delegate = session
      presenter.present(camera, animated: true)
    }.runOnQueue(.main)
  }
}

final class ScanSession: NSObject, VNDocumentCameraViewControllerDelegate {
  private let promise: Promise
  private let finished: () -> Void

  init(promise: Promise, finished: @escaping () -> Void) {
    self.promise = promise
    self.finished = finished
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
    controller.dismiss(animated: true) {
      // Built off the main thread, one page at a time, each page's images
      // released before the next, so a long scan neither freezes the screen
      // nor holds every full size page in memory at once.
      DispatchQueue.global(qos: .userInitiated).async {
        let pdf = PDFDocument()
        for index in 0..<scan.pageCount {
          autoreleasepool {
            if let page = PDFPage(image: Self.compressed(scan.imageOfPage(at: index))) {
              pdf.insert(page, at: pdf.pageCount)
            }
          }
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("lab-scan-\(UUID().uuidString).pdf")
        let written = pdf.pageCount > 0 && pdf.write(to: url)
        DispatchQueue.main.async {
          if written {
            self.promise.resolve(["uri": url.absoluteString, "pages": pdf.pageCount])
          } else {
            self.promise.reject("E_WRITE", "The scan could not be saved")
          }
          self.finished()
        }
      }
    }
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true) {
      self.promise.resolve(nil)
      self.finished()
    }
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    controller.dismiss(animated: true) {
      self.promise.reject("E_SCAN", "The scanner stopped")
      self.finished()
    }
  }

  // Wide enough for small print, small enough to send.
  private static func compressed(_ image: UIImage) -> UIImage {
    let maxWidth: CGFloat = 1700
    let scale = min(1, maxWidth / max(image.size.width, 1))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let resized = UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    guard let data = resized.jpegData(compressionQuality: 0.6), let out = UIImage(data: data) else { return resized }
    return out
  }
}
