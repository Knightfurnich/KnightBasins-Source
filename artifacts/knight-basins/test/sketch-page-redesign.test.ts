import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const studioPageUrl = new URL("../src/components/StudioPage.tsx", import.meta.url);
const cssUrl = new URL("../src/index.css", import.meta.url);
const [studioPageSource, cssSource] = await Promise.all([
  readFile(studioPageUrl, "utf8"),
  readFile(cssUrl, "utf8"),
]);
const studioPageAst = ts.createSourceFile(
  fileURLToPath(studioPageUrl),
  studioPageSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement;

function findVariableDeclaration(name: string): ts.VariableDeclaration {
  const declarations: ts.VariableDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(studioPageAst);
  assert.equal(declarations.length, 1, `StudioPage should declare ${name} exactly once`);
  return declarations[0];
}

function jsxAttributes(element: JsxNode): ts.JsxAttributes {
  return ts.isJsxElement(element) ? element.openingElement.attributes : element.attributes;
}

function jsxAttributeValue(element: JsxNode, name: string): string | undefined {
  const attribute = jsxAttributes(element).properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === name,
  );
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  return attribute.initializer.getText(studioPageAst);
}

function collectJsxNodes(root: ts.Node): JsxNode[] {
  const elements: JsxNode[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return elements;
}

function unwrapParenthesized(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function findJsxByTestId(root: ts.Node, testId: string): JsxNode | undefined {
  return collectJsxNodes(root).find((element) => jsxAttributeValue(element, "data-testid")?.includes(testId));
}

describe("Sketch page redesign", () => {
  it("renders the upload step before the optional stone and basin shortlists", () => {
    const layout = findVariableDeclaration("studioDesignLayout");
    assert.ok(layout.initializer && ts.isConditionalExpression(layout.initializer));

    const sketchLayout = unwrapParenthesized(layout.initializer.whenTrue);
    assert.ok(ts.isJsxElement(sketchLayout), "sketch mode should render a dedicated layout");
    assert.equal(jsxAttributeValue(sketchLayout, "data-testid"), "studio-sketch-flow");

    const stepIds = collectJsxNodes(sketchLayout)
      .map((element) => jsxAttributeValue(element, "data-testid"))
      .filter((value) => value === "step-studio-sketch-upload" || value === "step-studio-sketch-shortlists");
    assert.deepEqual(stepIds, ["step-studio-sketch-upload", "step-studio-sketch-shortlists"]);

    const uploadStep = findJsxByTestId(sketchLayout, "step-studio-sketch-upload");
    const shortlistStep = findJsxByTestId(sketchLayout, "step-studio-sketch-shortlists");
    assert.ok(uploadStep);
    assert.ok(shortlistStep);
    assert.match(uploadStep.getText(studioPageAst), /studioSketchUploadPanel/);
    assert.match(shortlistStep.getText(studioPageAst), /StudioShortlists/);
    assert.match(shortlistStep.getText(studioPageAst), /เลือกสเปกที่สนใจเบื้องต้น \(ไม่บังคับ\) เพื่อให้ทีมงานช่วยวางผังให้ตรงรุ่น หรือปล่อยว่างเพื่อให้ทีมงานช่วยแนะนำ/);
  });

  it("keeps the contact form, live estimate, and sketch submission together in step three", () => {
    const detailsStep = findJsxByTestId(studioPageAst, "step-studio-sketch-details");
    assert.ok(detailsStep);
    const detailsSource = detailsStep.getText(studioPageAst);
    assert.match(detailsSource, /studio-contact-panel/);
    assert.match(detailsSource, /estimatePanel/);

    const estimatePanel = findVariableDeclaration("estimatePanel");
    assert.ok(estimatePanel.initializer);
    const estimateSource = estimatePanel.initializer.getText(studioPageAst);
    assert.match(estimateSource, /studio-estimate-panel/);
    assert.match(estimateSource, /LIVE ESTIMATE/);
    assert.match(estimateSource, /button-submit-sketch/);
    assert.match(estimateSource, /🚀 ส่งภาพแบบร่างให้ทีมขายประเมินราคา/);
  });

  it("preserves sketch upload test IDs and supports file-picker and drag-and-drop uploads", () => {
    const uploadPanel = findVariableDeclaration("studioSketchUploadPanel");
    assert.ok(uploadPanel.initializer);
    const uploadSource = uploadPanel.initializer.getText(studioPageAst);

    for (const testId of ["input-studio-sketch", "grid-studio-sketch-slots"]) {
      assert.ok(studioPageSource.includes(`data-testid="${testId}"`), `missing ${testId}`);
    }
    for (const testId of [
      "slot-studio-sketch-${index}",
      "img-studio-sketch-preview-${index}",
      "button-remove-studio-sketch-${index}",
      "button-add-studio-sketch-${index}",
    ]) {
      assert.ok(studioPageSource.includes(`data-testid={\`${testId}\`}`), `missing ${testId}`);
    }

    assert.match(studioPageSource, /const MAX_SKETCH_FILES = 3/);
    assert.match(uploadSource, /onDragEnter=/);
    assert.match(uploadSource, /onDragOver=/);
    assert.match(uploadSource, /onDrop=/);
    assert.match(uploadSource, /addSketchFiles\(Array\.from\(event\.dataTransfer\.files\)\)/);
    assert.match(uploadSource, /sketchInputRef\.current\?\.click\(\)/);
    assert.match(uploadSource, /type="file" multiple/);
    assert.match(uploadSource, /<small>เพิ่มรูป<\/small>/);
  });

  it("uses a full-width upload area, balanced desktop columns, and a single-column mobile flow", () => {
    const sketchLayoutRule = cssSource.match(/\.studio-page--sketch \.studio-design-layout--sketch\s*\{([^}]*)\}/);
    assert.ok(sketchLayoutRule);
    assert.match(sketchLayoutRule[1], /grid-template-columns:\s*minmax\(0,\s*1fr\)/);

    const shortlistRule = cssSource.match(/\.studio-page--sketch \.studio-shortlists\s*\{([^}]*)\}/);
    assert.ok(shortlistRule);
    assert.match(shortlistRule[1], /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);

    const bottomRule = cssSource.match(/\.studio-page--sketch \.studio-layout-bottom--sketch\s*\{([^}]*)\}/);
    assert.ok(bottomRule);
    assert.match(bottomRule[1], /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);

    const mobileSketchRules = cssSource.slice(cssSource.lastIndexOf("@media (max-width: 720px)"));
    assert.match(mobileSketchRules, /\.studio-page--sketch \.studio-shortlists,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.match(mobileSketchRules, /\.studio-page--sketch \.studio-sketch-slots\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  });
});