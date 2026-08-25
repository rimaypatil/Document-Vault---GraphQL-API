import { spawnSync } from "child_process";
import { writeFileSync } from "fs";

const status = spawnSync("git", ["status"], { encoding: "utf-8" }).stdout;
const log = spawnSync("git", ["log", "--oneline", "-n", "5"], { encoding: "utf-8" }).stdout;

writeFileSync("log_out.txt", `STATUS:\n${status}\nLOG:\n${log}`);
