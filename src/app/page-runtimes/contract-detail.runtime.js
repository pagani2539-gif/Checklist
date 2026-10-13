import { Button } from "../controls/ActionControls.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { ThaiDatePicker } from "../date-picker.jsx";
import { contractFor } from "../../domain/contracts.js";
import { contractLabel } from "../../domain/contracts.js";
import { createWorkPackageDraft } from "../../domain/contracts.js";
import { getContractCoreCompleteness } from "../../domain/contracts.js";
import { navigate } from "../navigation.js";
import { regionsForContract } from "../../domain/contracts.js";
import { useMemo } from "react";
import { useState } from "react";
import { validateWorkPackageDraft } from "../../domain/contracts.js";
import { workPackagesForContract } from "../../domain/contracts.js";
import { StatusBadge } from "../page-runtime-components.jsx";

export function createRuntime() {
  const base = { Button, EmptyState, Icon, PageHeader, StatusBadge, ThaiDatePicker, contractFor, contractLabel, createWorkPackageDraft, getContractCoreCompleteness, navigate, regionsForContract, useMemo, useState, validateWorkPackageDraft, workPackagesForContract };
  return base;
}
