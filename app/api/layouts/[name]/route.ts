import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LAYOUTS_DIR = path.join(process.cwd(), "app/workspace/layouts");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // Validate name: only allow alphanumeric, hyphens, underscores
  if (!/^[\w-]+$/.test(name)) {
    return NextResponse.json({ error: "Invalid layout name" }, { status: 400 });
  }

  const filePath = path.join(LAYOUTS_DIR, `${name}.json`);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json({ error: "Layout not found" }, { status: 404 });
  }
}
