/*
The portable value format and adapter loop, for the Go adapter.

The twin of `scripts/research/codec.ts` and `research_codec.py`; the `codec`
case file checks that every twin decodes and re-encodes identically.
*/
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"os"
	"regexp"
	"slices"
	"strings"
)

// Column is one call's results over a case file, as the runner reads them.
type Column struct {
	// Call is the expression, as the table header shows it.
	Call string `json:"call"`

	// Function is the function name from the case file.
	Function string `json:"function"`

	// Locale is the locale the call ran under.
	Locale string `json:"locale"`

	// Name is the tool's display name.
	Name string `json:"name"`

	// Outcomes holds one outcome per case, in case-file order.
	Outcomes []Outcome `json:"outcomes"`

	// Tier is the table tier.
	Tier int `json:"tier"`

	// Version is the version that actually ran.
	Version string `json:"version"`
}

// Outcome is what one call did with one case: `value`, `error`, or `n/a`.
type Outcome map[string]any

// Probe is one expression a tool offers for a function.
type Probe struct {
	/*
		Accepts reports whether the call can take these arguments at all; `n/a`
		otherwise. Nil accepts anything.
	*/
	Accepts func(args []any) bool

	// Call is the expression, as the table header shows it.
	Call string

	// Run runs the expression on one case's decoded arguments.
	Run func(args []any) (any, error)
}

// Tool is a library or runtime, and its probes for each function.
type Tool struct {
	// Functions holds the probes, keyed by the function name in a case file.
	Functions map[string][]Probe

	// Locale is the locale its calls run under.
	Locale string

	// Name is the display name.
	Name string

	// Tier is the table tier.
	Tier int

	// Version is the version that actually ran.
	Version string
}

// Unrepresentable is a value Go has no type for: `undefined` or a `$js` value.
type Unrepresentable struct {
	// Tag is the tag the value was encoded with.
	Tag string
}

// caseFile is one parsed case file.
type caseFile struct {
	// Cases holds each case's encoded arguments.
	Cases []struct {
		// Args holds the encoded arguments.
		Args []any `json:"args"`
	} `json:"cases"`

	// Function is the function the cases exercise.
	Function string `json:"function"`
}

/*
BIGINT_PATTERN matches the digits a `$bigint` payload may hold.

- ASCII only, like the TS twin, with an optional minus sign.
*/
var BIGINT_PATTERN = regexp.MustCompile(`^-?[0-9]+$`)

/*
MAX_SAFE_INTEGER is the largest integer a JavaScript number holds exactly.

  - Past it, an integer is encoded as `$bigint`, so the TS side never reads a
    rounded number.
*/
const MAX_SAFE_INTEGER = 1<<53 - 1

// SPECIAL_NUMBERS maps the spellings `$number` accepts to their values.
var SPECIAL_NUMBERS = map[string]float64{
	"-0":        math.Copysign(0, -1),
	"-Infinity": math.Inf(-1),
	"Infinity":  math.Inf(1),
	"NaN":       math.NaN(),
}

// containsUnrepresentable reports whether a value holds anything Go can't.
func containsUnrepresentable(value any) bool {
	switch typed := value.(type) {
	case Unrepresentable:
		return true
	case []any:
		for _, item := range typed {
			if containsUnrepresentable(item) {
				return true
			}
		}
	case map[string]any:
		for _, item := range typed {
			if containsUnrepresentable(item) {
				return true
			}
		}
	}

	return false
}

/*
decode decodes a value from the portable format.

  - JSON numbers arrive as `json.Number`, so an integer stays an `int64` and
    anything with a fraction or exponent becomes a `float64`, as in Python.

- A malformed tag returns an error, exactly where `decodeValue` throws.
*/
func decode(encoded any) (any, error) {
	switch typed := encoded.(type) {
	case json.Number:
		return decodeNumber(typed)
	case []any:
		decoded := make([]any, len(typed))

		for index, item := range typed {
			value, err := decode(item)

			if err != nil {
				return nil, err
			}

			decoded[index] = value
		}

		return decoded, nil
	case map[string]any:
		return decodeObject(typed)
	}

	return encoded, nil
}

// decodeEntries decodes every value of an object, keeping its keys.
func decodeEntries(entries map[string]any) (map[string]any, error) {
	decoded := make(map[string]any, len(entries))

	for key, item := range entries {
		value, err := decode(item)

		if err != nil {
			return nil, err
		}

		decoded[key] = value
	}

	return decoded, nil
}

/*
decodeNumber reads a JSON number as an integer when it has no fraction or
exponent, as Python does.

  - An integer past `int64` becomes a `*big.Int`, which re-encodes as
    `$bigint`, as a Python int that large does.
*/
func decodeNumber(number json.Number) (any, error) {
	if strings.ContainsAny(string(number), ".eE") {
		return number.Float64()
	}

	if integer, err := number.Int64(); err == nil {
		return integer, nil
	}

	integer, _ := new(big.Int).SetString(string(number), 10)

	return integer, nil
}

// decodeObject decodes a plain object, or the one tag it holds.
func decodeObject(object map[string]any) (any, error) {
	var tags []string

	for key := range object {
		if strings.HasPrefix(key, "$") {
			tags = append(tags, key)
		}
	}

	if len(tags) == 0 {
		return decodeEntries(object)
	}

	// A map has no order, so the error names the first tag alphabetically.
	slices.Sort(tags)

	if len(object) != 1 {
		message := "a tag must be an object's only key: %s"

		return nil, fmt.Errorf(message, tags[0])
	}

	return decodeTag(tags[0], object[tags[0]])
}

// decodeTag decodes one tagged object, given its tag and payload.
func decodeTag(tag string, payload any) (any, error) {
	text, isText := payload.(string)

	switch {
	case tag == "$bigint" && isText:
		if !BIGINT_PATTERN.MatchString(text) {
			return nil, fmt.Errorf("not an integer: %s", text)
		}

		integer, _ := new(big.Int).SetString(text, 10)

		return integer, nil
	case tag == "$js" && isText:
		return Unrepresentable{Tag: tag}, nil
	case tag == "$number" && isText:
		number, isSpecial := SPECIAL_NUMBERS[text]

		if !isSpecial {
			return nil, fmt.Errorf("not a special number: %s", text)
		}

		return number, nil
	case tag == "$object":
		if entries, isObject := payload.(map[string]any); isObject {
			return decodeEntries(entries)
		}
	case tag == "$undefined" && payload == true:
		return Unrepresentable{Tag: tag}, nil
	}

	return nil, fmt.Errorf("unknown tag or bad payload: %s", tag)
}

/*
encode encodes a value into the portable format.

  - Anything the format has no tag for is described by `$repr`, which never
    decodes.
*/
func encode(value any) any {
	switch typed := value.(type) {
	case nil, bool, string:
		return typed
	case *big.Int:
		return map[string]any{"$bigint": typed.String()}
	case float64:
		return encodeFloat(typed)
	case int:
		return encodeInt(int64(typed))
	case int64:
		return encodeInt(typed)
	case []any:
		encoded := make([]any, len(typed))

		for index, item := range typed {
			encoded[index] = encode(item)
		}

		return encoded
	case map[string]any:
		return encodeEntries(typed)
	}

	return map[string]any{"$repr": fmt.Sprintf("%T", value)}
}

// encodeEntries encodes a map, wrapped in `$object` when a key could pass for
// a tag.
func encodeEntries(entries map[string]any) any {
	encoded := make(map[string]any, len(entries))
	hasTagKey := false

	for key, item := range entries {
		encoded[key] = encode(item)
		hasTagKey = hasTagKey || strings.HasPrefix(key, "$")
	}

	if hasTagKey {
		return map[string]any{"$object": encoded}
	}

	return encoded
}

// encodeFloat encodes a float, tagging the values JSON can't hold.
func encodeFloat(value float64) any {
	switch {
	case math.IsNaN(value):
		return map[string]any{"$number": "NaN"}
	case math.IsInf(value, 1):
		return map[string]any{"$number": "Infinity"}
	case math.IsInf(value, -1):
		return map[string]any{"$number": "-Infinity"}
	case value == 0 && math.Signbit(value):
		return map[string]any{"$number": "-0"}
	}

	return value
}

// encodeInt encodes an int, as a bigint once a JavaScript number would lose
// it.
func encodeInt(value int64) any {
	if value > MAX_SAFE_INTEGER || value < -MAX_SAFE_INTEGER {
		return map[string]any{"$bigint": fmt.Sprint(value)}
	}

	return value
}

// readCaseFile reads and parses one case file, keeping numbers exact.
func readCaseFile(path string) (caseFile, error) {
	var parsed caseFile

	text, err := os.ReadFile(path)

	if err != nil {
		return parsed, err
	}

	decoder := json.NewDecoder(bytes.NewReader(text))
	decoder.UseNumber()

	if err := decoder.Decode(&parsed); err != nil {
		return parsed, fmt.Errorf("%s isn't valid JSON: %w", path, err)
	}

	return parsed, nil
}

/*
runAdapter runs the case files named on the command line and prints the
columns.

  - A case file that can't be read or decoded stops the run with a message on
    stderr, as a Python adapter's uncaught error does.
*/
func runAdapter(tools []Tool) {
	columns := []Column{}

	for _, path := range os.Args[1:] {
		parsed, err := readCaseFile(path)

		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}

		for _, tool := range tools {
			for _, probe := range tool.Functions[parsed.Function] {
				outcomes := make([]Outcome, len(parsed.Cases))

				for index, testCase := range parsed.Cases {
					outcome, err := runProbe(testCase.Args, probe)

					if err != nil {
						fmt.Fprintf(os.Stderr, "%s: %v\n", path, err)
						os.Exit(1)
					}

					outcomes[index] = outcome
				}

				columns = append(columns, Column{
					Call:     probe.Call,
					Function: parsed.Function,
					Locale:   tool.Locale,
					Name:     tool.Name,
					Outcomes: outcomes,
					Tier:     tool.Tier,
					Version:  tool.Version,
				})
			}
		}
	}

	// Every outcome is already encoded, so nothing left can fail to marshal.
	_ = json.NewEncoder(os.Stdout).Encode(map[string]any{"columns": columns})
}

/*
runProbe runs one probe on one case's encoded arguments.

  - A panic is a result, never a crash: it is reported as an `error` outcome
    named `panic: <type>`.
*/
func runProbe(args []any, probe Probe) (outcome Outcome, err error) {
	decoded := make([]any, len(args))

	for index, arg := range args {
		value, err := decode(arg)

		if err != nil {
			return nil, err
		}

		decoded[index] = value
	}

	if containsUnrepresentable(decoded) {
		return Outcome{"kind": "n/a"}, nil
	}

	if probe.Accepts != nil && !probe.Accepts(decoded) {
		return Outcome{"kind": "n/a"}, nil
	}

	defer func() {
		if recovered := recover(); recovered != nil {
			outcome = Outcome{
				"error": fmt.Sprintf("panic: %T", recovered),
				"kind":  "error",
			}
		}
	}()

	value, runErr := probe.Run(decoded)

	if runErr != nil {
		return Outcome{"error": errorName(runErr), "kind": "error"}, nil
	}

	return Outcome{"kind": "value", "value": encode(value)}, nil
}
