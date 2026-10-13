import { Button } from "../controls/ActionControls.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { createId } from "../../domain/master-checklist.js";
import { useState } from "react";

export function createRuntime() {
  const base = { Button, EmptyState, PageHeader, createId, useState };
  return base;
}
