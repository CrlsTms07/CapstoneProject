// Shared – test helper: marks the process as a test run before any src/ file is loaded
// (skips the startup database check). Unit tests never connect to PostgreSQL.
process.env.NODE_ENV = 'test'
