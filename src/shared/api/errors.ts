import { NextResponse } from "next/server";

// 14-api-design error envelope: { error: { code, message, field } }.
// code is machine-branchable, message is displayable, field targets forms.
export function apiError(code: string, message: string, field: string | null = null, status = 400) {
  return NextResponse.json({ error: { code, message, field } }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
