import { Button } from "../controls/ActionControls.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { ThaiDatePicker } from "../date-picker.jsx";
import { MasterSelect } from "../MasterSelect.jsx";
import { SearchableMultiSelect } from "../MasterSelect.jsx";
import { contractFor } from "../../domain/contracts.js";
import { createContractDraft } from "../../domain/contracts.js";
import { getContractCoreCompleteness } from "../../domain/contracts.js";
import { hasDuplicateContractNumber } from "../../domain/contracts.js";
import { navigate } from "../navigation.js";
import { useEffect } from "react";
import { useState } from "react";

export function createRuntime() {
  const base = { Button, PageHeader, ThaiDatePicker, MasterSelect, SearchableMultiSelect, contractFor, createContractDraft, getContractCoreCompleteness, hasDuplicateContractNumber, navigate, useEffect, useState };
  return base;
}
