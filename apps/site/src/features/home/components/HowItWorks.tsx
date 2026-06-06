import { useState } from "react";
import {
  card,
  tab,
  tabActive,
  tabLines,
  tabLinesActive,
  tabs,
  term,
  termBody,
  termLine,
  termLineBlank,
  tokAcc,
  tokCom,
  tokFn,
  tokKw,
  tokNum,
  tokStr,
  tokTyp,
} from "../../../shared/ui.js";

type Token = [
  "kw" | "fn" | "str" | "num" | "com" | "typ" | "acc" | "pl",
  string,
];

interface CodeLine {
  t: Token[];
}

interface Tab {
  id: string;
  label: string;
  code: CodeLine[];
}

const TABS: Tab[] = [
  {
    id: "vanilla",
    label: "vanilla TypeScript",
    code: [
      { t: [["com", "// summarize.ts"]] },
      {
        t: [
          ["kw", "import"],
          ["pl", " { detect } "],
          ["kw", "from"],
          ["str", ' "@web-ai-sdk/detector"'],
        ],
      },
      {
        t: [
          ["kw", "import"],
          ["pl", " { summarize } "],
          ["kw", "from"],
          ["str", ' "@web-ai-sdk/summarizer"'],
        ],
      },
      { t: [] },
      {
        t: [
          ["kw", "const"],
          ["pl", " article = "],
          ["fn", "document.querySelector"],
          ["pl", "("],
          ["str", '"article"'],
          ["pl", ")"],
        ],
      },
      {
        t: [
          ["kw", "const"],
          ["pl", " text = article?.innerText ?? "],
          ["str", '""'],
        ],
      },
      { t: [] },
      {
        t: [
          ["kw", "const"],
          ["pl", " detection = "],
          ["kw", "await"],
          ["fn", " detect"],
          ["pl", "({ input: text })"],
        ],
      },
      { t: [] },
      {
        t: [
          ["kw", "const"],
          ["pl", " { output: summary } = "],
          ["kw", "await"],
          ["fn", " summarize"],
          ["pl", "({"],
        ],
      },
      { t: [["pl", "  input: text,"]] },
      {
        t: [
          ["pl", "  language: detection.output?.language ?? "],
          ["str", '"en"'],
          ["pl", ","],
        ],
      },
      {
        t: [
          ["pl", "  type: "],
          ["str", '"key-points"'],
          ["pl", ", length: "],
          ["str", '"short"'],
          ["pl", ","],
        ],
      },
      {
        t: [
          ["pl", "  onUpdate: "],
          ["fn", "render"],
          ["pl", ","],
        ],
      },
      { t: [["pl", "})"]] },
    ],
  },
  {
    id: "react",
    label: "React hook",
    code: [
      { t: [["com", "// ArticleSummary.tsx"]] },
      {
        t: [
          ["kw", "import"],
          ["pl", " { useDetector } "],
          ["kw", "from"],
          ["str", ' "@web-ai-sdk/detector/react"'],
        ],
      },
      {
        t: [
          ["kw", "import"],
          ["pl", " { useSummarizer } "],
          ["kw", "from"],
          ["str", ' "@web-ai-sdk/summarizer/react"'],
        ],
      },
      { t: [] },
      {
        t: [
          ["kw", "export function"],
          ["fn", " ArticleSummary"],
          ["pl", "({ article }: { article: "],
          ["typ", "HTMLElement"],
          ["pl", " | "],
          ["kw", "null"],
          ["pl", " }) {"],
        ],
      },
      {
        t: [
          ["pl", "  "],
          ["kw", "const"],
          ["pl", " text = article?.innerText ?? "],
          ["str", '""'],
        ],
      },
      {
        t: [
          ["pl", "  "],
          ["kw", "const"],
          ["pl", " { output: lang } = "],
          ["fn", "useDetector"],
          ["pl", "({ input: text })"],
        ],
      },
      { t: [] },
      {
        t: [
          ["pl", "  "],
          ["kw", "const"],
          ["pl", " { status, output } = "],
          ["fn", "useSummarizer"],
          ["pl", "({"],
        ],
      },
      { t: [["pl", "    input: text,"]] },
      {
        t: [
          ["pl", "    language: lang?.language ?? "],
          ["str", '"en"'],
          ["pl", ","],
        ],
      },
      {
        t: [
          ["pl", "    type: "],
          ["str", '"key-points"'],
          ["pl", ", length: "],
          ["str", '"short"'],
          ["pl", ","],
        ],
      },
      { t: [["pl", "  })"]] },
      { t: [] },
      {
        t: [
          ["kw", "  if"],
          ["pl", " (status === "],
          ["str", '"unavailable"'],
          ["pl", ") "],
          ["kw", "return null"],
        ],
      },
      {
        t: [
          ["kw", "  return"],
          ["pl", " <"],
          ["acc", "aside"],
          ["pl", ">{output}</"],
          ["acc", "aside"],
          ["pl", ">"],
        ],
      },
      { t: [["pl", "}"]] },
    ],
  },
  {
    id: "raw",
    label: "raw browser API",
    code: [
      { t: [["com", "// what the wrappers do for you"]] },
      { t: [] },
      { t: [["com", "// 1. Detect the input language."]] },
      {
        t: [
          ["kw", "if"],
          ["pl", " ("],
          ["kw", "typeof"],
          ["pl", " LanguageDetector === "],
          ["str", '"undefined"'],
          ["pl", ") {"],
        ],
      },
      {
        t: [
          ["pl", "  "],
          ["kw", "throw new"],
          ["fn", " Error"],
          ["pl", "("],
          ["str", '"LanguageDetector API not available"'],
          ["pl", ")"],
        ],
      },
      { t: [["pl", "}"]] },
      {
        t: [
          ["kw", "const"],
          ["pl", " detector = "],
          ["kw", "await"],
          ["pl", " LanguageDetector."],
          ["fn", "create"],
          ["pl", "()"],
        ],
      },
      {
        t: [
          ["kw", "const"],
          ["pl", " article = "],
          ["fn", "document.querySelector"],
          ["pl", "("],
          ["str", '"article"'],
          ["pl", ")"],
        ],
      },
      {
        t: [
          ["kw", "const"],
          ["pl", " input = article?.innerText?."],
          ["fn", "trim"],
          ["pl", "() ?? "],
          ["str", '""'],
        ],
      },
      {
        t: [
          ["kw", "const"],
          ["pl", " results = "],
          ["kw", "await"],
          ["pl", " detector."],
          ["fn", "detect"],
          ["pl", "(input)"],
        ],
      },
      {
        t: [
          ["kw", "const"],
          ["pl", " language = results["],
          ["num", "0"],
          ["pl", "]?.detectedLanguage ?? "],
          ["str", '"en"'],
        ],
      },
      { t: [] },
      { t: [["com", "// 2. Then summarize in that language."]] },
      {
        t: [
          ["kw", "if"],
          ["pl", " ("],
          ["kw", "typeof"],
          ["pl", " Summarizer === "],
          ["str", '"undefined"'],
          ["pl", ") {"],
        ],
      },
      {
        t: [
          ["pl", "  "],
          ["kw", "throw new"],
          ["fn", " Error"],
          ["pl", "("],
          ["str", '"Summarizer API not available"'],
          ["pl", ")"],
        ],
      },
      { t: [["pl", "}"]] },
      {
        t: [
          ["kw", "const"],
          ["pl", " opts = { type: "],
          ["str", '"key-points"'],
          ["pl", ", length: "],
          ["str", '"short"'],
          ["pl", ","],
        ],
      },
      {
        t: [
          [
            "pl",
            "  expectedInputLanguages: [language], outputLanguage: language }",
          ],
        ],
      },
      {
        t: [
          ["kw", "const"],
          ["pl", " caps = "],
          ["kw", "await"],
          ["pl", " Summarizer."],
          ["fn", "availability"],
          ["pl", "(opts)"],
        ],
      },
      {
        t: [
          ["kw", "if"],
          ["pl", " (caps === "],
          ["str", '"unavailable"'],
          ["pl", ") "],
          ["kw", "throw new"],
          ["fn", " Error"],
          ["pl", "("],
          ["str", '"no model"'],
          ["pl", ")"],
        ],
      },
      { t: [] },
      {
        t: [
          ["kw", "const"],
          ["pl", " controller = "],
          ["kw", "new"],
          ["fn", " AbortController"],
          ["pl", "()"],
        ],
      },
      {
        t: [
          ["kw", "const"],
          ["pl", " summarizer = "],
          ["kw", "await"],
          ["pl", " Summarizer."],
          ["fn", "create"],
          ["pl", "({ ...opts,"],
        ],
      },
      {
        t: [
          ["pl", "  monitor(m) { m."],
          ["fn", "addEventListener"],
          ["pl", "("],
          ["str", '"downloadprogress"'],
          ["pl", ", e => {"],
        ],
      },
      {
        t: [
          ["pl", "    console."],
          ["fn", "log"],
          ["pl", "(`download ${"],
          ["fn", "Math.round"],
          ["pl", "(e.loaded * "],
          ["num", "100"],
          ["pl", ")}%`)"],
        ],
      },
      { t: [["pl", "  }) },"]] },
      { t: [["pl", "  signal: controller.signal,"]] },
      { t: [["pl", "})"]] },
      { t: [] },
      {
        t: [
          ["kw", "let"],
          ["pl", " buffer = "],
          ["str", '""'],
        ],
      },
      {
        t: [
          ["kw", "for await"],
          ["pl", " ("],
          ["kw", "const"],
          ["pl", " chunk "],
          ["kw", "of"],
          ["pl", " summarizer."],
          ["fn", "summarizeStreaming"],
          ["pl", "(input, { signal: controller.signal })) {"],
        ],
      },
      {
        t: [
          [
            "com",
            "  // Chrome streams deltas; Edge / Phi-Silica streams cumulative.",
          ],
        ],
      },
      {
        t: [
          ["pl", "  buffer = chunk."],
          ["fn", "startsWith"],
          ["pl", "(buffer) ? chunk : buffer + chunk"],
        ],
      },
      {
        t: [
          [
            "com",
            "  // strip Edge soft-block placeholders (C0 / C1 control chars)",
          ],
        ],
      },
      {
        t: [
          ["fn", "  render"],
          ["pl", "(buffer."],
          ["fn", "replace"],
          ["pl", "(/[\\u0000-\\u001F\\u007F-\\u009F]/g, "],
          ["str", '""'],
          ["pl", "))"],
        ],
      },
      { t: [["pl", "}"]] },
      {
        t: [["com", "// + session cache, abort wiring, error normalization…"]],
      },
    ],
  },
];

const TOK_CLASS: Record<string, string> = {
  kw: tokKw,
  fn: tokFn,
  str: tokStr,
  num: tokNum,
  com: tokCom,
  typ: tokTyp,
  acc: tokAcc,
};

const TermLine = ({ tokens }: { tokens: Token[] }) => (
  <div
    className={`${termLine}${tokens.length === 0 ? ` ${termLineBlank}` : ""}`}
  >
    <span>
      {tokens.map(([k, v], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional, never reordered; index is the only stable key
        <span key={`${k}-${i}`} className={k === "pl" ? "" : TOK_CLASS[k]}>
          {v}
        </span>
      ))}
    </span>
  </div>
);

const FIRST_TAB =
  TABS[0] ?? raise("HowItWorks: TABS must contain at least one entry");

function raise(message: string): never {
  throw new Error(message);
}

export const HowItWorks = () => {
  const [tabId, setTabId] = useState("vanilla");
  const data = TABS.find((t) => t.id === tabId) ?? FIRST_TAB;
  return (
    <div className={card}>
      <div className={tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tabId}
            className={t.id === tabId ? tabActive : tab}
            onClick={() => setTabId(t.id)}
          >
            {t.label}
            <span
              className={`${tabLines} ${t.id === tabId ? tabLinesActive : ""}`}
            >
              {t.code.length}L
            </span>
          </button>
        ))}
      </div>
      <div className={term}>
        <div className={termBody}>
          <pre className="m-0">
            {data.code.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: code lines are positional within a tab; index is the only stable key
              <TermLine key={`${tabId}-${i}`} tokens={line.t} />
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
};
