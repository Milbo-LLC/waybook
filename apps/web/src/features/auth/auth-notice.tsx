export const AuthNotice = () => {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      Better Auth endpoints are wired under <code>/v1/auth/*</code>. For local bootstrap you can pass
      <code className="mx-1">NEXT_PUBLIC_DEV_USER</code> as <code>userId:email</code>.
    </div>
  );
};
