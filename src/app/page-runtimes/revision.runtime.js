import { Breadcrumb } from "../PagePrimitives.jsx";
import { Button } from "../controls/ActionControls.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { createRevisionRound } from "../../domain/correction.js";
import { getRoundSummary } from "../../domain/master-checklist.js";
import { navigate } from "../navigation.js";
import { useRef } from "react";
import { useState } from "react";
import { validateCorrectionReason } from "../../domain/correction.js";
import { StatusBadge, formatDateTime, roundFor, shortId } from "../page-runtime-components.jsx";

export function createRuntime() {
  const base = { Breadcrumb, Button, EmptyState, Icon, PageHeader, StatusBadge, createRevisionRound, formatDateTime, getRoundSummary, navigate, roundFor, shortId, useRef, useState, validateCorrectionReason };
  return base;
}
