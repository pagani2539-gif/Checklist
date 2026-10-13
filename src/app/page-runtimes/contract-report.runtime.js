import { Button } from "../controls/ActionControls.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { MasterSelect } from "../MasterSelect.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { buildContractContextSnapshot } from "../../domain/contracts.js";
import { contractFor } from "../../domain/contracts.js";
import { createContractWorkReport } from "../../domain/contracts.js";
import { navigate } from "../navigation.js";
import { regionsForContract } from "../../domain/contracts.js";
import { useMemo } from "react";
import { useState } from "react";
import { workPackageFor } from "../../domain/contracts.js";

export function createRuntime() {
  const base = { Button, EmptyState, Icon, MasterSelect, PageHeader, buildContractContextSnapshot, contractFor, createContractWorkReport, navigate, regionsForContract, useMemo, useState, workPackageFor };
  return base;
}
