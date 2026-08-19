/**
 * Convert named function declarations to const arrow functions.
 * Usage: node scripts/convert-to-const.mjs
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../src");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) walk(filePath, out);
    else if (/\.tsx?$/.test(name)) out.push(filePath);
  }
  return out;
}

function hasModifier(node, kind) {
  return node.modifiers?.some((mod) => mod.kind === kind) ?? false;
}

function ensureTsxGenericComma(typeParameters, isTsx) {
  if (!isTsx || !typeParameters || typeParameters.length === 0) {
    return typeParameters;
  }
  const last = typeParameters[typeParameters.length - 1];
  if (last.dotDotDotToken) return typeParameters;
  const patched = ts.factory.updateTypeParameterDeclaration(
    last,
    last.modifiers,
    last.name,
    last.constraint,
    last.default,
    true,
  );
  return [...typeParameters.slice(0, -1), patched];
}

function toArrowFunction(node, isTsx) {
  const async = hasModifier(node, ts.SyntaxKind.AsyncKeyword);
  const typeParameters = ensureTsxGenericComma(node.typeParameters, isTsx);
  const fnMods = async ? [ts.factory.createToken(ts.SyntaxKind.AsyncKeyword)] : undefined;

  return ts.factory.createArrowFunction(
    fnMods,
    typeParameters,
    node.parameters,
    node.type,
    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    node.body ?? ts.factory.createBlock([]),
  );
}

function toConst(name, arrow, exportModifier) {
  const modifiers = exportModifier
    ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)]
    : undefined;
  return ts.factory.createVariableStatement(
    modifiers,
    ts.factory.createVariableDeclarationList(
      [ts.factory.createVariableDeclaration(name, undefined, undefined, arrow)],
      ts.NodeFlags.Const,
    ),
  );
}

function transformFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const isTsx = filePath.endsWith(".tsx");
  const kind = isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );

  let changed = false;

  const convertFn = (node) => {
    changed = true;
    const isExport = hasModifier(node, ts.SyntaxKind.ExportKeyword);
    const isDefault = hasModifier(node, ts.SyntaxKind.DefaultKeyword);
    const arrow = toArrowFunction(node, isTsx);
    return { kind: isDefault && isExport ? "default" : "const", node, arrow, isExport };
  };

  const transformer = (context) => {
    const visit = (node) => {
      if (ts.isSourceFile(node)) {
        const statements = [];
        for (const stmt of node.statements) {
          if (
            ts.isFunctionDeclaration(stmt) &&
            stmt.name &&
            hasModifier(stmt, ts.SyntaxKind.DefaultKeyword)
          ) {
            const converted = convertFn(stmt);
            statements.push(toConst(converted.node.name, converted.arrow, false));
            statements.push(
              ts.factory.createExportAssignment(
                undefined,
                false,
                ts.factory.createIdentifier(stmt.name.text),
              ),
            );
            continue;
          }
          statements.push(ts.visitEachChild(stmt, visit, context));
        }
        return ts.factory.updateSourceFile(node, statements);
      }

      if (ts.isFunctionDeclaration(node) && node.name) {
        const converted = convertFn(node);
        return toConst(
          converted.node.name,
          converted.arrow,
          converted.isExport && !hasModifier(node, ts.SyntaxKind.DefaultKeyword),
        );
      }

      return ts.visitEachChild(node, visit, context);
    };

    return (node) => ts.visitNode(node, visit);
  };

  const { transformed } = ts.transform(sourceFile, [transformer]);
  const result = transformed[0];
  if (!changed) return false;

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });
  let printed = printer.printNode(ts.EmitHint.Unspecified, result, sourceFile);
  if (!printed.endsWith("\n")) printed += "\n";
  fs.writeFileSync(filePath, printed);
  return true;
}

const files = walk(ROOT);
let changedFiles = 0;
for (const filePath of files) {
  if (transformFile(filePath)) {
    changedFiles += 1;
    console.log(path.relative(ROOT, filePath));
  }
}
console.log(`Updated ${changedFiles} files.`);
