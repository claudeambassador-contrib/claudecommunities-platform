/**
 * Mapping from raw MCP tool name to a friendly noun/verb CLI command.
 *
 * The dispatcher walks the cached tool list and, for each tool, consults this
 * map to decide where the tool lives in the command tree. Tools NOT listed
 * here are appended under `ccau raw <toolName>` so new server-side tools
 * keep working without a CLI release.
 *
 * Example:
 *   getFeed → group "feed", command "list", flag --limit shortened to -n
 *   updatePost → group "post", command "update", schema prop `postId` becomes a positional <id>
 */

export interface CommandMapping {
  /** Top-level command group (e.g. "feed", "post", "event"). */
  group: string
  /** Verb within the group (e.g. "list", "create", "update"). */
  command: string
  /** Short, friendly description shown in `ccau <group> --help`. Falls back to the tool's description if omitted. */
  description?: string
  /**
   * Schema properties to render as positional CLI arguments instead of flags.
   * Order matters — they appear left-to-right in the usage line.
   */
  positional?: string[]
  /** Short-flag overrides, keyed by the schema property name. Value is the single-letter short flag (no dash). */
  shortFlags?: Record<string, string>
  /** Rename flags. Maps schema property name → new flag name (without dashes). Useful when --my-thing reads better than --schema-name. */
  rename?: Record<string, string>
}

export const COMMAND_MAP: Record<string, CommandMapping> = {
  // -------- Feed (community posts) --------
  getFeed: {
    group: 'feed',
    command: 'list',
    description: 'List community feed posts (optionally filtered by space)',
    shortFlags: { limit: 'n', spaceSlug: 's' },
  },

  // -------- Posts --------
  getPost: {
    group: 'post',
    command: 'get',
    description: 'Show a single post with its comments',
    positional: ['postId'],
  },
  createPost: {
    group: 'post',
    command: 'create',
    description: 'Create a new post in a space',
  },
  updatePost: {
    group: 'post',
    command: 'update',
    description: 'Update an existing post',
    positional: ['postId'],
  },
  likePost: {
    group: 'post',
    command: 'like',
    description: 'Toggle like on a post',
    positional: ['postId'],
  },

  // -------- Comments --------
  addComment: {
    group: 'comment',
    command: 'add',
    description: 'Add a comment to a post',
  },

  // -------- Spaces --------
  getSpaces: {
    group: 'space',
    command: 'list',
    description: 'List all community spaces',
  },

  // -------- Events --------
  getEvents: {
    group: 'event',
    command: 'list',
    description: 'List community events',
    shortFlags: { upcoming: 'u' },
  },
  createEvent: {
    group: 'event',
    command: 'create',
    description: 'Create a new event',
  },
  updateEvent: {
    group: 'event',
    command: 'update',
    description: 'Update an existing event',
    positional: ['eventId'],
  },
  deleteEvent: {
    group: 'event',
    command: 'delete',
    description: 'Delete an event',
    positional: ['eventId'],
  },

  // -------- Courses --------
  getCourses: {
    group: 'course',
    command: 'list',
    description: 'List published courses',
  },
  createCourse: {
    group: 'course',
    command: 'create',
    description: 'Create a new course',
  },
  updateCourse: {
    group: 'course',
    command: 'update',
    description: 'Update a course',
    positional: ['courseId'],
  },
  deleteCourse: {
    group: 'course',
    command: 'delete',
    description: 'Delete a course',
    positional: ['courseId'],
  },

  // -------- Scheduled courses (workshops / bootcamps) --------
  getScheduledCourses: {
    group: 'scheduled-course',
    command: 'list',
    description: 'List published scheduled courses (workshops, bootcamps, webinars)',
    shortFlags: { upcoming: 'u' },
  },
  createScheduledCourse: {
    group: 'scheduled-course',
    command: 'create',
    description: 'Create a new scheduled course',
  },
  updateScheduledCourse: {
    group: 'scheduled-course',
    command: 'update',
    description: 'Update a scheduled course',
    positional: ['courseId'],
  },
  deleteScheduledCourse: {
    group: 'scheduled-course',
    command: 'delete',
    description: 'Delete a scheduled course',
    positional: ['courseId'],
  },

  // -------- Users --------
  listUsers: {
    group: 'user',
    command: 'list',
    description: 'List community users',
    shortFlags: { limit: 'n' },
  },
  getUserProfile: {
    group: 'user',
    command: 'me',
    description: 'Show your own profile',
  },

  // -------- Media uploads --------
  requestImageUploadUrl: {
    group: 'image',
    command: 'upload-url',
    description: 'Get a curl command to upload an image (then pass the resulting URL to `post create --image-url`)',
  },
}

export function lookupMapping(toolName: string): CommandMapping | undefined {
  return COMMAND_MAP[toolName]
}
