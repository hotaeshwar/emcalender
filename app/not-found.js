import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-extrabold text-2xl mx-auto border border-indigo-100">
          404
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Page Not Found
        </h2>
        <p className="text-sm text-slate-600 font-medium leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
