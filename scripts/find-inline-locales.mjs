import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";

const file = "app/page.tsx";
const sourceText = await readFile(file, "utf8");
const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const adminFile = "app/components/admin-server-panel.tsx";
const adminText = await readFile(adminFile, "utf8");
const adminSource = ts.createSourceFile(adminFile, adminText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const guideFile = "app/guide-content.ts";
const guideText = await readFile(guideFile, "utf8");
const guideSource = ts.createSourceFile(guideFile, guideText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function localeCode(test) {
  if (!ts.isBinaryExpression(test) || test.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken) return null;
  if (ts.isIdentifier(test.left) && test.left.text === "locale" && ts.isStringLiteral(test.right)) return test.right.text;
  if (ts.isStringLiteral(test.left) && ts.isIdentifier(test.right) && test.right.text === "locale") return test.left.text;
  return null;
}

function chain(node) {
  const codes = [];
  let cursor = node;
  while (ts.isConditionalExpression(cursor)) {
    const code = localeCode(cursor.condition);
    if (!code) break;
    codes.push(code);
    cursor = cursor.whenFalse;
  }
  return { codes, fallback: cursor };
}

function isNestedFalseBranch(node) {
  return ts.isConditionalExpression(node.parent) && node.parent.whenFalse === node && localeCode(node.parent.condition);
}

const candidates = [];
const helperNames = new Set(["ui", "guideUi", "guideViewUi", "serviceUi", "serviceStatusUi", "kakaoTip"]);
const helperNodes = [];
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name && helperNames.has(node.name.text)) helperNodes.push(node);
  if (ts.isConditionalExpression(node) && !isNestedFalseBranch(node)) {
    const result = chain(node);
    if (result.codes.includes("ko")) candidates.push({ node, ...result });
  }
  ts.forEachChild(node, visit);
}
visit(source);

const phrases = new Set();
function collectPhrases(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const isPropertyName = (ts.isPropertyAssignment(node.parent) || ts.isMethodDeclaration(node.parent)) && node.parent.name === node;
    if (!isPropertyName && node.text.trim()) phrases.add(node.text);
  } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
    if (node.text.trim()) phrases.add(node.text);
  }
  ts.forEachChild(node, collectPhrases);
}
candidates.forEach((candidate) => collectPhrases(candidate.fallback));
helperNodes.forEach(collectPhrases);
collectPhrases(adminSource);
collectPhrases(guideSource);

for (const [index, candidate] of candidates.entries()) {
  const line = source.getLineAndCharacterOfPosition(candidate.node.getStart(source)).line + 1;
  console.log(index, line, candidate.codes.join(","), ts.SyntaxKind[candidate.fallback.kind], candidate.fallback.getText(source).slice(0, 180).replaceAll("\n", " "));
}
console.log(`candidates=${candidates.length}`);

const englishPhrases = [...phrases].filter((value) => !/[가-힣\u3040-\u30ff\u3400-\u9fff]/u.test(value));
await writeFile("scripts/legacy-copy-source.json", `${JSON.stringify(englishPhrases.sort((a, b) => a.localeCompare(b)), null, 2)}\n`, "utf8");

if (process.argv.includes("--apply")) {
  const replacements = candidates
    .map(({ fallback }) => ({ start: fallback.getStart(source), end: fallback.getEnd(), text: `legacyCopy(locale, ${fallback.getText(source)})` }))
    .sort((left, right) => right.start - left.start);
  let output = sourceText;
  for (const replacement of replacements) output = `${output.slice(0, replacement.start)}${replacement.text}${output.slice(replacement.end)}`;
  const importMarker = 'import { supportedLocales, localeNames, type Locale } from "./i18n/types";';
  if (!output.includes('from "./i18n/legacy-copy"')) output = output.replace(importMarker, `${importMarker}\nimport { legacyCopy } from "./i18n/legacy-copy";`);
  await writeFile(file, output, "utf8");
  console.log(`wrapped=${replacements.length}`);
}
