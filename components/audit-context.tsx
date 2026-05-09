"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { fashionPack } from "../lib/domainPacks/fashion";
import type { DomainPack } from "../lib/domainPacks/types";

type AuditContextValue = {
  files: File[];
  setFiles: (files: File[]) => void;
  focusPrompt: string;
  setFocusPrompt: (prompt: string) => void;
  selectedPack: DomainPack;
  setSelectedPack: (pack: DomainPack) => void;
  customPacks: DomainPack[];
  addCustomPack: (pack: DomainPack) => void;
};

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<File[]>([]);
  const [focusPrompt, setFocusPrompt] = useState("");
  const [selectedPack, setSelectedPack] = useState<DomainPack>(fashionPack);
  const [customPacks, setCustomPacks] = useState<DomainPack[]>([]);

  const addCustomPack = (pack: DomainPack) => {
    setCustomPacks((prev) => [...prev, pack]);
    setSelectedPack(pack);
  };

  return (
    <AuditContext.Provider
      value={{
        files,
        setFiles,
        focusPrompt,
        setFocusPrompt,
        selectedPack,
        setSelectedPack,
        customPacks,
        addCustomPack,
      }}
    >
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used within AuditProvider");
  return ctx;
}
