export type ClaimVerdict = {
  claim: string;
  verdict: "supported" | "unsupported" | "inconclusive";
  supporting_observation_ids: string[];
  contradicting_observation_ids: string[];
  evidence_summary: string;
  confidence: number;
};

export type PrincipleAssessment = {
  principle_id: string;
  category: string;
  assessment: string;
  verdict: "supported" | "unsupported" | "inconclusive";
};

export type AuditReport = {
  question_answer: string;
  claim_verdicts: ClaimVerdict[];
  principle_assessments: PrincipleAssessment[];
  audit_summary: string;
  confidence_note: string;
};
