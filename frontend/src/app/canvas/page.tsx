import Link from 'next/link';

export default function CanvasPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-center">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
          CanvasContracts
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
          Visual reward policy builder. Design, compile, and archive claim-scoring policies as WASM contracts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <Link
          href="/canvas/editor"
          className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/60 rounded-2xl p-6 hover:border-indigo-500/60 transition-all group"
        >
          <div className="text-3xl mb-3">🎨</div>
          <div className="font-semibold text-white group-hover:text-indigo-400 mb-1">Policy Graph Editor</div>
          <div className="text-xs text-gray-400">Drag-and-drop graph builder for reward policies</div>
        </Link>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/60 rounded-2xl p-6 opacity-60">
          <div className="text-3xl mb-3">📦</div>
          <div className="font-semibold text-white mb-1">WASM Compiler</div>
          <div className="text-xs text-gray-400">Compile policy graphs to WASM contracts (CLI)</div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/60 rounded-2xl p-6 opacity-60">
          <div className="text-3xl mb-3">🏛️</div>
          <div className="font-semibold text-white mb-1">Policy Archive</div>
          <div className="text-xs text-gray-400">IPFS/Arweave archive with DAO governance proposals</div>
        </div>
      </div>

      <div className="bg-gray-800/40 border border-gray-700/60 rounded-2xl p-6 text-left">
        <h2 className="text-lg font-bold text-white mb-3">Getting Started</h2>
        <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
          <li>Use the <strong className="text-white">Policy Graph Editor</strong> to design reward scoring logic</li>
          <li>Add Input, Filter, Multiplier, Cap, and Output nodes</li>
          <li>Connect nodes with edges to define the evaluation flow</li>
          <li>Validate the graph to check for errors</li>
          <li>Export the JSON definition and compile to WASM via the CLI</li>
          <li>Archive on IPFS/Arweave and submit governance proposal</li>
        </ol>
      </div>
    </div>
  );
}
