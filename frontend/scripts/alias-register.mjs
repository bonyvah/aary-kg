// Lets the check scripts (plain Node) understand the app's `@/` import alias.
// Use: node --import ./scripts/alias-register.mjs scripts/check-something.mts
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
