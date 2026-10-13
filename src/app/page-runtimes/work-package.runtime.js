import { Button } from "../controls/ActionControls.jsx";
import CustomSelect from "../CustomSelect.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { assignmentsForWorkPackage } from "../../domain/contracts.js";
import { contractFor } from "../../domain/contracts.js";
import { createContractStationAssignment } from "../../domain/contracts.js";
import { getStationReadiness } from "../../domain/master-checklist.js";
import { navigate } from "../navigation.js";
import { regionsForContract } from "../../domain/contracts.js";
import { useMemo } from "react";
import { useState } from "react";
import { workPackageFor } from "../../domain/contracts.js";
import { StatusBadge } from "../page-runtime-components.jsx";

export function createRuntime() {
  const base = { Button, CustomSelect, EmptyState, Icon, PageHeader, StatusBadge, assignmentsForWorkPackage, contractFor, createContractStationAssignment, getStationReadiness, navigate, regionsForContract, useMemo, useState, workPackageFor };
  return base;
}
