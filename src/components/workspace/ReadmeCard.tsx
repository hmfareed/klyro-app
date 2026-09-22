const FEATURES = [
  "Student management",
  "Teacher management",
  "Attendance tracking (QR + GPS)",
  "Multi-branch support (Zogbeli & Vittin)",
  "Role-based access control",
];

export function ReadmeCard() {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-sm text-slate-400">README.md</p>
      <h2 className="mt-3 text-2xl font-bold text-white">School Management System</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        A modern web application built with Next.js, Node.js and MongoDB to manage schools, students, teachers and attendance.
      </p>
      <h3 className="mt-5 text-lg font-semibold text-white">Features</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span> {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
