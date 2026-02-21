import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LAYOUTS_DIR = path.join(process.cwd(), "app/workspace/layouts");

export async function GET() {
  try {
    const files = fs.readdirSync(LAYOUTS_DIR).filter((f) => f.endsWith(".json"));
    const layouts = files.map((f) => ({
      name: f.replace(/\.json$/, ""),
      filename: f,
    }));
    return NextResponse.json({ layouts });
  } catch (error) {
    console.error("Failed to list layouts:", error);
    return NextResponse.json({ layouts: [] });
  }
}
