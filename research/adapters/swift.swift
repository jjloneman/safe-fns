/// The Swift adapter: runs each case file through Swift's standard library
/// and Foundation, on Linux.
///
/// Usage: `swift-adapter <case-file>...`, compiled with `research_codec.swift`
/// by the `swift` Compose service's entrypoint.

import Foundation

/// The probes Swift offers.
///
/// A probe with `accepts` force-casts its arguments: `accepts` has already
/// checked their types.
@main
enum SwiftAdapter {
  /// Returns each value unchanged, for the `codec` round-trip check.
  static let codecProbe = Probe(call: "value", isCodec: true) { $0[0] }

  /// Run the adapter, exiting nonzero if a case file can't be read.
  static func main() throws {
    try runAdapter(tools: [
      Tool(
        functions: [
          "codec": [codecProbe],
          "isPlainObject": [
            Probe(call: "value is [String: Any]") { $0[0] is [String: Any] }
          ],
          "isSafeEmpty": [
            Probe(accepts: isCollection, call: "value.isEmpty") {
              isEmpty($0[0])
            }
          ],
          "safeObjectHasOwn": [
            Probe(
              accepts: isDictionaryAndKey, call: "object.keys.contains(key)"
            ) {
              ($0[0] as! [String: Any]).keys.contains($0[1] as! String)
            }
          ],
          "safeParseBoolean": [
            Probe(accepts: isString, call: "Bool(value)") {
              Bool($0[0] as! String)
            }
          ],
          "safeParseInteger": [
            Probe(accepts: isString, call: "Int(value)") {
              Int($0[0] as! String)
            }
          ],
          "safeParseNumber": [
            Probe(accepts: isString, call: "Double(value)") {
              Double($0[0] as! String)
            }
          ],
          "safeParseString": [
            Probe(call: "String(describing: value)") { describe($0[0]) },
            Probe(
              accepts: isString,
              call: "value.trimmingCharacters(in: .whitespacesAndNewlines)"
            ) {
              ($0[0] as! String).trimmingCharacters(
                in: .whitespacesAndNewlines
              )
            },
          ],
        ],
        name: "Swift",
        tier: 4,
        version: try swiftVersion()
      )
    ])
  }

  /// Describe a value as `String(describing:)` does, without `Optional(…)`.
  static func describe(_ value: Any?) -> String {
    guard let value else {
      return "nil"
    }

    return String(describing: value)
  }

  /// Accept a value that has `isEmpty`: a string, array, or dictionary.
  static func isCollection(_ args: [Any?]) -> Bool {
    args[0] is String || args[0] is [Any] || args[0] is [String: Any]
  }

  /// Accept a dictionary and a string key.
  static func isDictionaryAndKey(_ args: [Any?]) -> Bool {
    args[0] is [String: Any] && args[1] is String
  }

  /// Read `isEmpty` from whichever collection the value is.
  static func isEmpty(_ value: Any?) -> Bool? {
    switch value {
    case let value as String: return value.isEmpty
    case let value as [Any]: return value.isEmpty
    case let value as [String: Any]: return value.isEmpty
    default: return nil
    }
  }

  /// Accept a string first argument.
  static func isString(_ args: [Any?]) -> Bool {
    args[0] is String
  }

  /// Report the compiler's Swift version, such as `6.4`.
  static func swiftVersion() throws -> String {
    let output = Pipe()
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/swiftc")
    process.arguments = ["--version"]
    process.standardOutput = output
    try process.run()
    process.waitUntilExit()

    let text = String(
      decoding: output.fileHandleForReading.readDataToEndOfFile(),
      as: UTF8.self
    )

    guard let match = text.firstMatch(of: #/Swift version (?<version>\S+)/#)
    else {
      return "unknown"
    }

    return String(match.output.version)
  }
}
