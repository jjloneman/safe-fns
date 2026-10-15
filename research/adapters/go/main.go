/*
The Go adapter: runs each case file through the standard library.

Usage: `/opt/go-adapter <case-file>...`, the `go` Compose service.

  - A case decodes into the types `encoding/json` would give it (`string`,
    `bool`, `nil`, `[]any`, `map[string]any`), with integers as `int64` and
    everything else numeric as `float64`.

  - `strconv` is locale-independent, so every column reports the container's
    `LC_ALL` rather than a culture the call never consults.
*/
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"reflect"
	"runtime"
	"strconv"
	"strings"
)

// sentinelError pairs a sentinel error with the name the tables show.
type sentinelError struct {
	// err is the sentinel `errors.Is` matches.
	err error

	// name is the name the tables show.
	name string
}

// CODEC_PROBE returns each value unchanged, for the `codec` round-trip check.
var CODEC_PROBE = Probe{
	Call: "value",
	Run:  func(args []any) (any, error) { return args[0], nil },
}

// SENTINEL_ERRORS are the errors named by sentinel rather than by type.
var SENTINEL_ERRORS = []sentinelError{
	{err: strconv.ErrRange, name: "strconv.ErrRange"},
	{err: strconv.ErrSyntax, name: "strconv.ErrSyntax"},
}

// areTwoStrings accepts exactly two string arguments: a value and a base.
func areTwoStrings(args []any) bool {
	if len(args) != 2 {
		return false
	}

	_, isBaseText := args[1].(string)

	return isString(args) && isBaseText
}

/*
errorName names a failure the way the tables show a thrown class.

  - A `strconv` error is named by its sentinel (`strconv.ErrSyntax`,
    `strconv.ErrRange`), since every one shares the `*strconv.NumError` type.
*/
func errorName(err error) string {
	for _, sentinel := range SENTINEL_ERRORS {
		if errors.Is(err, sentinel.err) {
			return sentinel.name
		}
	}

	return fmt.Sprintf("%T", err)
}

// hasLength accepts a first argument that `len` measures.
func hasLength(args []any) bool {
	_, isMeasurable := lengthOf(args[0])

	return isMeasurable
}

// isLoneString accepts exactly one argument, a string.
func isLoneString(args []any) bool {
	return len(args) == 1 && isString(args)
}

// isMapAndString accepts a map first argument and a string second argument.
func isMapAndString(args []any) bool {
	_, isMap := args[0].(map[string]any)
	_, isString := args[1].(string)

	return isMap && isString
}

// isString accepts only a string first argument.
func isString(args []any) bool {
	_, isText := args[0].(string)

	return isText
}

// lengthOf returns `len` of a string, a slice, or a map, and whether the
// value is one.
func lengthOf(value any) (int, bool) {
	switch typed := value.(type) {
	case string:
		return len(typed), true
	case []any:
		return len(typed), true
	case map[string]any:
		return len(typed), true
	}

	return 0, false
}

// marshalText runs `json.Marshal` and returns its output as a string.
func marshalText(value any) (any, error) {
	text, err := json.Marshal(value)

	if err != nil {
		return nil, err
	}

	return string(text), nil
}

// tools lists the probes the Go standard library offers.
func tools() []Tool {
	return []Tool{
		{
			Functions: map[string][]Probe{
				"codec": {CODEC_PROBE},
				"deepSortObject": {
					{
						Accepts: isString,
						Call:    "json.Unmarshal(value, &v); json.Marshal(v)",
						Run: func(args []any) (any, error) {
							value, err := unmarshalText(args[0].(string))

							if err != nil {
								return nil, err
							}

							return marshalText(value)
						},
					},
				},
				"isPlainObject": {
					{
						Call: "_, ok := value.(map[string]any)",
						Run: func(args []any) (any, error) {
							_, isMap := args[0].(map[string]any)

							return isMap, nil
						},
					},
				},
				"isSafeEmpty": {
					{
						Accepts: hasLength,
						Call:    "len(value) == 0",
						Run: func(args []any) (any, error) {
							count, _ := lengthOf(args[0])

							return count == 0, nil
						},
					},
					{
						Call: "reflect.ValueOf(value).IsZero()",
						Run: func(args []any) (any, error) {
							return reflect.ValueOf(args[0]).IsZero(), nil
						},
					},
				},
				"safeJsonStringify": {
					{
						Call: "json.Marshal(value)",
						Run: func(args []any) (any, error) {
							return marshalText(args[0])
						},
					},
				},
				"safeObjectHasOwn": {
					{
						Accepts: isMapAndString,
						Call:    "_, ok := obj[key]",
						Run: func(args []any) (any, error) {
							entries := args[0].(map[string]any)
							_, hasKey := entries[args[1].(string)]

							return hasKey, nil
						},
					},
				},
				"safeParseBoolean": {
					{
						Accepts: isString,
						Call:    "strconv.ParseBool(value)",
						Run: func(args []any) (any, error) {
							return strconv.ParseBool(args[0].(string))
						},
					},
				},
				"safeParseInteger": {
					{
						Accepts: isString,
						Call:    "strconv.Atoi(value)",
						Run: func(args []any) (any, error) {
							return strconv.Atoi(args[0].(string))
						},
					},
					{
						Accepts: isString,
						Call:    "strconv.ParseInt(value, 0, 64)",
						Run: func(args []any) (any, error) {
							return strconv.ParseInt(args[0].(string), 0, 64)
						},
					},
				},
				"safeParseJson": {
					{
						Accepts: isString,
						Call:    "json.Unmarshal(value, &v)",
						Run: func(args []any) (any, error) {
							return unmarshalText(args[0].(string))
						},
					},
				},
				"safeParseNumber": {
					{
						Accepts: isString,
						Call:    "strconv.ParseFloat(value, 64)",
						Run: func(args []any) (any, error) {
							return strconv.ParseFloat(args[0].(string), 64)
						},
					},
				},
				"safeParseString": {
					{
						Call: "fmt.Sprint(value)",
						Run: func(args []any) (any, error) {
							return fmt.Sprint(args[0]), nil
						},
					},
					{
						Accepts: isString,
						Call:    "strings.TrimSpace(value)",
						Run: func(args []any) (any, error) {
							return strings.TrimSpace(args[0].(string)), nil
						},
					},
				},
				"safeParseUrl": {
					{
						Accepts: isLoneString,
						Call:    "url.Parse(value)",
						Run: func(args []any) (any, error) {
							parsed, err := url.Parse(args[0].(string))

							if err != nil {
								return nil, err
							}

							return parsed.String(), nil
						},
					},
					{
						Accepts: areTwoStrings,
						Call:    "url.Parse(base) then base.Parse(value)",
						Run: func(args []any) (any, error) {
							base, err := url.Parse(args[1].(string))

							if err != nil {
								return nil, err
							}

							parsed, err := base.Parse(args[0].(string))

							if err != nil {
								return nil, err
							}

							return parsed.String(), nil
						},
					},
				},
			},
			Locale:  os.Getenv("LC_ALL"),
			Name:    "Go",
			Tier:    2,
			Version: strings.TrimPrefix(runtime.Version(), "go"),
		},
	}
}

// unmarshalText runs `json.Unmarshal` into an `any`, the way a caller with no
// struct to fill reads JSON.
func unmarshalText(text string) (any, error) {
	var value any

	err := json.Unmarshal([]byte(text), &value)

	return value, err
}

// main runs the case files named on the command line.
func main() {
	runAdapter(tools())
}
