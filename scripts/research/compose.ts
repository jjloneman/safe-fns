/**
 * The Compose subcommands the runner runs against database services, each
 * placed before the service names.
 *
 * - `down` removes the services with their volumes and networks; given names,
 *   it touches nothing else in the project.
 *
 * - `rm` is the fallback for a Compose whose `down` takes no service names;
 *   it leaves the networks behind.
 *
 * - `up` starts them and waits on their healthchecks.
 */
export const DATABASE_COMMANDS = {
  down: ["down", "--volumes"],
  rm: ["rm", "--force", "--stop", "--volumes"],
  up: ["up", "--detach", "--wait"],
} as const;

/** A Compose subcommand from `DATABASE_COMMANDS`. */
export type DatabaseCommand = keyof typeof DATABASE_COMMANDS;

/** A Compose subcommand to run against a set of database services. */
export type DatabaseCommandInput = {
  /**
   * Which subcommand to run.
   *
   * @example "down"
   */
  command: DatabaseCommand;

  /**
   * The services it acts on, by name; never empty.
   *
   * @example `[{ name: "postgres", profiles: ["db"] }]`
   */
  databases: readonly DatabaseService[];
};

/** A database service, as the commands that start and remove it need it. */
export type DatabaseService = {
  /**
   * The Compose service name.
   *
   * @example "postgres"
   */
  name: string;

  /**
   * The profiles that enable it.
   *
   * @example `["db"]`
   */
  profiles: readonly string[];
};

/**
 * How `docker rm --force` reports a container that `--rm` is already
 * removing, or has removed: no failure for a teardown that only wants it gone.
 */
const ALREADY_REMOVED =
  /removal of container \S+ is already in progress|No such container/u;

// Docker's state for a container already on its way out.
const REMOVING_STATE = "removing";

// Compose prints one progress line per resource; this is a network it kept.
const NETWORK_IN_USE =
  /\bNetwork\s+(?<network>\S+)\s+Resource is still in use/gu;

/**
 * Read `docker ps --format "{{.ID}} {{.State}}"` for the containers that still
 * need removing, skipping any whose removal is already in progress.
 *
 * @returns each such container's id, in the order Docker listed them.
 */
export function findContainersToRemove(psOutput: string): string[] {
  return psOutput.split("\n").flatMap((line) => {
    const [id = "", state = ""] = line.trim().split(/\s+/u);

    return id === "" || state === REMOVING_STATE ? [] : [id];
  });
}

/**
 * Read the networks a `docker compose down` kept because a container still
 * uses them, which it reports on stderr while still exiting 0.
 *
 * @returns each kept network's name, in the order Compose printed them.
 */
export function findNetworksInUse(stderr: string): string[] {
  // A match always sets `groups`; spreading it only satisfies its type.
  return [...stderr.matchAll(NETWORK_IN_USE)].map(
    ({ groups }) => ({ network: "", ...groups }).network
  );
}

/**
 * Read the errors a `docker rm --force` printed, skipping containers that were
 * already being removed or gone.
 *
 * @returns each remaining non-blank stderr line.
 */
export function findUnexpectedRemovalErrors(stderr: string): string[] {
  return stderr
    .split("\n")
    .filter((line) => line.trim() !== "" && !ALREADY_REMOVED.test(line));
}

/**
 * Turn profile names into Compose's `--profile` flags.
 *
 * @example `profileArgs(["db"])` → `["--profile", "db"]`
 */
export function profileArgs(profiles: readonly string[]): string[] {
  return profiles.flatMap((profile) => ["--profile", profile]);
}

/**
 * Build a Compose subcommand that names each database, under the profiles
 * that enable them.
 *
 * @throws Error when no database is named, since Compose would then act on
 *   every service in the project.
 *
 * @returns the arguments after `docker compose --file <file>`.
 */
export function toDatabaseArgs({
  command,
  databases,
}: DatabaseCommandInput): string[] {
  if (databases.length === 0) {
    throw new Error(`no database named for docker compose ${command}`);
  }

  const profiles = [...new Set(databases.flatMap(({ profiles }) => profiles))];

  return [
    ...profileArgs(profiles),
    ...DATABASE_COMMANDS[command],
    ...databases.map(({ name }) => name),
  ];
}
