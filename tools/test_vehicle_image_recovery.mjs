import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

// Execute the actual image component with a persistent hook lifecycle. A changed
// vehicle must clear a previous request error even when returning to its URL.
const source = readFileSync(new URL("../src/app/vehicle-review/ReviewPanels.jsx", import.meta.url), "utf8");
const start = source.indexOf("  function useVehicleReviewImage(");
const imageStart = source.indexOf("  function VehicleReviewImage(");
const end = source.indexOf("  function VehicleReviewDimensionActions(", imageStart);
assert.ok(imageStart >= 0 && end > imageStart);
const code = transformSync(source.slice(start >= 0 ? start : imageStart, end), {
  loader: "jsx", jsxFactory: "h", jsxFragment: "Fragment", format: "cjs",
}).code;

function createInstance() {
  const slots = [];
  let cursor = 0;
  let dirty = false;
  let effects = [];
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
    return [slots[index], (next) => {
      const value = typeof next === "function" ? next(slots[index]) : next;
      if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
    }];
  };
  const useRef = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = { current: initial };
    return slots[index];
  };
  const useEffect = (fn, dependencies) => {
    const index = cursor++;
    if (!slots[index] || dependencies.some((value, i) => !Object.is(value, slots[index][i]))) {
      slots[index] = dependencies;
      effects.push(fn);
    }
  };
  const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) });
  const component = new Function("useState", "useRef", "useEffect", "h", "Fragment", "buildVehicleSearchDirectImageUrl", `${code}; return VehicleReviewImage;`)(useState, useRef, useEffect, h, "fragment", () => "");
  const render = (src) => {
    let tree;
    let rounds = 0;
    do {
      if (++rounds > 10) throw new Error("Unexpected render loop");
      cursor = 0; dirty = false; effects = [];
      tree = component({ src, alt: "vehicle", emptyLabel: "missing", className: "image", onOpen() {} });
      for (const effect of effects) effect();
    } while (dirty);
    return tree;
  };
  return { render };
}
function find(tree, predicate) {
  if (predicate(tree)) return tree;
  for (const child of tree?.children || []) {
    if (typeof child !== "object") continue;
    const match = find(child, predicate);
    if (match) return match;
  }
  return null;
}
const image = (tree) => find(tree, (node) => node?.type === "img");
const fail = (tree) => {
  const node = image(tree);
  assert.ok(node, "Image must exist before a failed request");
  node.props.onError({ currentTarget: { src: node.props.src, getAttribute: () => node.props.src } });
};

const instance = createInstance();
fail(instance.render("/api/vehicle/image?path=lpr/a.jpg"));
assert.equal(image(instance.render("/api/vehicle/image?path=lpr/a.jpg")), null);
assert.ok(image(instance.render("/api/vehicle/image?path=lpr/b.jpg")), "Another vehicle can load");
assert.ok(image(instance.render("/api/vehicle/image?path=lpr/a.jpg")), "Returning to a previously failed image must try loading again without F5");

const retryInstance = createInstance();
const retrySource = "/api/vehicle/image?stationId=station-test&path=crop/a.jpg";
fail(retryInstance.render(retrySource));
const failed = retryInstance.render(retrySource);
const retryButton = find(failed, (node) => node?.type === "button" && node.children.includes("โหลดภาพอีกครั้ง"));
assert.ok(retryButton, "A failed image offers retry without reloading the whole inspection");
retryButton.props.onClick();
const reloaded = image(retryInstance.render(retrySource));
assert.ok(reloaded);
assert.match(reloaded.props.src, /stationId=station-test/);
assert.match(reloaded.props.src, /path=crop\/a\.jpg/);
assert.notEqual(reloaded.props.src, retrySource, "Retry should bypass a failed cached proxy response");
assert.equal(image(retryInstance.render(null)), null, "No image path must not fabricate evidence");

const raceInstance = createInstance();
const staleImage = image(raceInstance.render("/api/vehicle/image?path=lpr/a.jpg"));
raceInstance.render("/api/vehicle/image?path=lpr/b.jpg");
staleImage.props.onError({ currentTarget: { src: staleImage.props.src, getAttribute: () => staleImage.props.src } });
assert.ok(image(raceInstance.render("/api/vehicle/image?path=lpr/b.jpg")), "A late error from a previous vehicle must not hide the current image");

console.log("PASS vehicle image recovery: failed A → B → A, manual retry, missing source, stale error");
