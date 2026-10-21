"""The shell adapter: runs each string case through shells, git, and systemd.

Usage: `python3 shell.py <case-file>...`, inside the `shell` Compose service.

- None of these tools reads JSON, so this driver decodes the cases and hands
  each string to the real tool, never interpolated into a script: a shell
  gets it as a positional parameter, git through `GIT_CONFIG_VALUE_0`, and
  systemd as the value of a condition.

- A tool sees only strings, so anything else is `n/a`; so is a string holding
  NUL, which no argument or environment variable can carry.

- A nonzero exit status is the error `exit <status>`.
"""

from __future__ import annotations

import os
import subprocess
from collections.abc import Callable

from research_codec import Probe, Tool, ToolError, run_adapter

GIT_ENVIRONMENT = {
    **os.environ,
    "GIT_CONFIG_COUNT": "1",
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_KEY_0": "research.value",
    "GIT_CONFIG_NOSYSTEM": "1",
}
"""Git's environment: one config entry, and no system or user config."""

SYSTEMD_FALSE = "Conditions succeeded."
"""What `systemd-analyze condition` prints when `ConditionFirstBoot` holds.

A container is never on its first boot, so the condition holds exactly when
`parse_boolean` read the value as false.
"""

SYSTEMD_INVALID = "Invalid argument"
"""What `systemd-analyze condition` prints when `parse_boolean` fails."""

SYSTEMD_LEADING_WHITESPACE = " \t\n\r"
"""The whitespace systemd strips from the start of a setting's value."""

SYSTEMD_TRUE = "Conditions failed."
"""What `systemd-analyze condition` prints when `ConditionFirstBoot` fails."""


def accepts_argument(value: object, *_rest: object) -> bool:
    """Accept a string that an argument or environment variable can carry."""
    return isinstance(value, str) and "\0" not in value


def accepts_condition(value: object, *_rest: object) -> bool:
    """Accept a string systemd parses as a condition's value.

    systemd strips leading whitespace first, and an assignment left empty
    resets the condition list instead of parsing anything.
    """
    return (
        accepts_argument(value)
        and str(value).lstrip(SYSTEMD_LEADING_WHITESPACE) != ""
    )


def git_config(value_type: str) -> Probe:
    """Build a probe that reads the value back through `git config --type`.

    Git prints its canonical form (`true`, `42`), returned as JSON's.
    """

    def run(value: str) -> object:
        """Read the value as `value_type`, and decode what git prints."""
        result = subprocess.run(
            ["git", "config", f"--type={value_type}", "research.value"],
            capture_output=True,
            check=False,
            env={**GIT_ENVIRONMENT, "GIT_CONFIG_VALUE_0": value},
            text=True,
        )

        return parse_canonical(stdout(result))

    return {
        "accepts": accepts_argument,
        "call": f"git config --type={value_type}",
        "run": run,
    }


def interpreter(
    source: str,
) -> Callable[[subprocess.CompletedProcess[str]], object]:
    """Choose how to read a script's result from its first word.

    - A test (`[ … ]`) answers with its exit status.

    - A fish `string` command exits 1 when it changed or matched nothing, so
      it answers with what it printed either way.

    - Anything else answers with what it printed, if it succeeded.
    """
    if source.startswith("["):
        return status

    if source.startswith("string "):
        return string_output

    return stdout


def package_version(package: str) -> str:
    """Report a Debian package's version, which names any Debian patch."""
    return subprocess.run(
        ["dpkg-query", "--show", "--showformat=${Version}", package],
        capture_output=True,
        check=True,
        text=True,
    ).stdout


def parse_canonical(text: str) -> object:
    """Decode git's canonical output: a boolean, or else an integer."""
    if text in {"false", "true"}:
        return text == "true"

    return int(text)


def positional(*, command: list[str], value: str) -> list[str]:
    """List the arguments after the script that make `value` its first.

    POSIX shells take `$0` before `$1`; fish puts every argument in `$argv`.
    """
    if command[0] == "fish":
        return [value]

    return [command[0], value]


def script(
    *,
    command: list[str],
    interpret: Callable[[subprocess.CompletedProcess[str]], object],
    source: str,
) -> Probe:
    """Build a probe that runs a script with the value as its argument.

    The value is the script's only argument, after `command` and `source`.
    """

    def run(value: str) -> object:
        """Run the script on the value and interpret how it finished."""
        result = subprocess.run(
            [*command, source, *positional(command=command, value=value)],
            capture_output=True,
            check=False,
            text=True,
        )

        return interpret(result)

    return {"accepts": accepts_argument, "call": source, "run": run}


def shell_tool(
    *, command: list[str], name: str, package: str, probes: dict[str, list[str]]
) -> Tool:
    """Describe one shell, whose probes are scripts run with `command`.

    How each script finishes is read by `interpreter`.
    """
    return {
        "functions": {
            function: [
                script(
                    command=command,
                    interpret=interpreter(source),
                    source=source,
                )
                for source in sources
            ]
            for function, sources in probes.items()
        },
        "name": name,
        "tier": 4,
        "version": package_version(package),
    }


def status(result: subprocess.CompletedProcess[str]) -> bool:
    """Read a test's exit status: 0 is true, 1 is false, anything else fails.

    Raises:
        ToolError: for any status but 0 or 1.
    """
    if result.returncode not in {0, 1}:
        raise ToolError(f"exit {result.returncode}")

    return result.returncode == 0


def stdout(result: subprocess.CompletedProcess[str]) -> str:
    """Return what a command printed, less the newline it ends a line with.

    Raises:
        ToolError: for a nonzero exit status.
    """
    if result.returncode != 0:
        raise ToolError(f"exit {result.returncode}")

    return result.stdout.removesuffix("\n")


def string_output(result: subprocess.CompletedProcess[str]) -> str:
    """Return what a fish `string` command printed, whether or not it changed.

    Raises:
        ToolError: for any status but 0 or 1.
    """
    if result.returncode not in {0, 1}:
        raise ToolError(f"exit {result.returncode}")

    return result.stdout.removesuffix("\n")


def systemd_boolean(value: str) -> bool:
    """Read a value through `parse_boolean`, as `ConditionFirstBoot=`'s.

    Raises:
        ToolError: `EINVAL` when systemd can't parse the value, or
            `no condition` when it evaluated none.
    """
    result = subprocess.run(
        ["systemd-analyze", "condition", f"ConditionFirstBoot={value}"],
        capture_output=True,
        check=False,
        text=True,
    )

    output = result.stdout + result.stderr

    if SYSTEMD_INVALID in output:
        raise ToolError("EINVAL")

    if SYSTEMD_FALSE in output:
        return False

    if SYSTEMD_TRUE in output:
        return True

    raise ToolError("no condition")


POSIX_PROBES = {
    "isSafeEmpty": ['[ -z "$1" ]'],
    "safeParseInt": ["printf '%d' \"$1\"", "printf '%s' \"$(( $1 ))\""],
}
"""The scripts every POSIX shell runs: a test, `printf`, and arithmetic."""

TOOLS: list[Tool] = [
    shell_tool(
        command=["bash", "-c"],
        name="bash",
        package="bash",
        probes=POSIX_PROBES,
    ),
    shell_tool(
        command=["dash", "-c"],
        name="dash (POSIX sh)",
        package="dash",
        probes=POSIX_PROBES,
    ),
    shell_tool(
        command=["fish", "--no-config", "-c"],
        name="fish",
        package="fish",
        probes={
            "isSafeEmpty": ['[ -z "$argv[1]" ]'],
            "safeParseNumber": ["math -- $argv[1]"],
            "safeParseString": ["string trim -- $argv[1]"],
        },
    ),
    shell_tool(
        command=["zsh", "-f", "-c"],
        name="zsh",
        package="zsh",
        probes={
            **POSIX_PROBES,
            # zsh's arithmetic is floating-point too, unlike bash's and dash's.
            "safeParseNumber": ["printf '%s' \"$(( $1 ))\""],
        },
    ),
    {
        "functions": {
            "safeParseBoolean": [git_config("bool")],
            "safeParseInt": [git_config("int")],
        },
        "name": "git",
        "tier": 4,
        "version": package_version("git"),
    },
    {
        "functions": {
            "safeParseBoolean": [
                {
                    "accepts": accepts_condition,
                    "call": 'systemd-analyze condition "ConditionFirstBoot=…"',
                    "run": systemd_boolean,
                }
            ]
        },
        "name": "systemd",
        "tier": 4,
        "version": package_version("systemd"),
    },
]

if __name__ == "__main__":
    run_adapter(tools=TOOLS)
