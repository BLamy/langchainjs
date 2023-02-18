import { InputValues } from "./index";

// type ExtractParam<Path, NextPart> = Path extends `{${infer Param}}` ? Record<Param, string> & NextPart : NextPart;

// type ExctractParams<Path> = Path extends `${infer Segment} ${infer Rest}`
//   ? ExtractParam<Segment, ExctractParams<Rest>>
//   : ExtractParam<Path, {}>

// const bar: ExctractParams<"tell me a joke about {jokeType}"> = {jokeType: "some id"};


type JokeTypes = "funny" | "dumb"


type ExtractParam<Path, NextPart> = Path extends `${infer A}${infer Param}` ? {[AA in A as `${AA}test`]: string } & { 
  [K in Param]: string
} & NextPart : NextPart;

type ExctractParams<Path> = Path extends `${infer Segment} ${infer Rest}`
  ? ExtractParam<Segment, ExctractParams<Rest>>
  : ExtractParam<Path, {}>

type ParsedFString<FString> = ExctractParams<FString>

const bar: ExctractParams<"tell me {numJokes} jokes about {jokeType}"> = { type: "variable", name: "numJokes"}

export type TemplateFormat = "f-string" | "jinja2";

type ParsedFStringNode =
  | { type: "literal"; text: string }
  | { type: "variable"; name: string };

export const parseFString = <T extends string>(template: T): ParsedFString<T> => {
  // Core logic replicated from internals of pythons built in Formatter class.
  // https://github.com/python/cpython/blob/135ec7cefbaffd516b77362ad2b2ad1025af462e/Objects/stringlib/unicode_format.h#L700-L706
  const chars: Split<T> = template.split("" as const) as const;
  const nodes: ParsedFStringNode[] = [];

  const nextBracket = (bracket: "}" | "{" | "{}", start: number) => {
    for (let i = start; i < chars.length; i += 1) {
      if (bracket.includes(chars[i])) {
        return i;
      }
    }
    return -1;
  };

  let i = 0;
  while (i < chars.length) {
    if (chars[i] === "{" && i + 1 < chars.length && chars[i + 1] === "{") {
      nodes.push({ type: "literal", text: "{" });
      i += 2;
    } else if (
      chars[i] === "}" &&
      i + 1 < chars.length &&
      chars[i + 1] === "}"
    ) {
      nodes.push({ type: "literal", text: "}" });
      i += 2;
    } else if (chars[i] === "{") {
      const j = nextBracket("}", i);
      if (j < 0) {
        throw new Error("Unclosed '{' in template.");
      }

      nodes.push({
        type: "variable",
        name: chars.slice(i + 1, j).join(""),
      });
      i = j + 1;
    } else if (chars[i] === "}") {
      throw new Error("Single '}' in template.");
    } else {
      const next = nextBracket("{}", i);
      const text = (next < 0 ? chars.slice(i) : chars.slice(i, next)).join("");
      nodes.push({ type: "literal", text });
      i = next < 0 ? chars.length : next;
    }
  }
  return nodes;
};

export const interpolateFString = (template: string, values: InputValues) =>
  parseFString(template).reduce((res, node) => {
    if (node.type === "variable") {
      if (node.name in values) {
        return res + values[node.name];
      }
      throw new Error(`Missing value for input ${node.name}`);
    }

    return res + node.text;
  }, "");

type Interpolator = (template: string, values: InputValues) => string;

export const DEFAULT_FORMATTER_MAPPING: Record<TemplateFormat, Interpolator> = {
  "f-string": interpolateFString,
  jinja2: (_: string, __: InputValues) => "",
};

export const renderTemplate = (
  template: string,
  templateFormat: TemplateFormat,
  inputValues: InputValues
) => DEFAULT_FORMATTER_MAPPING[templateFormat](template, inputValues);

export const checkValidTemplate = (
  template: string,
  templateFormat: TemplateFormat,
  inputVariables: string[]
) => {
  if (!(templateFormat in DEFAULT_FORMATTER_MAPPING)) {
    const validFormats = Object.keys(DEFAULT_FORMATTER_MAPPING);
    throw new Error(`Invalid template format. Got \`${templateFormat}\`;
                         should be one of ${validFormats}`);
  }
  try {
    const dummyInputs: InputValues = inputVariables.reduce((acc, v) => {
      acc[v] = "foo";
      return acc;
    }, {} as Record<string, string>);
    renderTemplate(template, templateFormat, dummyInputs);
  } catch {
    throw new Error("Invalid prompt schema.");
  }
};
