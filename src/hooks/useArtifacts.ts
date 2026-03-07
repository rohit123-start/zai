"use client";

import { useMemo } from "react";
import { Message } from "./useChat";
import { Artifact, parseArtifactsFromMessages } from "@/utils/parseArtifacts";

export function useArtifacts(messages: Message[]): Artifact[] {
  return useMemo(() => parseArtifactsFromMessages(messages), [messages]);
}
