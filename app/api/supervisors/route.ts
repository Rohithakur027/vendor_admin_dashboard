import { NextRequest, NextResponse } from "next/server";

// POST /api/supervisors  — onboard a new supervisor
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, zone, password, companies, status } = body;

    // ── Validation ─────────────────────────────────────────────────────────────
    const errors: Record<string, string> = {};

    if (!name?.trim())    errors.name     = "Name is required";
    if (!email?.trim())   errors.email    = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email format";
    if (!phone?.trim())   errors.phone    = "Phone is required";
    if (!password || password.length < 8) errors.password = "Password must be at least 8 characters";

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 422 });
    }

    // ── Simulate async work (DB write, auth account creation, email send) ─────
    await new Promise(r => setTimeout(r, 1400));

    // ── Build & return the created supervisor ──────────────────────────────────
    const supervisor = {
      id:            `sup-${Date.now()}`,
      name:          name.trim(),
      email:         email.trim().toLowerCase(),
      phone:         phone.trim(),
      zone:          zone?.trim() ?? "",
      status:        status ?? "Active",
      walletUsed:    0,
      companies:     Array.isArray(companies) ? companies : [],
      appAccess:     true,
      isOnline:      false,
      bookingsToday: 0,
      createdAt:     new Date().toISOString().split("T")[0],
      dailyHistory:  [],
    };

    return NextResponse.json({ success: true, supervisor }, { status: 201 });

  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

// GET /api/supervisors  — list all supervisors (placeholder)
export async function GET() {
  return NextResponse.json({ success: true, supervisors: [] });
}
