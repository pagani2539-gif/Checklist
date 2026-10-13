import { Button } from "../controls/ActionControls.jsx";
import { EmptyState } from "../PagePrimitives.jsx";
import { AppIcon as Icon } from "../icon-system.jsx";
import { PageHeader } from "../PagePrimitives.jsx";
import { buildContractAgreementCoverSnapshot } from "../../domain/contracts.js";
import { contractAgreementCoversForContract } from "../../domain/contracts.js";
import { contractFor } from "../../domain/contracts.js";
import { createContractAgreementCover } from "../../domain/contracts.js";
import { createContractCommitteeMember } from "../../domain/contracts.js";
import { createContractScopeItem } from "../../domain/contracts.js";
import { nextContractAgreementCoverVersion } from "../../domain/contracts.js";
import { normalizeContractAgreementData } from "../../domain/contracts.js";
import { regionsForContract } from "../../domain/contracts.js";
import { validateContractAgreementCover } from "../../domain/contracts.js";
import { useEffect } from "react";
import { useMemo } from "react";
import { useRef } from "react";
import { useState } from "react";

export function createRuntime() {
  const base = { Button, EmptyState, Icon, PageHeader, buildContractAgreementCoverSnapshot, contractAgreementCoversForContract, contractFor, createContractAgreementCover, createContractCommitteeMember, createContractScopeItem, nextContractAgreementCoverVersion, normalizeContractAgreementData, regionsForContract, validateContractAgreementCover, useEffect, useMemo, useRef, useState };
  return base;
}
