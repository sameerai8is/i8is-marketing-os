import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { accessErrorResponse } from "./authorization";
import { StrategyError } from "./strategy-policy";
import { ReviewError } from "./review-policy";
import { AssetError } from "./asset-policy";
import { DraftGenerationError } from "./ai-draft";
export const workflowHeaders = { "Cache-Control": "private, no-store" };
export function workflowFailure(error: unknown) {
  if (error instanceof StrategyError || error instanceof ReviewError || error instanceof AssetError || error instanceof DraftGenerationError) return NextResponse.json({ error: error.message }, { status: error.status, headers: workflowHeaders });
  if (error instanceof SyntaxError || error instanceof mongoose.Error.ValidationError) return NextResponse.json({ error: "Check the submitted fields." }, { status: 400, headers: workflowHeaders });
  if ((error as { code?: number })?.code === 11000) return NextResponse.json({ error: "This item changed concurrently. Refresh and retry." }, { status: 409, headers: workflowHeaders });
  return accessErrorResponse(error) || NextResponse.json({ error: "The workflow could not be completed. Please retry." }, { status: 503, headers: workflowHeaders });
}
