import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import {
  clearStudioEdgeStatus,
  preserveCustomEdgesOnShapeChange,
  setStudioEdgeStatus,
  sideStatusKey,
  studioPieceEdges,
  studioPieceJoints,
  studioSideStatuses,
  type SideStatus,
  type StudioPiece,
} from "../src/data/studio-model.ts";

const studioPageUrl = new URL("../src/components/StudioPage.tsx", import.meta.url);
const appUrl = new URL("../src/App.tsx", import.meta.url);
const cssUrl = new URL("../src/index.css", import.meta.url);
const [studioPageSource, appSource, cssSource] = await Promise.all([
  readFile(studioPageUrl, "utf8"),
  readFile(appUrl, "utf8"),
  readFile(cssUrl, "utf8"),
]);
const studioPageAst = ts.createSourceFile(
  fileURLToPath(studioPageUrl),
  studioPageSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

type StudioSide = "top" | "right" | "bottom" | "left";
type ChangeStatus = (rectangleId: string, side: StudioSide, status: SideStatus) => void;
type SetPieceState = (
  setState: unknown,
  pieceId: string,
  update: (current: StudioPiece) => StudioPiece,
) => void;

function loadChangeStatus(
  componentName: "StudioPieceEditorLegacy" | "StudioPieceEditor",
  setCalls: { set: number; clear: number },
  updatePiece: SetPieceState,
) {
  const component = studioPageAst.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === componentName,
  );
  assert.ok(component, `StudioPage should declare ${componentName}`);
  const declarations: ts.VariableDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "changeStatus") {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(component);
  assert.equal(declarations.length, 1, `${componentName} should declare one edge-status change handler`);

  const initializer = declarations[0].initializer;
  assert.ok(initializer, "changeStatus should have an initializer");
  const functionSource = `const changeStatus = ${initializer.getText(studioPageAst)};\nreturn changeStatus;`;
  const compiled = ts.transpileModule(functionSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const piece = { id: "piece-1" };
  const setState = () => undefined;
  const wrappedSetStudioEdgeStatus = (
    current: StudioPiece,
    rectangleId: string,
    side: StudioSide,
    status: SideStatus,
  ) => {
    setCalls.set += 1;
    return setStudioEdgeStatus(current, rectangleId, side, status);
  };
  const wrappedClearStudioEdgeStatus = (current: StudioPiece, rectangleId: string, side: StudioSide) => {
    setCalls.clear += 1;
    return clearStudioEdgeStatus(current, rectangleId, side);
  };

  return new Function(
    "setPieceState",
    "setState",
    "piece",
    "studioPieceEdges",
    "studioPieceJoints",
    "sideStatusKey",
    "setStudioEdgeStatus",
    "clearStudioEdgeStatus",
    compiled,
  )(
    updatePiece,
    setState,
    piece,
    studioPieceEdges,
    studioPieceJoints,
    sideStatusKey,
    wrappedSetStudioEdgeStatus,
    wrappedClearStudioEdgeStatus,
  ) as ChangeStatus;
}

function loadApplySimpleShapeEdgeDefaults(
  preserveEdges: typeof preserveCustomEdgesOnShapeChange = preserveCustomEdgesOnShapeChange,
) {
  const declaration = studioPageAst.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "applySimpleShapeEdgeDefaults",
  );
  assert.ok(declaration, "StudioPage should declare applySimpleShapeEdgeDefaults");
  const functionSource = `${studioPageSource.slice(declaration.getStart(studioPageAst), declaration.end)}\nreturn applySimpleShapeEdgeDefaults;`;
  const compiled = ts.transpileModule(functionSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(
    "studioPieceEdges",
    "studioSideStatuses",
    "sideStatusKey",
    "preserveCustomEdgesOnShapeChange",
    compiled,
  )(
    studioPieceEdges,
    studioSideStatuses,
    sideStatusKey,
    preserveEdges,
  ) as (previousPiece: StudioPiece, nextPiece: StudioPiece) => StudioPiece;
}

const rectangle = (id: string, overrides: Partial<StudioPiece["rectangles"][number]> = {}) => ({
  id,
  widthMm: 1000,
  lengthMm: 600,
  xMm: 0,
  yMm: 0,
  rotation: 0 as const,
  label: id,
  ...overrides,
});

const piece = (
  rectangles: StudioPiece["rectangles"] = [rectangle("r1")],
  sideStatuses: Record<string, SideStatus> = {},
  hasCustomEdges = false,
): StudioPiece => ({
  id: "piece-1",
  name: "ชิ้นงาน 1",
  rectangles,
  sideStatuses,
  ...(hasCustomEdges ? { hasCustomEdges: true } : {}),
});

describe("Studio edge status wiring", () => {
  it("uses edge helpers for custom finishes and explicit normal status in both Studio editors", () => {
    for (const componentName of ["StudioPieceEditorLegacy", "StudioPieceEditor"] as const) {
      let currentPiece = piece();
      const counters = { set: 0, clear: 0 };
      const setPieceState: SetPieceState = (_setState, _pieceId, update) => {
        currentPiece = update(currentPiece);
      };
      const changeStatus = loadChangeStatus(componentName, counters, setPieceState);

      changeStatus("r1", "top", "upstand");
      assert.equal(currentPiece.sideStatuses[sideStatusKey("r1", "top")], "upstand");
      assert.equal(currentPiece.hasCustomEdges, true);
      assert.equal(counters.set, 1);
      assert.equal(counters.clear, 0);

      changeStatus("r1", "top", "normal");
      assert.equal(currentPiece.sideStatuses[sideStatusKey("r1", "top")], "normal");
      assert.equal(currentPiece.hasCustomEdges, true);
      assert.equal(counters.set, 1);
      assert.equal(counters.clear, 1);
    }
  });

  it("preserves customer edge choices by rectangle id when a shape changes", () => {
    const previousPiece = piece(
      [rectangle("r1"), rectangle("r2", { xMm: 1000 })],
      { "r1:top": "wall-flush", "r2:bottom": "open-edge" },
      true,
    );
    const nextPiece = piece(
      [rectangle("r1", { widthMm: 1500 }), rectangle("r2", { xMm: 1500 }), rectangle("r3", { xMm: 2100 })],
      { "r1:top": "upstand", "r2:bottom": "open-edge", "r3:top": "upstand" },
    );
    let preserveCalls = 0;
    const applyDefaults = loadApplySimpleShapeEdgeDefaults((previous, next) => {
      preserveCalls += 1;
      return preserveCustomEdgesOnShapeChange(previous, next);
    });

    const changedShape = applyDefaults(previousPiece, nextPiece);

    assert.equal(preserveCalls, 1);
    assert.equal(changedShape.sideStatuses["r1:top"], "wall-flush");
    assert.equal(changedShape.sideStatuses["r2:bottom"], "open-edge");
    assert.equal(changedShape.sideStatuses["r3:top"], "upstand", "new rectangles keep their new shape defaults");
    assert.equal(changedShape.hasCustomEdges, true);
  });

  it("continues auto-mapping default edge finishes for pieces without custom choices", () => {
    const previousPiece = piece([rectangle("r1")]);
    const nextPiece = piece([rectangle("r1", { widthMm: 1500 })]);
    const changedShape = loadApplySimpleShapeEdgeDefaults()(previousPiece, nextPiece);

    assert.equal(changedShape.sideStatuses["r1:top"], "upstand");
    assert.equal(changedShape.sideStatuses["r1:right"], "open-edge");
  });

  it("renders the bathroom portfolio action on basin cards without triggering card selection", () => {
    assert.match(appSource, /href="\/portfolio\?category=bathroom"/);
    assert.match(appSource, /className="product-card-action product-card-action--portfolio"/);
    assert.match(appSource, /data-testid=\{`link-portfolio-basin-\$\{sku\}`\}/);
    assert.match(appSource, /📸 ดูภาพงานจริง/);
    assert.match(appSource, /href="\/portfolio\?category=bathroom"[\s\S]*?onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
    assert.match(cssSource, /\.product-card-action--portfolio\s*\{/);
  });
});