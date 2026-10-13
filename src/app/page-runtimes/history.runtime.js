import { Button } from "../controls/ActionControls.jsx";
import CustomSelect from "../CustomSelect.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { getContractContextForRound } from "../../domain/contracts.js";
import { getCorrectionSummary } from "../../domain/correction.js";
import { parseHash } from "../router.js";
import { useDeferredValue } from "react";
import { useState } from "react";
import { RoundCard, profileFor } from "../page-runtime-components.jsx";

export function createRuntime() {
  const base = { Button, CustomSelect, EmptyState, Icon, PageHeader, RoundCard, getContractContextForRound, getCorrectionSummary, parseHash, profileFor, useDeferredValue, useState };
  return base;
}
