export function ChainGPTIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 border border-yellow-200 rounded-md text-xs font-medium text-yellow-700">
      <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
      ChainGPT Active
    </div>
  );
}