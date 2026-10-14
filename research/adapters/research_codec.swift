/// The portable value format and adapter loop, for the Swift adapter.
///
/// - The twin of `scripts/research/codec.ts`; the `codec` case file checks
///   that both decode and re-encode identically.
///
/// - A probe sees Swift's own types: `nil`, `Bool`, `Int`, `Double`,
///   `String`, `[Any]`, and `[String: Any]`, with `NSNull` for a `null` inside
///   a collection, as Foundation's `JSONSerialization` gives them.
///
/// - A `$bigint` that fits decodes to `Int`, one that doesn't is `n/a`, and
///   only the codec probe gets a `JsBigInt`.

import Foundation

#if canImport(Glibc)
  import Glibc
#endif

/// The largest integer a JavaScript number holds exactly: 2**53 - 1.
let maxSafeInteger = 9_007_199_254_740_991

/// The spellings `$number` accepts, each with its value.
let specialNumbers: [String: Double] = [
  "-0": -0.0,
  "-Infinity": -Double.infinity,
  "Infinity": Double.infinity,
  "NaN": Double.nan,
]

/// A failure to read the case format.
struct CodecError: Error {
  /// What was wrong with the input.
  let message: String
}

/// A `$bigint` decoded for the codec probe, so it re-encodes as one.
struct JsBigInt {
  /// The digits, with an optional minus sign.
  let digits: String
}

/// A JSON value, possibly holding tagged objects; `EncodedValue` in TS.
enum JSONValue: Codable {
  case array([JSONValue])
  case bool(Bool)
  case double(Double)
  case integer(Int)
  case null
  case object([String: JSONValue])
  case string(String)

  /// Decode any JSON value, telling an integer from a fraction.
  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()

    if container.decodeNil() {
      self = .null
    } else if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Int.self) {
      self = .integer(value)
    } else if let value = try? container.decode(Double.self) {
      self = .double(value)
    } else if let value = try? container.decode(String.self) {
      self = .string(value)
    } else if let value = try? container.decode([JSONValue].self) {
      self = .array(value)
    } else {
      self = .object(try container.decode([String: JSONValue].self))
    }
  }

  /// Encode the value as the JSON it names.
  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()

    switch self {
    case .array(let value): try container.encode(value)
    case .bool(let value): try container.encode(value)
    case .double(let value): try container.encode(value)
    case .integer(let value): try container.encode(value)
    case .null: try container.encodeNil()
    case .object(let value): try container.encode(value)
    case .string(let value): try container.encode(value)
    }
  }
}

/// One expression a tool offers for a function.
struct Probe {
  /// Whether the call can take these arguments at all; `n/a` otherwise.
  var accepts: (([Any?]) -> Bool)? = nil

  /// The expression, as the table header shows it.
  let call: String

  /// Whether this is the codec round-trip, which sees every value.
  var isCodec = false

  /// Runs the expression on one case's decoded arguments.
  let run: ([Any?]) throws -> Any?
}

/// A library or runtime, and its probes for each function.
struct Tool {
  /// Probes keyed by the function name in a case file.
  let functions: [String: [Probe]]

  /// The display name.
  let name: String

  /// The table tier.
  let tier: Int

  /// The version that actually ran.
  let version: String
}

/// A value Swift has no type for: `undefined`, a `$js` value, or a bigint.
struct Unrepresentable {
  /// The tag's payload, kept so the value re-encodes unchanged.
  let payload: JSONValue

  /// The tag, such as `$undefined`.
  let tag: String
}

/// Report whether a decoded value holds anything Swift can't express.
func containsUnrepresentable(_ value: Any?) -> Bool {
  switch value {
  case is Unrepresentable: return true
  case let array as [Any]: return array.contains(where: containsUnrepresentable)
  case let object as [String: Any]:
    return object.values.contains(where: containsUnrepresentable)
  default: return false
  }
}

/// Adopt the container's locale and return its name.
func currentLocale() -> String {
  String(cString: setlocale(LC_ALL, ""))
}

/// Decode a value from the portable format.
///
/// Throws a `CodecError` for a malformed tag, exactly where `decodeValue`
/// throws.
func decode(_ encoded: JSONValue, isCodec: Bool) throws -> Any? {
  switch encoded {
  case .array(let items):
    return try items.map { try decode($0, isCodec: isCodec) ?? NSNull() }
  case .bool(let value): return value
  case .double(let value): return value
  case .integer(let value): return value
  case .null: return nil
  case .object(let entries): return try decodeObject(entries, isCodec: isCodec)
  case .string(let value): return value
  }
}

/// Decode a plain object's values, with `NSNull` for `null`.
func decodeEntries(_ entries: [String: JSONValue], isCodec: Bool) throws
  -> [String: Any]
{
  try entries.mapValues { try decode($0, isCodec: isCodec) ?? NSNull() }
}

/// Decode a JSON object: a tag, or a plain object whose values are decoded.
func decodeObject(_ entries: [String: JSONValue], isCodec: Bool) throws -> Any?
{
  let tags = entries.keys.filter { $0.hasPrefix("$") }.sorted()

  guard let tag = tags.first else {
    return try decodeEntries(entries, isCodec: isCodec)
  }

  guard entries.count == 1, let payload = entries[tag] else {
    throw CodecError(message: "a tag must be an object's only key: \(tag)")
  }

  return try decodeTag(isCodec: isCodec, payload: payload, tag: tag)
}

/// Decode one tagged object, given its tag and payload.
///
/// Throws a `CodecError` for an unknown tag or a payload the tag doesn't
/// accept.
func decodeTag(isCodec: Bool, payload: JSONValue, tag: String) throws -> Any? {
  switch (tag, payload) {
  case ("$bigint", .string(let digits)):
    guard digits.wholeMatch(of: #/-?[0-9]+/#) != nil else {
      throw CodecError(message: "not an integer: \(digits)")
    }

    if isCodec {
      return JsBigInt(digits: digits)
    }

    if let integer = Int(digits) {
      return integer
    }

    return Unrepresentable(payload: payload, tag: tag)
  case ("$js", .string):
    return Unrepresentable(payload: payload, tag: tag)
  case ("$number", .string(let name)):
    guard let number = specialNumbers[name] else {
      throw CodecError(message: "not a special number: \(name)")
    }

    return number
  case ("$object", .object(let entries)):
    return try decodeEntries(entries, isCodec: isCodec)
  case ("$undefined", .bool(true)):
    return Unrepresentable(payload: payload, tag: tag)
  default:
    throw CodecError(message: "unknown tag or bad payload: \(tag)")
  }
}

/// Encode a value into the portable format.
///
/// Anything the format has no tag for is described by `$repr`, which never
/// decodes.
func encode(_ value: Any?) -> JSONValue {
  guard let value, !(value is NSNull) else {
    return .null
  }

  switch value {
  case let value as Unrepresentable: return .object([value.tag: value.payload])
  case let value as JsBigInt: return .object(["$bigint": .string(value.digits)])
  case let value as Bool: return .bool(value)
  case let value as Int: return encodeInteger(value)
  case let value as Double: return encodeDouble(value)
  case let value as String: return .string(value)
  case let value as [Any]: return .array(value.map(encode))
  case let value as [String: Any]: return encodeEntries(value)
  default:
    return .object(["$repr": .string(String(describing: type(of: value)))])
  }
}

/// Encode a `Double`, tagging the values JSON can't hold.
func encodeDouble(_ value: Double) -> JSONValue {
  if value.isNaN {
    return .object(["$number": .string("NaN")])
  }

  if value.isInfinite {
    return .object(["$number": .string(value > 0 ? "Infinity" : "-Infinity")])
  }

  if value == 0 && value.sign == .minus {
    return .object(["$number": .string("-0")])
  }

  return .double(value)
}

/// Encode a dictionary, wrapped in `$object` when a key could pass for a tag.
func encodeEntries(_ entries: [String: Any]) -> JSONValue {
  let encoded = JSONValue.object(entries.mapValues(encode))

  if entries.keys.contains(where: { $0.hasPrefix("$") }) {
    return .object(["$object": encoded])
  }

  return encoded
}

/// Encode an `Int`, as a bigint once a JavaScript number would lose it.
func encodeInteger(_ value: Int) -> JSONValue {
  if value.magnitude > maxSafeInteger.magnitude {
    return .object(["$bigint": .string(String(value))])
  }

  return .integer(value)
}

/// Run the case files named on the command line and print the columns.
func runAdapter(tools: [Tool]) throws {
  let locale = currentLocale()
  var columns: [JSONValue] = []

  for path in CommandLine.arguments.dropFirst() {
    let data = try Data(contentsOf: URL(fileURLWithPath: path))

    guard
      case .object(let caseFile) = try JSONDecoder().decode(
        JSONValue.self,
        from: data
      ),
      case .string(let function) = caseFile["function"],
      case .array(let cases) = caseFile["cases"]
    else {
      throw CodecError(message: "\(path) isn't a case file")
    }

    for tool in tools {
      for probe in tool.functions[function] ?? [] {
        let outcomes = try cases.map { testCase in
          guard case .object(let entries) = testCase,
            case .array(let args) = entries["args"]
          else {
            throw CodecError(message: "\(path) has a case without args")
          }

          return try runProbe(args: args, probe: probe)
        }

        columns.append(
          .object([
            "call": .string(probe.call),
            "function": .string(function),
            "locale": .string(locale),
            "name": .string(tool.name),
            "outcomes": .array(outcomes),
            "tier": .integer(tool.tier),
            "version": .string(tool.version),
          ])
        )
      }
    }
  }

  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
  FileHandle.standardOutput.write(
    try encoder.encode(JSONValue.object(["columns": .array(columns)]))
  )
}

/// Run one probe on one case's encoded arguments.
func runProbe(args: [JSONValue], probe: Probe) throws -> JSONValue {
  let decoded = try args.map { try decode($0, isCodec: probe.isCodec) }

  if !probe.isCodec && decoded.contains(where: containsUnrepresentable) {
    return .object(["kind": .string("n/a")])
  }

  if let accepts = probe.accepts, !accepts(decoded) {
    return .object(["kind": .string("n/a")])
  }

  do {
    return .object([
      "kind": .string("value"), "value": encode(try probe.run(decoded)),
    ])
  } catch {
    // Every failure is a result, never a crash.
    return .object([
      "error": .string(String(describing: type(of: error))),
      "kind": .string("error"),
    ])
  }
}
