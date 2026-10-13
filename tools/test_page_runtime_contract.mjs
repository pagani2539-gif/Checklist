import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import * as traverseModule from "@babel/traverse";
import { createPageRuntime, PAGE_RUNTIME_KEYS } from "../src/app/page-runtime.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pageDirectory = path.join(root, "src/app/pages");
const traverse = traverseModule.default.default || traverseModule.default;
const pageKeysByFactory = {
  createChecklistPage: "checklist",
  createContextualStationPage: "contextualStation",
  createContractAgreementCoverPage: "contractAgreementCover",
  createContractReportPage: "contractReport",
  createNewContractPage: "contractNew",
  createContractDetailPage: "contractDetail",
  createWorkPackagePage: "workPackage",
  createDashboardPage: "dashboard",
  createHistoryPage: "history",
  createInspectionsPage: "inspections",
  createNewInspectionPage: "newInspection",
  createReferenceDataPage: "referenceData",
  createRevisionPage: "revision",
  createStationDetailPage: "stationDetail",
  createStationsPage: "stations",
  createVehicleApiReviewPage: "vehicleApi",
};

const pageFiles = fs.readdirSync(pageDirectory).filter((name) => name.endsWith(".jsx")).sort();
const discoveredFactories = new Set();

for (const file of pageFiles) {
  const source = fs.readFileSync(path.join(pageDirectory, file), "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
  traverse(ast, {
    FunctionDeclaration(factoryPath) {
      const factoryName = factoryPath.node.id?.name;
      const runtimeKey = pageKeysByFactory[factoryName];
      if (!runtimeKey) return;
      assert.ok(!discoveredFactories.has(factoryName), `${factoryName} should be declared once`);
      discoveredFactories.add(factoryName);
      let destructuredNames = null;
      factoryPath.traverse({
        VariableDeclarator(path) {
          if (path.node.init?.type !== "Identifier" || path.node.init.name !== "runtime" || path.node.id.type !== "ObjectPattern") return;
          assert.equal(destructuredNames, null, `${factoryName} should have one runtime interface`);
          destructuredNames = path.node.id.properties.map((property) => {
            assert.equal(property.type, "ObjectProperty", `${factoryName} should use explicit runtime dependencies`);
            return property.key.name || property.key.value;
          });
        },
      });
      assert.deepEqual(PAGE_RUNTIME_KEYS[runtimeKey], destructuredNames, `${factoryName} runtime manifest should match its factory interface in order`);
      assert.equal(new Set(PAGE_RUNTIME_KEYS[runtimeKey]).size, PAGE_RUNTIME_KEYS[runtimeKey].length, `${factoryName} runtime manifest should not repeat keys`);
    },
  });
}
assert.deepEqual([...discoveredFactories].sort(), Object.keys(pageKeysByFactory).sort(), "every page factory should have one runtime manifest entry");

assert.deepEqual(createPageRuntime({ Button: "button", Icon: "icon", unused: true }, ["Icon"]), { Icon: "icon" });
assert.throws(() => createPageRuntime({ Icon: "icon" }, ["Button"]), /missing the required dependency "Button"/);

const appSource = fs.readFileSync(path.join(root, "src/app/App.jsx"), "utf8");
assert.match(appSource, /const PAGE_RUNTIME_LOADERS = Object\.freeze\(/);
assert.match(appSource, /return createPageRuntime\(module\.createRuntime\(\), PAGE_RUNTIME_KEYS\[key\]\)/);
const runtimeLoaderKeys = new Set([...appSource.matchAll(/^\s*([A-Za-z]+):\s*\(\)\s*=>\s*import\("\.\/page-runtimes\//gm)].map((match) => match[1]));
assert.deepEqual(runtimeLoaderKeys, new Set(Object.keys(PAGE_RUNTIME_KEYS)), "every page runtime should load through an explicit dynamic import");
assert.match(appSource, /const PAGE_COMPONENTS = Object\.freeze\(/);
assert.match(appSource, /adminUsers: createLazyPage\(async \(\) => \(await import\("\.\/AdminUsersPage\.jsx"\)\)\.AdminUsersPage\)/);
assert.match(appSource, /historyDetail: checklistPage/);
assert.match(appSource, /historyVehicleApi: vehicleApiPage/);
assert.match(appSource, /LazyContractContextBar = lazy\(\(\) => import\("\.\/ContractContextBar\.jsx"\)\)/);
assert.doesNotMatch(appSource, /from ["']\.\/pages\//, "routed page factories should not be imported eagerly");
assert.doesNotMatch(appSource, /from ["']\.\/AdminUsersPage\.jsx["']/);
assert.doesNotMatch(appSource, /from ["']\.\.\/domain\/(master-checklist|vehicle-search|evidence-checklist|contracts)\.js["']/, "page domain modules should not be imported by the application shell");

const attachmentFieldsSource = fs.readFileSync(path.join(root, "src/app/AttachmentFields.jsx"), "utf8");
assert.match(attachmentFieldsSource, /lazy\(\(\) => import\("\.\/ImageAnnotationEditor\.jsx"\)\)/, "image annotation editor should load only when attachment editing is requested");
const mainSource = fs.readFileSync(path.join(root, "src/main.jsx"), "utf8");
assert.doesNotMatch(mainSource, /snapshot-evidence-pdf|PrintableReport/);

console.log("test_page_runtime_contract: pass");
