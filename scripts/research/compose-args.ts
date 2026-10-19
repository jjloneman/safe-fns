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

/** A Compose subcommand to run against a set of database services. */
type DatabaseCommandInput = {
  /**
   * The subcommand and its flags, placed before the service names.
   *
   * @example `["down", "--volumes"]`
   */
  command: readonly string[];

  /**
   * The services it acts on, by name.
   *
   * @example `[{ name: "postgres", profiles: ["db"] }]`
   */
  databases: readonly DatabaseService[];
};

/**
 * Turn profile names into Compose's `--profile` flags.
 *
 * @example `profileArgs(["db"])` → `["--profile", "db"]`
 */
export function profileArgs(profiles: readonly string[]): string[] {
  return profiles.flatMap((profile) => ["--profile", profile]);
}

/**
 * Remove database services the old way, for a Compose whose `down` takes no
 * service names.
 *
 * - `rm` leaves the services' networks behind, so it's only a fallback.
 *
 * @returns the arguments after `docker compose --file <file>`.
 */
export function toDatabaseFallbackRemovalArgs(
  databases: readonly DatabaseService[]
): string[] {
  return databaseArgs({
    command: ["rm", "--force", "--stop", "--volumes"],
    databases,
  });
}

/**
 * Remove database services by name, with their volumes and networks.
 *
 * - `down` given service names touches only those services and the networks
 *   they use; a network another running container still uses is skipped.
 *
 * @returns the arguments after `docker compose --file <file>`.
 */
export function toDatabaseRemovalArgs(
  databases: readonly DatabaseService[]
): string[] {
  return databaseArgs({ command: ["down", "--volumes"], databases });
}

/**
 * Start database services and wait on their healthchecks.
 *
 * @returns the arguments after `docker compose --file <file>`.
 */
export function toDatabaseStartArgs(
  databases: readonly DatabaseService[]
): string[] {
  return databaseArgs({
    command: ["up", "--detach", "--wait"],
    databases,
  });
}

/**
 * Build a Compose subcommand that names each database, under the profiles
 * that enable them.
 */
function databaseArgs({ command, databases }: DatabaseCommandInput): string[] {
  const profiles = [...new Set(databases.flatMap(({ profiles }) => profiles))];

  return [
    ...profileArgs(profiles),
    ...command,
    ...databases.map(({ name }) => name),
  ];
}
