import XCTest

final class CiattaUITest: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "com.ciatta.mobileapp")
  let outDir = "/Users/jennifermaxwell/Desktop/Ciatta1/ciatta-project/ciatta-mobile-app/.tmp-verify"
  let scriptPath = "/Users/jennifermaxwell/Desktop/Ciatta1/ciatta-project/ciatta-mobile-app/.tmp-verify/ui-script.txt"

  override func setUpWithError() throws {
    continueAfterFailure = true
  }

  func testRunScript() throws {
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    addUIInterruptionMonitor(withDescription: "system") { alert in
      for label in ["Allow", "Allow While Using App", "Allow Once", "OK", "Don’t Allow", "Don't Allow", "Not Now"] {
        let btn = alert.buttons[label]
        if btn.exists {
          btn.tap()
          return true
        }
      }
      return false
    }

    guard FileManager.default.fileExists(atPath: scriptPath) else {
      XCTFail("Missing script at \(scriptPath)")
      return
    }
    let raw = try String(contentsOfFile: scriptPath, encoding: .utf8)
    log("SCRIPT START")
    for (i, line) in raw.split(separator: "\n", omittingEmptySubsequences: false).enumerated() {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
      log("CMD \(i): \(trimmed)")
      runCommand(trimmed, spring: spring)
    }
    shot("script-end")
    log("SCRIPT END")
  }

  func runCommand(_ line: String, spring: XCUIApplication) {
    let parts = splitOnce(line)
    let cmd = parts.0
    let rest = parts.1
    switch cmd {
    case "launch":
      app.launch()
    case "activate":
      if app.state == .notRunning { app.launch() } else { app.activate() }
    case "terminate":
      app.terminate()
    case "tap":
      tapLabel(rest)
    case "tapif":
      if !tryTap(rest, timeout: 2) { log("tapif miss: \(rest)") }
    case "type":
      typeIntoFirst(rest.replacingOccurrences(of: "\\n", with: "\n"))
    case "typefield":
      let bits = rest.split(separator: "|", maxSplits: 1).map(String.init)
      guard bits.count == 2 else { XCTFail("typefield needs placeholder|text"); return }
      typeField(placeholder: bits[0], text: bits[1].replacingOccurrences(of: "\\n", with: "\n"))
    case "keyreturn":
      app.typeText("\n")
    case "nudge":
      app.tap()
    case "doubletap":
      let el = element(named: rest)
      XCTAssertTrue(el.waitForExistence(timeout: 8), "missing \(rest)")
      el.doubleTap()
    case "waitcontains":
      let bitsC = rest.split(separator: "|", maxSplits: 1).map(String.init)
      let needle = bitsC[0]
      let timeoutC = bitsC.count > 1 ? Double(bitsC[1]) ?? 12 : 12
      XCTAssertTrue(waitContains(needle, timeout: timeoutC), "waitcontains failed: \(needle)")
    case "wait":
      let bits = rest.split(separator: "|", maxSplits: 1).map(String.init)
      let text = bits[0]
      let timeout = bits.count > 1 ? Double(bits[1]) ?? 12 : 12
      XCTAssertTrue(waitForText(text, timeout: timeout), "wait failed: \(text)")
    case "waitgone":
      let bits = rest.split(separator: "|", maxSplits: 1).map(String.init)
      let text = bits[0]
      let timeout = bits.count > 1 ? Double(bits[1]) ?? 12 : 12
      let deadline = Date().addingTimeInterval(timeout)
      while Date() < deadline {
        if !app.staticTexts[text].exists && !app.buttons[text].exists { return }
        sleepTick()
      }
      XCTFail("still visible: \(text)")
    case "shot":
      shot(rest.isEmpty ? "shot" : rest)
    case "sleep":
      Thread.sleep(forTimeInterval: Double(rest) ?? 1)
    case "alert":
      handleAlert(rest, spring: spring)
    case "dump":
      dumpUI()
    case "exists":
      log("exists \(rest) => \(waitForText(rest, timeout: 1))")
    default:
      XCTFail("unknown command \(cmd)")
    }
  }

  func handleAlert(_ mode: String, spring: XCUIApplication) {
    app.tap() // trigger interruption monitor
    let labels: [String]
    switch mode {
    case "deny":
      labels = ["Don’t Allow", "Don't Allow", "Not Now", "Cancel"]
    case "ok":
      labels = ["OK", "Allow", "Continue"]
    default:
      labels = ["Allow While Using App", "Allow Once", "Allow", "OK"]
    }
    for label in labels {
      let btn = spring.alerts.buttons[label]
      if btn.exists { btn.tap(); log("alert \(label)"); return }
      let btn2 = app.alerts.buttons[label]
      if btn2.exists { btn2.tap(); log("app-alert \(label)"); return }
    }
    log("no alert for \(mode)")
  }

  func tapLabel(_ name: String) {
    XCTAssertTrue(tryTap(name, timeout: 8), "missing \(name)")
  }

  func tryTap(_ name: String, timeout: TimeInterval) -> Bool {
    let queries: [XCUIElement] = [
      app.sheets.buttons[name].firstMatch,
      app.alerts.buttons[name].firstMatch,
      app.buttons[name].firstMatch,
      app.checkBoxes[name].firstMatch,
      app.otherElements[name].firstMatch,
      app.staticTexts[name].firstMatch,
    ]
    let start = Date()
    while Date().timeIntervalSince(start) < timeout {
      for el in queries {
        if el.exists {
          if el.isHittable { el.tap() } else { el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
          return true
        }
      }
      sleepTick()
    }
    return false
  }

  func element(named name: String) -> XCUIElement {
    let button = app.buttons[name]
    if button.exists { return button }
    let text = app.staticTexts[name]
    if text.exists { return text }
    let other = app.otherElements[name]
    if other.exists { return other }
    let sw = app.switches[name]
    if sw.exists { return sw }
    let tf = app.textFields[name]
    if tf.exists { return tf }
    let sf = app.secureTextFields[name]
    if sf.exists { return sf }
    let link = app.links[name]
    if link.exists { return link }
    return button
  }

  func waitForText(_ text: String, timeout: TimeInterval) -> Bool {
    if app.staticTexts[text].waitForExistence(timeout: timeout) { return true }
    if app.buttons[text].waitForExistence(timeout: 0.2) { return true }
    if app.otherElements[text].waitForExistence(timeout: 0.2) { return true }
    if app.textFields[text].waitForExistence(timeout: 0.2) { return true }
    // substring scan
    let deadline = Date().addingTimeInterval(min(timeout, 2))
    while Date() < deadline {
      let desc = app.debugDescription
      if desc.contains(text) { return true }
      sleepTick()
    }
    return app.staticTexts[text].exists
  }

  func waitContains(_ text: String, timeout: TimeInterval) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if app.debugDescription.contains(text) { return true }
      sleepTick()
    }
    return app.debugDescription.contains(text)
  }

  func typeIntoFirst(_ text: String) {
    let fields = app.textFields.allElementsBoundByIndex + app.secureTextFields.allElementsBoundByIndex
    let focused = fields.first { $0.exists && ($0.value as? String != nil) && $0.hasFocus } ?? fields.first { $0.exists }
    if let field = focused, field.exists {
      field.tap()
      field.typeText(text)
      return
    }
    app.typeText(text)
  }

  func typeField(placeholder: String, text: String) {
    let field = app.textFields[placeholder].exists ? app.textFields[placeholder] : app.secureTextFields[placeholder]
    XCTAssertTrue(field.waitForExistence(timeout: 6), "missing field \(placeholder)")
    field.tap()
    if let current = field.value as? String, !current.isEmpty, current != placeholder {
      field.press(forDuration: 1.2)
      if app.menuItems["Select All"].waitForExistence(timeout: 1) {
        app.menuItems["Select All"].tap()
      }
    }
    field.typeText(text)
  }

  func shot(_ name: String) {
    let shot = XCUIScreen.main.screenshot()
    let url = URL(fileURLWithPath: "\(outDir)/ui-\(sanitize(name)).png")
    try? shot.pngRepresentation.write(to: url)
    log("shot \(url.lastPathComponent)")
  }

  func dumpUI() {
    let url = URL(fileURLWithPath: "\(outDir)/ui-dump.txt")
    try? app.debugDescription.write(to: url, atomically: true, encoding: .utf8)
    log("dumped ui-dump.txt")
  }

  func log(_ msg: String) {
    let url = URL(fileURLWithPath: "\(outDir)/ui-log.txt")
    let line = "\(ISO8601DateFormatter().string(from: Date())) \(msg)\n"
    if let handle = try? FileHandle(forWritingTo: url) {
      handle.seekToEndOfFile()
      handle.write(Data(line.utf8))
      try? handle.close()
    } else {
      try? line.write(to: url, atomically: true, encoding: .utf8)
    }
  }

  func sanitize(_ name: String) -> String {
    name.replacingOccurrences(of: " ", with: "-").replacingOccurrences(of: "/", with: "-")
  }

  func splitOnce(_ line: String) -> (String, String) {
    if let space = line.firstIndex(of: " ") {
      return (String(line[..<space]), String(line[line.index(after: space)...]))
    }
    return (line, "")
  }

  func sleepTick() { Thread.sleep(forTimeInterval: 0.2) }
}
