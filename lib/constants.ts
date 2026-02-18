/** Maximum number of players allowed in the lobby */
export const MAX_PLAYERS = 40;

/** Number of players per team */
export const TEAM_SIZE = 4;

/** Inactivity timeout in milliseconds (10 minutes) */
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

/** Heartbeat interval in milliseconds (30 seconds) */
export const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** Admin credentials (MVP only — replace with proper auth for production) */
export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'root';

/** Admin session cookie name */
export const ADMIN_COOKIE = 'survivor_admin_session';

/** Test user cookie name */
export const TEST_USER_COOKIE = 'survivor_test_user';

/** Test user credentials */
export const TEST_EMAIL = 'test@gmail.com';
export const TEST_PASSWORD = 'test';

/** Cloudflare R2 config (placeholder — user must set in .env.local) */
export const CLOUDFLARE_UPLOAD_ENABLED = true;
