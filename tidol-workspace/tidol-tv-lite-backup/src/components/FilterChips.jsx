export default function FilterChips() {
    return (
        <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide [&::-webkit-scrollbar]:hidden snap-x">
            <button className="whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium bg-white text-black shadow-lg scale-105 transition-all snap-start">Recientes</button>
            <button className="whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/10 transition-all snap-start">Favoritos</button>
            <button className="whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/10 transition-all snap-start">Artistas</button>
        </div>
    );
}
