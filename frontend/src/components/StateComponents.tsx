export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-blue-500" />
      {label && <p className="text-gray-400 mt-3 text-sm">{label}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-12 bg-gray-800 rounded-xl border border-red-700/30">
      <p className="text-red-400 mb-2 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-blue-400 hover:text-blue-300 text-sm font-medium">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
      <p className="text-gray-300 font-medium">{title}</p>
      {description && <p className="text-gray-500 text-sm mt-2">{description}</p>}
    </div>
  );
}
