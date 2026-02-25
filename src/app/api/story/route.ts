import { NextRequest, NextResponse } from "next/server";

import type { StoryEvent } from "@/lib/types";

type StoryRecord = {
  id: string;
  createdAt: string;
  events: StoryEvent[];
};

const storyStore = new Map<string, StoryRecord>();

function makeStoryId() {
  return `st_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { events?: StoryEvent[] };
  const events = Array.isArray(body.events) ? body.events : [];

  if (!events.length) {
    return NextResponse.json({ error: "No story events provided" }, { status: 400 });
  }

  const id = makeStoryId();
  storyStore.set(id, {
    id,
    createdAt: new Date().toISOString(),
    events
  });

  return NextResponse.json({ id });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const story = storyStore.get(id);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json(story);
}
