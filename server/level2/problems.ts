export type Level2Problem = {
  id: string;
  question: string;
  answer: string;
  acceptableAnswers?: string[];
};

/**
 * Level 2 Chromium Search Challenge
 * Target: Chromium commit e4b8a7b2a2
 * 
 * Each question requires tracing logic across >= 10 files and >= 4 subsystems,
 * crossing at least one process boundary. Questions use plain English synonyms
 * and no code literals to force broad search.
 */
export const LEVEL2_PROBLEMS: Level2Problem[] = [
  {
    id: "l2_1",
    question: "When a web page executes a command to open a local file selection dialog, what is the status code name returned if the tab is currently visible in a split-view mode but does not have active focus at the precise moment of the request?",
    answer: "kOperationAborted",
    acceptableAnswers: ["kOperationAborted", "9", "OperationAborted"],
  },
  {
    id: "l2_2",
    question: "When a site continuously monitors for connected physical game controllers but the person using the machine has not yet interacted with the hardware, how many game controllers are reported in the list returned to the site?",
    answer: "0",
    acceptableAnswers: ["0", "zero", "none"],
  },
  {
    id: "l2_3",
    question: "If a web application attempts to transmit local files to other native programs using the standard sharing interface, the browser process validates the site's reputation. If the background query to the safety database reaches its maximum allowed duration without a result, what is the numeric value of the threat type finally assigned to the site by the reputation service?",
    answer: "1",
    acceptableAnswers: ["1", "SB_THREAT_TYPE_SAFE", "SAFE"],
  },
  {
    id: "l2_4",
    question: "When a site attempts to copy text to the system buffer, but an organizational security policy determines the site's address is restricted, what specific localized content is placed into the buffer instead of the original text?",
    answer: "warning message",
    acceptableAnswers: ["warning message", "warning", "restriction message", "localized warning"],
  },
  {
    id: "l2_10",
    question: "When a user logs in using saved credentials from a related but non-identical address (such as a mobile app or a sub-brand domain), what specific modification does the system make to its internal records for the current site's address to improve future login accuracy?",
    answer: "create duplicate record",
    acceptableAnswers: ["create duplicate record", "add duplicate", "duplicate record", "new duplicate record", "create duplicate"],
  },
  {
    id: "l2_4",
    question: "When a site attempts to copy text to the system buffer, but an organizational security policy determines the site's address is restricted, what general type of content is placed into the buffer instead of the original text?",
    answer: "warning message",
    acceptableAnswers: ["warning message", "warning", "restriction message", "localized warning"],
  },
  {
    id: "l2_5",
    question: "When a page attempts to move its audio output to a new speaker but the underlying operating system reports a fatal initialization error for that hardware, what is the specific status name of the resulting hardware state?",
    answer: "OUTPUT_DEVICE_STATUS_ERROR_INTERNAL",
    acceptableAnswers: ["OUTPUT_DEVICE_STATUS_ERROR_INTERNAL", "4", "ERROR_INTERNAL"],
  },
  {
    id: "l2_6",
    question: "A background download task for multiple files is configured with a maximum size limit. If a cross-origin resource fails its security checks and the total data eventually exceeds the limit, what specific failure category name is reported to the site instead of a quota error?",
    answer: "FETCH_ERROR",
    acceptableAnswers: ["FETCH_ERROR", "4", "fetch error"],
  },
  {
    id: "l2_7",
    question: "When a background execution context attempts to save a massive data structure to the local database but the system disk space is completely exhausted during the write, what is the name of the exception provided to the script's failure handler?",
    answer: "QuotaExceededError",
    acceptableAnswers: ["QuotaExceededError", "22", "kQuotaExceededError"],
  },
  {
    id: "l2_8",
    question: "A web page attempts to create a new file within a directory it has previously accessed. If the underlying operating system has marked that directory as read-only, what is the name of the exception returned to the script to describe the failure?",
    answer: "NoModificationAllowedError",
    acceptableAnswers: ["NoModificationAllowedError", "kNoModificationAllowedError"],
  },
  {
    id: "l2_9",
    question: "When a long-running background download completes its network phase but fails to save because the site's assigned storage limit is reached, what is the specific internal failure name for the termination of the download job?",
    answer: "QUOTA_EXCEEDED",
    acceptableAnswers: ["QUOTA_EXCEEDED", "6", "quota exceeded"],
  },
  {
    id: "l2_10",
    question: "When a user logs in using saved credentials from a related but non-identical address (such as a mobile app or a sub-brand domain), what specific modification does the system make to its internal records for the current site's address to improve future login accuracy?",
    answer: "create duplicate",
    acceptableAnswers: ["create duplicate", "add duplicate", "duplicate record", "new duplicate record"],
  },
];
