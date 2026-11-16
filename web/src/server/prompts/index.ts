// The prompts for every model call, one file per call, each versioned (PROMPT_VERSIONS in
// src/config/ai.ts). The person's writing and answers are always passed as data inside tags,
// never as instructions. Order in each prompt: the task, then the data, then the task restated.
export * from "./check";
export * from "./draft";
export * from "./queries";
