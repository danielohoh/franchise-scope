import { NextResponse } from "next/server";

import mammoth from "mammoth";

import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function extractTextFromFile(file: File) {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  if (name.endsWith(".pdf")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("지원하지 않는 파일 형식입니다. (.txt, .md, .pdf, .docx만 가능)");
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: docs, error } = await supabase
      .from("knowledge_docs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[knowledge] GET failed", error);
      return NextResponse.json({ error: "FAQ 문서를 불러오지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ docs: docs ?? [] });
  } catch (error) {
    console.error("[knowledge] GET unexpected", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (brandError) {
      console.error("[knowledge] POST brand lookup failed", brandError);
      return NextResponse.json({ error: "브랜드 정보를 확인하지 못했습니다." }, { status: 500 });
    }

    if (!brand) {
      return NextResponse.json({ error: "브랜드 정보를 먼저 등록해 주세요." }, { status: 400 });
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "업로드할 파일이 필요합니다." }, { status: 400 });
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
    }

    const text = (await extractTextFromFile(fileEntry)).trim();
    if (!text) {
      return NextResponse.json({ error: "파일에서 텍스트를 추출하지 못했습니다." }, { status: 400 });
    }

    const { data: doc, error } = await supabase
      .from("knowledge_docs")
      .insert({
        brand_id: brand.id,
        user_id: user.id,
        title: fileEntry.name,
        content: text,
        file_name: fileEntry.name,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[knowledge] POST insert failed", error);
      return NextResponse.json({ error: "FAQ 문서를 저장하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ doc }, { status: 201 });
  } catch (error) {
    console.error("[knowledge] POST unexpected", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
